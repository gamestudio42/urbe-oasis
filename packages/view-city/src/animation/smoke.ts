import type { BuildingRecord } from '@city/shared';
import type { Theme } from '@theme/core';
import { chimneys } from '../chimneys';
import { adobeIndustrialVent, adobeVariant } from '../oasisArchitecture';
import type { Random } from './random';

export interface SmokeVent {
  /** Stable per chimney: building id × 4 + chimney index. */
  key: number;
  buildingId: number;
  /** Front tile of the building (its sprite stands on that tile's south corner). */
  frontX: number;
  frontY: number;
  /** Chimney top relative to the sprite origin, in pixels. */
  offsetX: number;
  offsetY: number;
  /** 0..1: heavy vents emit more and larger puffs. */
  strength: number;
}

type VentSource = Pick<
  BuildingRecord,
  | 'id'
  | 'kind'
  | 'x'
  | 'y'
  | 'w'
  | 'h'
  | 'level'
  | 'abandoned'
  | 'powered'
  | 'occupancy'
  | 'offline'
> &
  Partial<Pick<BuildingRecord, 'variant'>>;

/** Whether a building's chimneys are smoking: plants while online, industry while working. */
export function isSmoking(b: VentSource): boolean {
  switch (b.kind) {
    case 'coalPlant':
    case 'gasPlant':
      return b.offline === 0;
    case 'industrial':
      return !b.abandoned && b.powered && b.occupancy > 0 && b.level >= 3;
    default:
      return false;
  }
}

/** Chimney tops of every smoking building, in building order. */
export function smokeVents(buildings: Iterable<VentSource>, theme: Theme): SmokeVent[] {
  const vents: SmokeVent[] = [];
  for (const b of buildings) {
    if (!isSmoking(b)) continue;
    if (theme.style === 'adobe' && b.kind === 'industrial') {
      const tip = adobeIndustrialVent(b.level, adobeVariant(b.variant ?? 0, b.x, b.y));
      if (tip)
        vents.push({
          key: b.id * 4,
          buildingId: b.id,
          frontX: b.x + b.w - 1,
          frontY: b.y + b.h - 1,
          offsetX: tip.x,
          offsetY: tip.y,
          strength: 0.5,
        });
      continue;
    }
    chimneys(b.kind, Math.max(1, b.level), b.w, theme).forEach((c, k) => {
      if (c.smoke <= 0) return;
      vents.push({
        key: b.id * 4 + k,
        buildingId: b.id,
        frontX: b.x + b.w - 1,
        frontY: b.y + b.h - 1,
        offsetX: c.base.x,
        offsetY: c.base.y - c.height,
        strength: c.smoke,
      });
    });
  }
  return vents;
}

export interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  /** Size and opacity multiplier from the vent strength. */
  weight: number;
}

export const MAX_PUFFS = 300;
const PUFFS_PER_SECOND = 2.2;
const RISE = 16;
const WIND = 7;
const LIFE_MIN = 2.4;
const LIFE_SPREAD = 1.2;
/** Share of the puff budget the expected steady state may fill, leaving room for variance. */
const BUDGET_USE = 0.85;
/** Upper bound of the zoomed-out size boost. */
const MAX_ZOOM_BOOST = 2;

/**
 * Emission rate multiplier for a set of vents: 1 while the budget suffices, otherwise every
 * vent emits proportionally less so all chimneys in view keep smoking.
 */
export function emissionShare(strengths: readonly number[], maxPuffs = MAX_PUFFS): number {
  let demand = 0;
  for (const s of strengths) demand += PUFFS_PER_SECOND * s * (LIFE_MIN + LIFE_SPREAD / 2);
  const budget = maxPuffs * BUDGET_USE;
  return demand > budget ? budget / demand : 1;
}

/** Screen-space smoke particles; emission and motion use game time. */
export class SmokeSim {
  readonly puffs: Puff[] = [];
  private credit = new Map<number, number>();
  private turn = 0;

  constructor(
    private readonly random: Random,
    private readonly maxPuffs = MAX_PUFFS,
  ) {}

  clear(): void {
    this.puffs.length = 0;
    this.credit.clear();
    this.turn = 0;
  }

  /**
   * Emits from the given vent positions (already in screen space and in view) and moves the
   * puffs by `dt` seconds of game time.
   */
  step(
    vents: readonly { key: number; x: number; y: number; strength: number }[],
    dt: number,
  ): void {
    if (dt <= 0) return;
    let kept = 0;
    for (const p of this.puffs) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      this.puffs[kept++] = p;
    }
    this.puffs.length = kept;
    const share = emissionShare(
      vents.map((v) => v.strength),
      this.maxPuffs,
    );
    // When the cap is hit anyway, the vent served first rotates so no chimney is starved.
    const n = vents.length;
    const start = n > 0 ? this.turn++ % n : 0;
    for (let k = 0; k < n; k++) {
      const v = vents[(start + k) % n] as (typeof vents)[number];
      let credit =
        (this.credit.get(v.key) ?? this.random()) + dt * PUFFS_PER_SECOND * v.strength * share;
      while (credit >= 1 && this.puffs.length < this.maxPuffs) {
        credit -= 1;
        this.puffs.push({
          x: v.x + (this.random() - 0.5) * 3,
          y: v.y,
          vx: WIND * (0.6 + this.random() * 0.8),
          vy: -RISE * (0.8 + this.random() * 0.4),
          age: 0,
          life: LIFE_MIN + this.random() * LIFE_SPREAD,
          weight: 0.5 + v.strength * 0.5,
        });
      }
      this.credit.set(v.key, Math.min(credit, 1));
    }
  }
}

/** Size multiplier for zoomed-out views, so puffs shrink slower than the city around them. */
export function puffZoomBoost(zoom: number): number {
  return zoom >= 1 ? 1 : Math.min(MAX_ZOOM_BOOST, 1 / Math.sqrt(zoom));
}

/** Scale and opacity of a puff over its life (it grows and fades) at the given camera zoom. */
export function puffLook(p: Puff, zoom = 1): { scale: number; alpha: number } {
  const k = Math.min(1, p.age / p.life);
  const boost = puffZoomBoost(zoom);
  const alpha = 0.85 * (1 - k * k) * (k < 0.08 ? k / 0.08 : 1) * (0.6 + 0.4 * p.weight);
  return {
    scale: (0.45 + 1.2 * k) * p.weight * boost,
    alpha: Math.min(1, alpha * (1 + 0.25 * (boost - 1))),
  };
}
