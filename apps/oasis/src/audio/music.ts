import { createRandom, type Random } from '@view/city';
import {
  barSeconds,
  composeBar,
  midiToHz,
  moodSpec,
  TRACKS,
  type Mood,
  type NoteEvent,
  type TrackId,
} from './composer';

// The shared board already applies music and master attenuation.
const LEVEL = 1;
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
  mood: Mood;
}

/** Brightness of the score per mood, before the pause filter. */
const MOOD_TONE: Record<Mood, number> = { calm: 5200, prosperous: 6400, scarce: 2600, storm: 3200 };
/** Desert wind under the score per mood, as a multiple of its calm level. */
const MOOD_WIND: Record<Mood, number> = { calm: 1, prosperous: 0.8, scarce: 2.2, storm: 4 };
const MOOD_SECONDS = 4;
const WIND_LEVEL = 0.018;

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
  private mood: Mood = 'calm';
  private wind: GainNode | null = null;

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
    this.wind = this.ambience(420, WIND_LEVEL, 0.07);
    this.ambience(1800, 0.006, 0.23);
  }

  get state(): MusicState {
    return {
      playing: this.enabled && this.ctx.state === 'running',
      track: this.track,
      ducked: this.ducked,
      mood: this.mood,
    };
  }

  /** Reshapes the next bars and slowly retunes brightness and wind. The menu stays calm. */
  setMood(mood: Mood): void {
    if (this.disposed || mood === this.mood) return;
    this.mood = mood;
    const now = this.ctx.currentTime;
    if (!this.ducked) ramp(this.tone.frequency, this.brightness(), now, MOOD_SECONDS);
    if (this.wind) ramp(this.wind.gain, WIND_LEVEL * this.windScale(), now, MOOD_SECONDS);
  }

  private effectiveMood(): Mood {
    return this.track === 'city' ? this.mood : 'calm';
  }

  private brightness(): number {
    return MOOD_TONE[this.effectiveMood()];
  }

  private windScale(): number {
    return MOOD_WIND[this.effectiveMood()];
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
    const now = this.ctx.currentTime;
    if (!this.ducked) ramp(this.tone.frequency, this.brightness(), now, CROSSFADE_SECONDS);
    if (this.wind) ramp(this.wind.gain, WIND_LEVEL * this.windScale(), now, CROSSFADE_SECONDS);
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
    ramp(this.tone.frequency, paused ? 1200 : this.brightness(), this.ctx.currentTime, 0.35);
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
    const spec = moodSpec(TRACKS[channel.track], this.effectiveMood());
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
    // Sustained voices must hold their body instead of fading to near silence across
    // the entire note. Plucks and drums retain their short exponential decay.
    if (note.voice === 'bass' || note.voice === 'pad' || note.voice === 'lead') {
      env.gain.linearRampToValueAtTime(level * 0.65, time + duration);
    }
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
      if (note.voice === 'bass') {
        // A quiet upper harmonic keeps the bass present on laptop speakers.
        const harmonic = keep(ctx.createGain());
        harmonic.gain.value = 0.18;
        harmonic.connect(env);
        osc(frequency * 2, 'triangle', harmonic);
      }
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
  private ambience(frequency: number, level: number, rate: number): GainNode {
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
    return gain;
  }
}

/**
 * Glides from the current value. Firefox has no `cancelAndHoldAtTime`, and calling it there
 * threw out of every track, pause and mood change; holding the current value is the portable
 * equivalent.
 */
export function ramp(param: AudioParam, target: number, now: number, seconds: number): void {
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
  else {
    const current = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(current, now);
  }
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
