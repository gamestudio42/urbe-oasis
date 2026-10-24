export function readFlag(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : stored === '1';
  } catch {
    return fallback;
  }
}

export function writeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // Private mode or disabled storage: the choice lasts for this session only.
  }
}

/** A stored level in 0..1, or the fallback when absent or malformed. */
export function readLevel(key: string, fallback: number): number {
  try {
    const stored = localStorage.getItem(key);
    const value = stored === null ? NaN : Number(stored);
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLevel(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(Math.min(1, Math.max(0, value))));
  } catch {
    // Private mode or disabled storage: the level lasts for this session only.
  }
}

export interface ToneSpec {
  type: OscillatorType;
  freq: number;
  /** Frequency at the end of the note (exponential glide). */
  to?: number;
  start?: number;
  duration: number;
  gain: number;
}

export interface NoiseSpec {
  filter: BiquadFilterType;
  freq: number;
  q?: number;
  start?: number;
  duration: number;
  gain: number;
}

export class Voice {
  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
    private readonly noiseBuffer: AudioBuffer,
  ) {}

  tone({ type, freq, to, start = 0, duration, gain }: ToneSpec): void {
    const t = this.ctx.currentTime + start;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(to, t + duration);
    osc.connect(this.envelope(t, duration, gain));
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  noise({ filter, freq, q = 1, start = 0, duration, gain }: NoiseSpec): void {
    const t = this.ctx.currentTime + start;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const biquad = this.ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.frequency.value = freq;
    biquad.Q.value = q;
    src.connect(biquad).connect(this.envelope(t, duration, gain));
    src.start(t, 0, duration + 0.05);
  }

  /** Short attack, exponential decay. */
  private envelope(t: number, duration: number, gain: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    g.connect(this.out);
    return g;
  }
}

export interface AudioGraphOptions {
  mutedKey: string;
  volume?: number;
  muted?: boolean;
}

/** Master + SFX buses and a deterministic noise buffer. Music attaches to `master`. */
export class AudioGraph {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfx: GainNode | null = null;
  noiseBuffer: AudioBuffer | null = null;
  private unavailable = false;
  muted: boolean;
  private readonly mutedKey: string;
  private readonly volume: number;
  /** Player levels on top of the fixed mix, 0..1; 1 keeps the designed balance. */
  private masterLevel = 1;
  private effectsLevel = 1;

  constructor(options: AudioGraphOptions) {
    this.mutedKey = options.mutedKey;
    this.volume = options.volume ?? 0.35;
    this.muted = options.muted ?? readFlag(options.mutedKey, false);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    writeFlag(this.mutedKey, muted);
    if (this.master) this.master.gain.value = this.masterGain();
    if (!muted) this.unlock();
  }

  setLevels(master: number, effects: number): void {
    this.masterLevel = master;
    this.effectsLevel = effects;
    if (this.master) this.master.gain.value = this.masterGain();
    if (this.sfx) this.sfx.gain.value = effects;
  }

  private masterGain(): number {
    return this.muted ? 0 : this.volume * this.masterLevel;
  }

  unlock(): void {
    if (this.muted) return;
    const ctx = this.ensure();
    if (ctx?.state === 'suspended') void ctx.resume();
  }

  ensure(): AudioContext | null {
    if (this.ctx || this.unavailable) return this.ctx;
    try {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = this.masterGain();
      master.connect(ctx.destination);
      const sfx = ctx.createGain();
      sfx.gain.value = this.effectsLevel;
      sfx.connect(master);
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let seed = 0x2545f491;
      for (let i = 0; i < data.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        data[i] = seed / 0x80000000 - 1;
      }
      this.ctx = ctx;
      this.master = master;
      this.sfx = sfx;
      this.noiseBuffer = buffer;
    } catch {
      this.unavailable = true;
    }
    return this.ctx;
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.noiseBuffer = null;
  }
}
