import { createRandom, type Random } from '@view/city';
import {
  BEATS_PER_BAR,
  composeBar,
  midiToHz,
  TRACKS,
  type NoteEvent,
  type TrackId,
  type VoiceId,
} from './composer';

/**
 * Synthesized lo-fi ambient music: an FM electric piano, a detuned pad, a sine bass and a sparse
 * melody, through a noise-impulse reverb, a short delay and a quiet vinyl hiss. Bars come from
 * `composeBar` and are scheduled ahead of time on the AudioContext clock.
 */

const TICK_MS = 200;
const LOOKAHEAD_S = 1.2;
const CROSSFADE_S = 2;
const FADE_IN_S = 2;
const FADE_OUT_S = 0.8;
/** Ducking while the game is paused: about −6 dB and a darker tone. */
const DUCK_GAIN = 0.5;
const DUCK_CUTOFF = 1200;
const OPEN_CUTOFF = 5200;
const DUCK_TIME_S = 0.35;
const HISS_LEVEL = 0.012;
const REVERB_SECONDS = 2.6;
const DELAY_S = 0.42;
const DELAY_FEEDBACK = 0.3;
/** Notes scheduled after a crossfade keep ringing this long before the old channel is dropped. */
const CHANNEL_TAIL_MS = 6000;

const TRACK_SEEDS: Record<TrackId, number> = { menu: 0x5eed01, city: 0x5eed02 };

/** Dry level and effect sends per voice. */
const MIX: Record<VoiceId, { level: number; reverb: number; delay: number }> = {
  keys: { level: 0.75, reverb: 0.35, delay: 0.08 },
  pad: { level: 0.6, reverb: 0.6, delay: 0 },
  bass: { level: 0.9, reverb: 0.05, delay: 0 },
  melody: { level: 0.55, reverb: 0.45, delay: 0.35 },
};
const VOICES = Object.keys(MIX) as VoiceId[];

interface Channel {
  track: TrackId;
  /** Per-voice inputs; their gains carry the crossfade. */
  buses: Record<VoiceId, GainNode>;
  random: Random;
  bar: number;
  nextBarTime: number;
}

export interface MusicState {
  playing: boolean;
  track: TrackId;
  ducked: boolean;
}

export class MusicPlayer {
  private readonly dry: GainNode;
  private readonly sends: Record<VoiceId, { reverb: GainNode; delay: GainNode }>;
  private readonly tone: BiquadFilterNode;
  private readonly duck: GainNode;
  private readonly fade: GainNode;
  private readonly hiss: AudioBufferSourceNode;
  private channel: Channel | null = null;
  private track: TrackId = 'menu';
  private ducked = false;
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly ctx: AudioContext,
    output: AudioNode,
    noise: AudioBuffer,
  ) {
    this.fade = ctx.createGain();
    this.fade.gain.value = 0;
    this.fade.connect(output);
    this.duck = ctx.createGain();
    this.duck.connect(this.fade);
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = OPEN_CUTOFF;
    this.tone.Q.value = 0.4;
    this.tone.connect(this.duck);

    this.dry = ctx.createGain();
    this.dry.connect(this.tone);

    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, REVERB_SECONDS);
    reverb.connect(this.tone);

    const delay = ctx.createDelay(1);
    delay.delayTime.value = DELAY_S;
    const feedback = ctx.createGain();
    feedback.gain.value = DELAY_FEEDBACK;
    const delayTone = ctx.createBiquadFilter();
    delayTone.type = 'lowpass';
    delayTone.frequency.value = 2200;
    delay.connect(delayTone).connect(feedback).connect(delay);
    delayTone.connect(this.tone);

    this.sends = {} as Record<VoiceId, { reverb: GainNode; delay: GainNode }>;
    for (const voice of VOICES) {
      const r = ctx.createGain();
      r.gain.value = MIX[voice].reverb;
      r.connect(reverb);
      const d = ctx.createGain();
      d.gain.value = MIX[voice].delay;
      d.connect(delay);
      this.sends[voice] = { reverb: r, delay: d };
    }

    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.value = 4500;
    hissFilter.Q.value = 0.6;
    const hissGain = ctx.createGain();
    hissGain.gain.value = HISS_LEVEL;
    this.hiss = ctx.createBufferSource();
    this.hiss.buffer = noise;
    this.hiss.loop = true;
    this.hiss.connect(hissFilter).connect(hissGain).connect(this.tone);
    this.hiss.start();
  }

  get state(): MusicState {
    return {
      playing: this.running && this.ctx.state === 'running',
      track: this.channel?.track ?? this.track,
      ducked: this.ducked,
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const now = this.ctx.currentTime;
    if (!this.channel) this.channel = this.openChannel(this.track, now + 0.1, false);
    ramp(this.fade.gain, 1, now, FADE_IN_S);
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    ramp(this.fade.gain, 0, this.ctx.currentTime, FADE_OUT_S);
  }

  /** Crossfades to another track (immediately when stopped). */
  setTrack(track: TrackId): void {
    if (track === this.track) return;
    this.track = track;
    const old = this.channel;
    if (!old) return;
    const now = this.ctx.currentTime;
    if (!this.running) {
      this.closeChannel(old, now, 0);
      this.channel = null;
      return;
    }
    this.closeChannel(old, now, CROSSFADE_S);
    this.channel = this.openChannel(track, now + 0.05, true);
  }

  setDucked(ducked: boolean): void {
    if (ducked === this.ducked) return;
    this.ducked = ducked;
    const now = this.ctx.currentTime;
    ramp(this.duck.gain, ducked ? DUCK_GAIN : 1, now, DUCK_TIME_S);
    ramp(this.tone.frequency, ducked ? DUCK_CUTOFF : OPEN_CUTOFF, now, DUCK_TIME_S);
  }

  dispose(): void {
    this.stop();
    try {
      this.hiss.stop();
    } catch {
      // Already stopped together with the context.
    }
  }

  private tick(): void {
    const channel = this.channel;
    if (!channel || !this.running) return;
    const now = this.ctx.currentTime;
    // After a suspended context or a throttled tab, restart from now instead of catching up.
    if (channel.nextBarTime < now) channel.nextBarTime = now + 0.05;
    while (channel.nextBarTime < now + LOOKAHEAD_S) this.scheduleBar(channel);
  }

  private scheduleBar(channel: Channel): void {
    const spec = TRACKS[channel.track];
    const beat = 60 / spec.bpm;
    for (const note of composeBar(spec, channel.bar, channel.random)) {
      this.playNote(channel, note, channel.nextBarTime + note.beat * beat, note.length * beat);
    }
    channel.bar++;
    channel.nextBarTime += BEATS_PER_BAR * beat;
  }

  private openChannel(track: TrackId, start: number, fadeIn: boolean): Channel {
    const buses = {} as Record<VoiceId, GainNode>;
    for (const voice of VOICES) {
      const bus = this.ctx.createGain();
      bus.gain.value = fadeIn ? 0 : MIX[voice].level;
      if (fadeIn) ramp(bus.gain, MIX[voice].level, this.ctx.currentTime, CROSSFADE_S);
      bus.connect(this.dry);
      bus.connect(this.sends[voice].reverb);
      bus.connect(this.sends[voice].delay);
      buses[voice] = bus;
    }
    return { track, buses, random: createRandom(TRACK_SEEDS[track]), bar: 0, nextBarTime: start };
  }

  private closeChannel(channel: Channel, now: number, seconds: number): void {
    for (const voice of VOICES) ramp(channel.buses[voice].gain, 0, now, Math.max(0.05, seconds));
    setTimeout(
      () => {
        for (const voice of VOICES) channel.buses[voice].disconnect();
      },
      seconds * 1000 + CHANNEL_TAIL_MS,
    );
  }

  private playNote(channel: Channel, note: NoteEvent, t: number, duration: number): void {
    const out = channel.buses[note.voice];
    const freq = midiToHz(note.midi);
    switch (note.voice) {
      case 'keys':
        return this.electricPiano(out, freq, t, duration, note.velocity * 0.2, 2.2);
      case 'melody':
        return this.electricPiano(out, freq, t, duration, note.velocity * 0.16, 1.4);
      case 'pad':
        return this.pad(out, freq, t, duration, note.velocity * 0.07);
      case 'bass':
        return this.bass(out, freq, t, duration, note.velocity * 0.22);
    }
  }

  /** Two-operator FM with a short high "tine" partial on the attack. */
  private electricPiano(
    out: AudioNode,
    freq: number,
    t: number,
    duration: number,
    peak: number,
    index: number,
  ): void {
    const ctx = this.ctx;
    const carrier = ctx.createOscillator();
    carrier.frequency.value = freq;
    const mod = ctx.createOscillator();
    mod.frequency.value = freq;
    const modDepth = ctx.createGain();
    modDepth.gain.setValueAtTime(freq * index, t);
    modDepth.gain.exponentialRampToValueAtTime(freq * 0.3, t + 0.9);
    mod.connect(modDepth).connect(carrier.frequency);
    const tine = ctx.createOscillator();
    tine.frequency.value = freq * 14;
    const tineDepth = ctx.createGain();
    tineDepth.gain.setValueAtTime(freq * 0.8, t);
    tineDepth.gain.exponentialRampToValueAtTime(1, t + 0.07);
    tine.connect(tineDepth).connect(carrier.frequency);

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(peak, t + 0.006);
    amp.gain.setTargetAtTime(peak * 0.3, t + 0.006, 0.7);
    amp.gain.setTargetAtTime(0.0001, t + duration, 0.25);
    carrier.connect(amp).connect(out);

    const end = t + duration + 1.5;
    for (const osc of [carrier, mod, tine]) {
      osc.start(t);
      osc.stop(end);
    }
  }

  /** Two detuned triangles through a lowpass, with a slow swell. */
  private pad(out: AudioNode, freq: number, t: number, duration: number, peak: number): void {
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.5;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(peak, t + 1.2);
    amp.gain.setTargetAtTime(0.0001, t + duration, 0.6);
    filter.connect(amp).connect(out);
    for (const detune of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + duration + 3);
    }
  }

  /** Sine with a quiet triangle an octave up, so it is audible on small speakers. */
  private bass(out: AudioNode, freq: number, t: number, duration: number, peak: number): void {
    const ctx = this.ctx;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(peak, t + 0.012);
    amp.gain.setTargetAtTime(peak * 0.6, t + 0.012, 0.4);
    amp.gain.setTargetAtTime(0.0001, t + duration, 0.08);
    amp.connect(out);
    const body = ctx.createOscillator();
    body.frequency.value = freq;
    body.connect(amp);
    const edge = ctx.createOscillator();
    edge.type = 'triangle';
    edge.frequency.value = freq * 2;
    const edgeGain = ctx.createGain();
    edgeGain.gain.value = 0.25;
    edge.connect(edgeGain).connect(amp);
    for (const osc of [body, edge]) {
      osc.start(t);
      osc.stop(t + duration + 0.6);
    }
  }
}

function ramp(param: AudioParam, value: number, now: number, seconds: number): void {
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(value, now + seconds);
}

/** Stereo noise with an exponential decay, from a fixed seed. */
function impulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  const random = createRandom(0x7e7e7e);
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      const decay = (1 - i / length) ** 3;
      data[i] = (random() * 2 - 1) * decay;
    }
  }
  return buffer;
}
