import { createRandom, type Random } from '@view/city';
import { barSeconds, composeBar, midiToHz, TRACKS, type NoteEvent, type TrackId } from './composer';

const LEVEL = 0.42;
const FADE_SECONDS = 1.5;
const CROSSFADE_SECONDS = 2;
const SEEDS: Record<TrackId, number> = { menu: 0x0a51501, city: 0x0a51502 };
interface Channel {
  track: TrackId;
  bus: GainNode;
  random: Random;
  bar: number;
  next: number;
}
export interface MusicState {
  playing: boolean;
  track: TrackId;
  ducked: boolean;
}

/** Procedural plucked strings, breathy flute, frame drum and a quiet desert sound bed. */
export class OasisMusic {
  private readonly fade: GainNode;
  private readonly duck: GainNode;
  private readonly tone: BiquadFilterNode;
  private readonly reverb: ConvolverNode;
  private readonly nodes = new Set<AudioNode>();
  private readonly sources = new Set<AudioScheduledSourceNode>();
  private readonly retirement = new Set<ReturnType<typeof setTimeout>>();
  private channel: Channel | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private enabled = false;
  private disposed = false;
  private ducked = false;
  private track: TrackId = 'menu';

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
    private readonly noise: AudioBuffer,
  ) {
    this.fade = this.keep(ctx.createGain());
    this.fade.gain.value = 0;
    this.fade.connect(destination);
    this.duck = this.keep(ctx.createGain());
    this.duck.connect(this.fade);
    this.tone = this.keep(ctx.createBiquadFilter());
    this.tone.type = 'lowpass';
    this.tone.frequency.value = 5200;
    this.tone.connect(this.duck);
    this.reverb = this.keep(ctx.createConvolver());
    this.reverb.buffer = impulse(ctx);
    const wet = this.keep(ctx.createGain());
    wet.gain.value = 0.22;
    this.reverb.connect(wet).connect(this.tone);
    this.ambience(420, 0.018, 0.07);
    this.ambience(1800, 0.006, 0.23);
  }

  get state(): MusicState {
    return {
      playing: this.enabled && this.ctx.state === 'running',
      track: this.track,
      ducked: this.ducked,
    };
  }

  start(track: TrackId): void {
    if (this.disposed) return;
    this.setTrack(track);
    if (this.enabled) return;
    this.enabled = true;
    this.openChannel();
    ramp(this.fade.gain, LEVEL, this.ctx.currentTime, FADE_SECONDS);
    this.timer = setInterval(() => this.tick(), 200);
    this.tick();
  }

  stop(): void {
    if (!this.enabled) return;
    this.enabled = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    ramp(this.fade.gain, 0, this.ctx.currentTime, 0.6);
    this.closeChannel(0.6);
  }

  setTrack(track: TrackId): void {
    if (this.disposed || track === this.track) return;
    this.track = track;
    if (!this.enabled) return;
    this.closeChannel(CROSSFADE_SECONDS);
    this.openChannel();
    this.tick();
  }

  /** Separate gain keeps pause attenuation intact across restart and track transitions. */
  setPaused(paused: boolean): void {
    if (this.disposed || this.ducked === paused) return;
    this.ducked = paused;
    ramp(this.duck.gain, paused ? 0.5 : 1, this.ctx.currentTime, 0.35);
    ramp(this.tone.frequency, paused ? 1200 : 5200, this.ctx.currentTime, 0.35);
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    for (const timeout of this.retirement) clearTimeout(timeout);
    this.retirement.clear();
    for (const source of this.sources) source.stop();
    this.sources.clear();
    for (const node of this.nodes) node.disconnect();
    this.nodes.clear();
  }

  private keep<T extends AudioNode>(node: T): T {
    this.nodes.add(node);
    return node;
  }

  private openChannel(): void {
    const bus = this.keep(this.ctx.createGain());
    bus.gain.value = 0;
    bus.connect(this.tone);
    bus.connect(this.reverb);
    ramp(bus.gain, 1, this.ctx.currentTime, CROSSFADE_SECONDS);
    this.channel = {
      track: this.track,
      bus,
      random: createRandom(SEEDS[this.track]),
      bar: 0,
      next: this.ctx.currentTime + 0.05,
    };
  }

  private closeChannel(seconds: number): void {
    const old = this.channel;
    this.channel = null;
    if (!old) return;
    ramp(old.bus.gain, 0, this.ctx.currentTime, seconds);
    const timeout = setTimeout(
      () => {
        old.bus.disconnect();
        this.nodes.delete(old.bus);
        this.retirement.delete(timeout);
      },
      (seconds + 6) * 1000,
    );
    this.retirement.add(timeout);
  }

  private tick(): void {
    const channel = this.channel;
    if (!channel || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (channel.next < now) channel.next = now + 0.05;
    const spec = TRACKS[channel.track];
    while (channel.next < now + 1.2) {
      for (const note of composeBar(spec, channel.bar, channel.random)) {
        this.note(
          channel.bus,
          note,
          channel.next + (note.beat * 60) / spec.bpm,
          (note.duration * 60) / spec.bpm,
        );
      }
      channel.bar++;
      channel.next += barSeconds(spec);
    }
  }

  private note(out: AudioNode, note: NoteEvent, time: number, duration: number): void {
    const ctx = this.ctx;
    const local: AudioNode[] = [];
    const sources: AudioScheduledSourceNode[] = [];
    const keep = <T extends AudioNode>(node: T): T => {
      local.push(this.keep(node));
      return node;
    };
    const env = keep(ctx.createGain());
    env.connect(out);
    const frequency = midiToHz(note.midi);
    const level =
      { bass: 0.25, pad: 0.12, arp: 0.25, lead: 0.2, drum: 0.2 }[note.voice] * note.velocity;
    const attack = note.voice === 'pad' ? 0.65 : note.voice === 'lead' ? 0.08 : 0.008;
    const release = note.voice === 'pad' ? 1.2 : 0.3;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(level, time + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration + release);
    const osc = (hz: number, type: OscillatorType, output: AudioNode) => {
      const node = keep(ctx.createOscillator());
      node.type = type;
      node.frequency.value = hz;
      node.connect(output);
      sources.push(node);
      return node;
    };
    if (note.voice === 'arp') {
      // Plucked-string approximation: a short FM attack and a decaying resonant body.
      const body = osc(frequency, 'sine', env);
      const depth = keep(ctx.createGain());
      depth.gain.setValueAtTime(frequency * 1.5, time);
      depth.gain.exponentialRampToValueAtTime(1, time + 0.18);
      depth.connect(body.frequency);
      osc(frequency * 2, 'sine', depth);
    } else if (note.voice === 'lead') {
      osc(frequency, 'sine', env);
      const harmonic = keep(ctx.createGain());
      harmonic.gain.value = 0.12;
      harmonic.connect(env);
      osc(frequency * 2, 'sine', harmonic);
      const breath = keep(ctx.createBufferSource());
      breath.buffer = this.noise;
      breath.loop = true;
      const filter = keep(ctx.createBiquadFilter());
      filter.type = 'bandpass';
      filter.frequency.value = frequency * 2;
      filter.Q.value = 1.8;
      const air = keep(ctx.createGain());
      air.gain.value = 0.12;
      breath.connect(filter).connect(air).connect(env);
      sources.push(breath);
    } else if (note.voice === 'drum') {
      const body = osc(frequency, 'sine', env);
      body.frequency.setValueAtTime(frequency * 1.7, time);
      body.frequency.exponentialRampToValueAtTime(frequency, time + 0.06);
    } else {
      osc(frequency, 'sine', env);
    }
    const end = time + duration + release + 0.05;
    let remaining = sources.length;
    for (const source of sources) {
      this.sources.add(source);
      source.onended = () => {
        this.sources.delete(source);
        if (--remaining === 0)
          for (const node of local) {
            node.disconnect();
            this.nodes.delete(node);
          }
      };
      source.start(time);
      source.stop(end);
    }
  }

  /** Filtered noise with a slow swell; music mute also silences both ambience layers. */
  private ambience(frequency: number, level: number, rate: number): void {
    const source = this.keep(this.ctx.createBufferSource());
    source.buffer = this.noise;
    source.loop = true;
    const filter = this.keep(this.ctx.createBiquadFilter());
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.6;
    const gain = this.keep(this.ctx.createGain());
    gain.gain.value = level;
    source.connect(filter).connect(gain).connect(this.tone);
    const lfo = this.keep(this.ctx.createOscillator());
    lfo.frequency.value = rate;
    const depth = this.keep(this.ctx.createGain());
    depth.gain.value = level * 0.45;
    lfo.connect(depth).connect(gain.gain);
    for (const node of [source, lfo]) {
      this.sources.add(node);
      node.start();
    }
  }
}

function ramp(param: AudioParam, target: number, now: number, seconds: number): void {
  param.cancelAndHoldAtTime(now);
  param.linearRampToValueAtTime(target, now + seconds);
}
function impulse(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 2.4), ctx.sampleRate);
  const random = createRandom(0x0a515);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) data[i] = (random() * 2 - 1) * (1 - i / data.length) ** 3;
  }
  return buffer;
}
