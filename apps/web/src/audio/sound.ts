import { AudioGraph, readFlag, Voice, writeFlag } from '@shell/chrome';
import type { TrackId } from './composer';
import { MusicPlayer, type MusicState } from './music';

/**
 * Synthesized sound effects and music (WebAudio oscillators and filtered noise, no audio
 * assets). The AudioContext is created on the first user gesture, as browsers require.
 * Effects and music have their own buses into one master gain, so mute silences both.
 */
export type SoundName =
  'build' | 'zone' | 'demolish' | 'error' | 'warning' | 'fire' | 'disaster' | 'milestone';

const STORAGE_KEY = 'cityBuilder.muted';
const MUSIC_KEY = 'cityBuilder.music';
const MUSIC_VOLUME = 0.85;
/** The same effect is not replayed within this window (bursts of events or commands). */
const MIN_INTERVAL_MS = 120;

const RECIPES: Record<SoundName, (v: Voice) => void> = {
  build: (v) => {
    v.tone({ type: 'triangle', freq: 220, to: 110, duration: 0.12, gain: 0.5 });
    v.noise({ filter: 'lowpass', freq: 900, duration: 0.08, gain: 0.25 });
  },
  zone: (v) => {
    v.tone({ type: 'sine', freq: 660, duration: 0.18, gain: 0.25 });
    v.tone({ type: 'sine', freq: 990, start: 0.05, duration: 0.2, gain: 0.18 });
  },
  demolish: (v) => {
    v.noise({ filter: 'bandpass', freq: 420, q: 0.8, duration: 0.35, gain: 0.6 });
    v.tone({ type: 'sine', freq: 120, to: 40, duration: 0.3, gain: 0.45 });
  },
  error: (v) => {
    v.tone({ type: 'square', freq: 196, duration: 0.09, gain: 0.12 });
    v.tone({ type: 'square', freq: 147, start: 0.11, duration: 0.14, gain: 0.12 });
  },
  warning: (v) => {
    v.tone({ type: 'triangle', freq: 440, duration: 0.14, gain: 0.3 });
    v.tone({ type: 'triangle', freq: 330, start: 0.16, duration: 0.2, gain: 0.3 });
  },
  fire: (v) => {
    for (let k = 0; k < 4; k++) {
      v.tone({
        type: 'sawtooth',
        freq: k % 2 ? 900 : 700,
        start: k * 0.16,
        duration: 0.15,
        gain: 0.08,
      });
    }
  },
  disaster: (v) => {
    v.noise({ filter: 'lowpass', freq: 180, duration: 1.4, gain: 0.9 });
    v.tone({ type: 'sine', freq: 55, to: 35, duration: 1.2, gain: 0.5 });
  },
  milestone: (v) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, k) =>
      v.tone({ type: 'triangle', freq, start: k * 0.09, duration: 0.3, gain: 0.22 }),
    );
  },
};

export interface MusicStatus extends MusicState {
  enabled: boolean;
}

/** Minimal shape of a music engine so a reskin can inject its own composer. */
export interface MusicEngine {
  readonly state: MusicState;
  start(): void;
  stop(): void;
  setTrack(track: TrackId): void;
  setDucked(ducked: boolean): void;
  dispose(): void;
}

/** Builds a music engine on the shared audio graph (the Urbe lo-fi player by default). */
export type MusicFactory = (
  ctx: AudioContext,
  bus: GainNode,
  noise: AudioBuffer,
) => MusicEngine;

export class SoundBoard {
  private readonly graph = new AudioGraph({ mutedKey: STORAGE_KEY });
  private music: MusicEngine | null = null;
  private readonly musicFactory: MusicFactory;

  constructor(options: { music?: MusicFactory } = {}) {
    this.musicFactory =
      options.music ??
      ((ctx, bus, noise) => new MusicPlayer(ctx, bus, noise));
  }
  private musicOn = readFlag(MUSIC_KEY, true);
  private musicTrack: TrackId = 'menu';
  private musicDucked = false;
  private readonly lastPlayed = new Map<SoundName, number>();

  get muted(): boolean {
    return this.graph.muted;
  }

  get musicEnabled(): boolean {
    return this.musicOn;
  }

  setMuted(muted: boolean): void {
    this.graph.setMuted(muted);
    this.syncMusic();
  }

  setMusicEnabled(on: boolean): void {
    this.musicOn = on;
    writeFlag(MUSIC_KEY, on);
    if (on) this.unlock();
    this.syncMusic();
  }

  /** Track to play; switching crossfades. */
  setMusicTrack(track: TrackId): void {
    this.musicTrack = track;
    this.syncMusic();
  }

  /** Quieter and darker music, e.g. while the game is paused. */
  setMusicDucked(ducked: boolean): void {
    this.musicDucked = ducked;
    this.syncMusic();
  }

  musicStatus(): MusicStatus {
    const state = this.music?.state ?? {
      playing: false,
      track: this.musicTrack,
      ducked: this.musicDucked,
    };
    return { enabled: this.musicOn, ...state };
  }

  /** Creates or resumes the audio context; call it from a user gesture. */
  unlock(): void {
    this.graph.unlock();
    this.attachMusic();
    this.syncMusic();
  }

  play(name: SoundName): void {
    if (this.graph.muted) return;
    const ctx = this.graph.ensure();
    this.attachMusic();
    // A suspended context would queue the sound and play it late, after the gesture.
    if (!ctx || ctx.state !== 'running' || !this.graph.sfx || !this.graph.noiseBuffer) return;
    const now = ctx.currentTime * 1000;
    if (now - (this.lastPlayed.get(name) ?? Number.NEGATIVE_INFINITY) < MIN_INTERVAL_MS) return;
    this.lastPlayed.set(name, now);
    RECIPES[name](new Voice(ctx, this.graph.sfx, this.graph.noiseBuffer));
  }

  dispose(): void {
    this.music?.dispose();
    this.music = null;
    this.graph.dispose();
  }

  private attachMusic(): void {
    if (this.music || !this.graph.ctx || !this.graph.master || !this.graph.noiseBuffer) return;
    const musicBus = this.graph.ctx.createGain();
    musicBus.gain.value = MUSIC_VOLUME;
    musicBus.connect(this.graph.master);
    this.music = this.musicFactory(this.graph.ctx, musicBus, this.graph.noiseBuffer);
  }

  private syncMusic(): void {
    this.attachMusic();
    const music = this.music;
    if (!music) return;
    music.setTrack(this.musicTrack);
    music.setDucked(this.musicDucked);
    if (this.musicOn && !this.graph.muted) music.start();
    else music.stop();
  }
}
