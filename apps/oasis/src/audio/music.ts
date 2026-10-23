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
 * Desert music for Urbe Oasis: sine bass, triangle pad, lead and arpeggio, scheduled ahead
 * on the AudioContext clock. Bars come
 * from `composeBar`, so the music is deterministic for a seed.
 */

const TICK_MS = 200;
const LOOKAHEAD_S = 1.2;
const CROSSFADE_S = 2;
const FADE_IN_S = 2.5;
const FADE_OUT_S = 0.8;
/** Level into the shared music bus. The board still applies its own master gain. */
const MASTER_LEVEL = 0.5;
/** Paused: about −6 dB and a darker filter. */
const DUCK_GAIN = 0.5;
const DUCK_CUTOFF = 900;
const OPEN_CUTOFF = 6400;
const DUCK_TIME_S = 0.35;
const REVERB_SECONDS = 3.2;
const DELAY_S = 0.36;
const DELAY_FEEDBACK = 0.38;
const CHANNEL_TAIL_MS = 6000;

const TRACK_SEEDS: Record<TrackId, number> = { menu: 0x4e0e01, city: 0x4e0e02 };

/** Dry level and sends per voice. */
const MIX: Record<VoiceId, { level: number; reverb: number; delay: number; wave: OscillatorType }> =
  {
    bass: { level: 0.7, reverb: 0.2, delay: 0, wave: 'sine' },
    pad: { level: 0.45, reverb: 0.75, delay: 0, wave: 'triangle' },
    lead: { level: 0.22, reverb: 0.55, delay: 0.35, wave: 'triangle' },
    arp: { level: 0.22, reverb: 0.4, delay: 0.3, wave: 'triangle' },
  };
const VOICES = Object.keys(MIX) as VoiceId[];

interface Channel {
  track: TrackId;
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

export class OasisMusic {
  /** Destination bus owned by the shared `SoundBoard`. */
  private readonly destination: AudioNode;
  /** Context the bus belongs to; a second one would refuse to connect. */
  private readonly sharedContext: AudioContext;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private delay: DelayNode | null = null;
  private reverb: ConvolverNode | null = null;
  private channel: Channel | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private enabled = false;
  private ducked = false;

  constructor(context: AudioContext, destination: AudioNode) {
    this.sharedContext = context;
    this.destination = destination;
  }

  get state(): MusicState {
    return {
      playing: this.enabled && this.context !== null,
      track: this.channel?.track ?? 'menu',
      ducked: this.ducked,
    };
  }

  /** Starts the graph on the first gesture; browsers refuse to autoplay before one. */
  async start(track: TrackId): Promise<void> {
    this.enabled = true;
    await this.ensureContext();
    if (!this.context || !this.master) return;
    await this.context.resume();
    this.crossfade(track);
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setValueAtTime(0.0001, this.context.currentTime);
    this.master.gain.exponentialRampToValueAtTime(MASTER_LEVEL, this.context.currentTime + FADE_IN_S);
    if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  stop(): void {
    this.enabled = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const ctx = this.context;
    const master = this.master;
    if (!ctx || !master) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + FADE_OUT_S);
    const dying = this.channel;
    this.channel = null;
    setTimeout(() => {
      if (!dying) return;
      for (const bus of Object.values(dying.buses)) bus.disconnect();
    }, CHANNEL_TAIL_MS);
  }

  /** Pauses duck the music instead of stopping it. */
  setPaused(paused: boolean): void {
    if (this.ducked === paused) return;
    this.ducked = paused;
    const ctx = this.context;
    if (!ctx || !this.master || !this.filter) return;
    const now = ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(paused ? MASTER_LEVEL * DUCK_GAIN : MASTER_LEVEL, now, DUCK_TIME_S);
    this.filter.frequency.setTargetAtTime(paused ? DUCK_CUTOFF : OPEN_CUTOFF, now, DUCK_TIME_S);
  }

  setTrack(track: TrackId): void {
    if (!this.enabled || !this.context || this.channel?.track === track) return;
    this.crossfade(track);
  }

  private async ensureContext(): Promise<void> {
    if (this.context) return;
    const ctx = this.sharedContext;
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = OPEN_CUTOFF;
    filter.connect(master);
    master.connect(this.destination);

    const delay = ctx.createDelay(1);
    delay.delayTime.value = DELAY_S;
    const feedback = ctx.createGain();
    feedback.gain.value = DELAY_FEEDBACK;
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(filter);

    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, REVERB_SECONDS);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    reverb.connect(wet);
    wet.connect(filter);

    this.context = ctx;
    this.master = master;
    this.filter = filter;
    this.delay = delay;
    this.reverb = reverb;
  }

  private crossfade(track: TrackId): void {
    const ctx = this.context;
    const filter = this.filter;
    const delay = this.delay;
    const reverb = this.reverb;
    if (!ctx || !filter || !delay || !reverb) return;
    const previous = this.channel;
    if (previous) {
      for (const bus of Object.values(previous.buses)) {
        bus.gain.cancelScheduledValues(ctx.currentTime);
        bus.gain.setTargetAtTime(0, ctx.currentTime, CROSSFADE_S / 3);
      }
      setTimeout(() => {
        for (const bus of Object.values(previous.buses)) bus.disconnect();
      }, CHANNEL_TAIL_MS);
    }
    const buses = {} as Record<VoiceId, GainNode>;
    for (const voice of VOICES) {
      const bus = ctx.createGain();
      bus.gain.value = MIX[voice].level;
      bus.connect(filter);
      if (MIX[voice].reverb > 0) {
        const send = ctx.createGain();
        send.gain.value = MIX[voice].reverb;
        bus.connect(send);
        send.connect(reverb);
      }
      if (MIX[voice].delay > 0) {
        const send = ctx.createGain();
        send.gain.value = MIX[voice].delay;
        bus.connect(send);
        send.connect(delay);
      }
      buses[voice] = bus;
    }
    this.channel = {
      track,
      buses,
      random: createRandom(TRACK_SEEDS[track]),
      bar: 0,
      nextBarTime: ctx.currentTime + 0.1,
    };
  }

  private tick(): void {
    const ctx = this.context;
    const channel = this.channel;
    if (!ctx || !channel || !this.enabled) return;
    const now = ctx.currentTime;
    // After a suspended context or a throttled tab, restart from now instead of catching up.
    if (channel.nextBarTime < now) channel.nextBarTime = now + 0.05;
    const spec = TRACKS[channel.track];
    const barLength = (BEATS_PER_BAR * 60) / spec.bpm;
    while (channel.nextBarTime < now + LOOKAHEAD_S) {
      const notes = composeBar(spec, channel.bar, channel.random);
      for (const note of notes) this.schedule(channel, note, barLength);
      channel.bar++;
      channel.nextBarTime += barLength;
    }
  }

  private schedule(channel: Channel, note: NoteEvent, barLength: number): void {
    const ctx = this.context;
    if (!ctx) return;
    const beatSeconds = barLength / BEATS_PER_BAR;
    const start = channel.nextBarTime + note.beat * beatSeconds;
    const duration = Math.max(0.05, note.duration * beatSeconds);
    const mix = MIX[note.voice];
    const bus = channel.buses[note.voice];
    const osc = ctx.createOscillator();
    osc.type = mix.wave;
    osc.frequency.value = midiToHz(note.midi);
    // A second detuned oscillator thickens the pad and the lead, the synthwave "wide" sound.
    const detuned = note.voice === 'pad' || note.voice === 'lead';
    const env = ctx.createGain();
    const peak = note.velocity * (detuned ? 0.5 : 0.8);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(peak, start + (detuned ? 0.18 : 0.008));
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env);
    env.connect(bus);
    osc.start(start);
    osc.stop(start + duration + 0.05);
    if (detuned) {
      const second = ctx.createOscillator();
      second.type = mix.wave;
      second.frequency.value = midiToHz(note.midi);
      second.detune.value = note.voice === 'pad' ? 11 : -9;
      const secondEnv = ctx.createGain();
      secondEnv.gain.setValueAtTime(0.0001, start);
      secondEnv.gain.exponentialRampToValueAtTime(peak * 0.7, start + 0.2);
      secondEnv.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      second.connect(secondEnv);
      secondEnv.connect(bus);
      second.start(start);
      second.stop(start + duration + 0.05);
    }
  }
}

/** Short algorithmic noise tail used as a reverb impulse. */
function impulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  let seed = 0x9e3779b9;
  const next = (): number => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) / 4294967296) * 2 - 1;
  };
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const decay = (1 - i / length) ** 2.6;
      data[i] = next() * decay * 0.6;
    }
  }
  return buffer;
}
