import type { SimEvent } from '@city/shared';

export type OasisMoment = Extract<
  SimEvent,
  {
    type:
      | 'sandstorm'
      | 'springMoved'
      | 'caravanTrade'
      | 'caravanLeave'
      | 'waterStress'
      | 'canalCollapse';
  }
>;

export function isOasisMoment(event: SimEvent): event is OasisMoment {
  return [
    'sandstorm',
    'springMoved',
    'caravanTrade',
    'caravanLeave',
    'waterStress',
    'canalCollapse',
  ].includes(event.type);
}

export interface OasisSignal {
  event: OasisMoment;
  age: number;
}

/** Cosmetic seconds, independent of ticks and the simulation RNG. */
export const OASIS_EFFECT_SECONDS = 12;
export const OASIS_SIGNAL_LIMIT = 8;

/** Bounded visual state. Pausing freezes effects; disabling animation clears their backlog. */
export class OasisPresentation {
  signals: OasisSignal[] = [];
  stormAge = OASIS_EFFECT_SECONDS;
  protected = false;

  report(event: OasisMoment): void {
    this.signals = [...this.signals, { event, age: 0 }].slice(-OASIS_SIGNAL_LIMIT);
    if (event.type === 'sandstorm') {
      this.stormAge = 0;
      this.protected = event.blocked;
    }
  }

  clear(): void {
    this.signals = [];
    this.stormAge = OASIS_EFFECT_SECONDS;
  }

  advance(deltaMS: number, paused: boolean, enabled: boolean): void {
    if (!enabled) return this.clear();
    if (paused) return;
    if (this.signals.length === 0 && this.stormAge >= OASIS_EFFECT_SECONDS) return;
    // Do not replay minutes of visual effects after a background tab resumes.
    const seconds = Math.max(0, Math.min(deltaMS, 1000)) / 1000;
    this.stormAge = Math.min(OASIS_EFFECT_SECONDS, this.stormAge + seconds);
    for (const signal of this.signals) signal.age += seconds;
    this.signals = this.signals.filter((signal) => signal.age < OASIS_EFFECT_SECONDS);
  }

  get intensity(): number {
    const envelope = Math.min(this.stormAge / 1.5, (OASIS_EFFECT_SECONDS - this.stormAge) / 4, 1);
    return Math.max(0, envelope) * (this.protected ? 0.55 : 1);
  }
}
