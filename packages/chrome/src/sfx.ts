import { AudioGraph, Voice, type Voice as VoiceType } from './audio';

export type SfxRecipe = (voice: VoiceType) => void;

export interface DroneTone {
  freq: number;
  type: OscillatorType;
  gain: number;
}

const MIN_INTERVAL_MS = 120;

/** Shared SFX + a two-oscillator drone. Each game registers its own recipes. */
export class SfxBoard<T extends string> {
  private readonly graph: AudioGraph;
  private readonly recipes: Record<T, SfxRecipe>;
  private readonly lastPlayed = new Map<T, number>();
  private droneNodes: OscillatorNode[] = [];
  private droneBus: GainNode | null = null;
  private readonly unlockers = new AbortController();

  constructor(options: { mutedKey: string; recipes: Record<T, SfxRecipe>; volume?: number }) {
    this.graph = new AudioGraph({ mutedKey: options.mutedKey, volume: options.volume });
    this.recipes = options.recipes;
    if (typeof window !== 'undefined') {
      const signal = this.unlockers.signal;
      const unlock = () => this.unlock();
      window.addEventListener('pointerdown', unlock, { signal, once: true });
      window.addEventListener('keydown', unlock, { signal, once: true });
    }
  }

  get muted(): boolean {
    return this.graph.muted;
  }

  setMuted(muted: boolean): void {
    this.graph.setMuted(muted);
  }

  unlock(): void {
    this.graph.unlock();
  }

  play(name: T): void {
    if (this.graph.muted) return;
    const now = performance.now();
    const last = this.lastPlayed.get(name) ?? 0;
    if (now - last < MIN_INTERVAL_MS) return;
    this.lastPlayed.set(name, now);
    const ctx = this.graph.ensure();
    if (!ctx || !this.graph.sfx || !this.graph.noiseBuffer) return;
    this.unlock();
    this.recipes[name](new Voice(ctx, this.graph.sfx, this.graph.noiseBuffer));
  }

  startDrone(tones: readonly DroneTone[]): void {
    this.stopDrone();
    const ctx = this.graph.ensure();
    if (!ctx || !this.graph.master || tones.length === 0) return;
    this.unlock();
    const bus = ctx.createGain();
    bus.gain.value = 0.18;
    bus.connect(this.graph.master);
    for (const tone of tones) {
      const osc = ctx.createOscillator();
      osc.type = tone.type;
      osc.frequency.value = tone.freq;
      const gain = ctx.createGain();
      gain.gain.value = tone.gain;
      osc.connect(gain).connect(bus);
      osc.start();
      this.droneNodes.push(osc);
    }
    this.droneBus = bus;
  }

  stopDrone(): void {
    for (const osc of this.droneNodes) {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
      osc.disconnect();
    }
    this.droneNodes = [];
    this.droneBus?.disconnect();
    this.droneBus = null;
  }

  dispose(): void {
    this.unlockers.abort();
    this.stopDrone();
    this.graph.dispose();
  }
}
