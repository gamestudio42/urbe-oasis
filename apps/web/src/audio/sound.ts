import { AudioGraph, readFlag, readLevel, Voice, writeFlag, writeLevel } from '@shell/chrome';
import type { TrackId } from './composer';
import { MusicPlayer, type MusicState } from './music';

/**
 * Synthesized sound effects and music (WebAudio oscillators and filtered noise, no audio
 * assets). The AudioContext is created on the first user gesture, as browsers require.
 * Effects and music have their own buses into one master gain, so mute silences both.
 */
export type SoundName =
  | 'build'
  | 'zone'
  | 'demolish'
  | 'error'
  | 'warning'
  | 'fire'
  | 'disaster'
  | 'milestone'
  | 'sandstorm'
  | 'spring';

const STORAGE_KEY = 'cityBuilder.muted';
const MUSIC_KEY = 'cityBuilder.music';
const MUSIC_VOLUME = 0.85;
/** The same effect is not replayed within this window (bursts of events or commands). */
const MIN_INTERVAL_MS = 120;

const RECIPES: Record<SoundName, (v: Voice) => void> = {
  sandstorm: (v) => {
    // The shared noise buffer is one second long; layer short gusts rather than truncate it.
    v.noise({ filter: 'bandpass', freq: 380, q: 0.45, duration: 0.8, gain: 0.28 });
    v.noise({ filter: 'lowpass', freq: 950, start: 0.35, duration: 0.9, gain: 0.18 });
    v.noise({ filter: 'bandpass', freq: 620, q: 0.6, start: 0.8, duration: 0.85, gain: 0.12 });
  },
  spring: (v) => {
    v.tone({ type: 'sine', freq: 784, to: 523, duration: 0.5, gain: 0.12 });
    v.tone({ type: 'sine', freq: 1047, to: 784, start: 0.16, duration: 0.7, gain: 0.09 });
  },
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

/** What the city sounds like; engines without moods ignore it. */
export type MusicMood = 'calm' | 'prosperous' | 'scarce' | 'storm';

/** Player volume per bus, 0..1. */
export interface AudioLevels {
  master: number;
  music: number;
  effects: number;
}

export interface MusicStatus extends MusicState {
  enabled: boolean;
  mood: MusicMood;
}

/** Minimal shape of a music engine so a reskin can inject its own composer. */
export interface MusicEngine {
  readonly state: MusicState;
  start(): void;
  stop(): void;
  setTrack(track: TrackId): void;
  setDucked(ducked: boolean): void;
  /** Optional: reshape the score for the city's situation. */
  setMood?(mood: MusicMood): void;
  dispose(): void;
}

/** Builds a music engine on the shared audio graph (the Urbe lo-fi player by default). */
export type MusicFactory = (ctx: AudioContext, bus: GainNode, noise: AudioBuffer) => MusicEngine;

export class SoundBoard {
  private readonly graph: AudioGraph;
  private readonly musicKey: string;
  private musicOn: boolean;
  private music: MusicEngine | null = null;
  private readonly musicFactory: MusicFactory;
  /** Volume preferences exist only for a scoped (sibling) game; the classic mix is fixed. */
  private readonly levelKey: string | null;
  private levelsNow: AudioLevels = { master: 1, music: 1, effects: 1 };
  private musicBus: GainNode | null = null;
  private musicMood: MusicMood = 'calm';

  constructor(options: { music?: MusicFactory; preferenceScope?: string } = {}) {
    const scope = options.preferenceScope;
    this.graph = new AudioGraph({ mutedKey: scope ? `${scope}.muted` : STORAGE_KEY });
    this.musicKey = scope ? `${scope}.music` : MUSIC_KEY;
    this.musicOn = readFlag(this.musicKey, true);
    this.levelKey = scope ? `${scope}.volume` : null;
    if (this.levelKey) {
      this.levelsNow = {
        master: readLevel(`${this.levelKey}.master`, 1),
        music: readLevel(`${this.levelKey}.music`, 1),
        effects: readLevel(`${this.levelKey}.effects`, 1),
      };
      this.graph.setLevels(this.levelsNow.master, this.levelsNow.effects);
    }
    this.musicFactory = options.music ?? ((ctx, bus, noise) => new MusicPlayer(ctx, bus, noise));
  }
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
    writeFlag(this.musicKey, on);
    if (on) this.unlock();
    this.syncMusic();
  }

  get levels(): AudioLevels {
    return { ...this.levelsNow };
  }

  /** Sets one bus level (0..1) and remembers it for a scoped game. */
  setLevel(bus: keyof AudioLevels, value: number): void {
    const level = Math.min(1, Math.max(0, value));
    this.levelsNow = { ...this.levelsNow, [bus]: level };
    if (this.levelKey) writeLevel(`${this.levelKey}.${bus}`, level);
    this.graph.setLevels(this.levelsNow.master, this.levelsNow.effects);
    if (this.musicBus) this.musicBus.gain.value = MUSIC_VOLUME * this.levelsNow.music;
  }

  /** The city's situation; an engine without moods keeps playing as before. */
  setMusicMood(mood: MusicMood): void {
    if (mood === this.musicMood) return;
    this.musicMood = mood;
    this.music?.setMood?.(mood);
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
    return { enabled: this.musicOn, ...state, mood: this.musicMood };
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
    this.musicBus = null;
    this.graph.dispose();
  }

  private attachMusic(): void {
    if (this.music || !this.graph.ctx || !this.graph.master || !this.graph.noiseBuffer) return;
    const musicBus = this.graph.ctx.createGain();
    musicBus.gain.value = MUSIC_VOLUME * this.levelsNow.music;
    musicBus.connect(this.graph.master);
    this.musicBus = musicBus;
    this.music = this.musicFactory(this.graph.ctx, musicBus, this.graph.noiseBuffer);
    this.music.setMood?.(this.musicMood);
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
