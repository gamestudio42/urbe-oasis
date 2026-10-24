import { nextDirection, neighbour, roadExits, type Dir, type RoadView } from './roads';
import { pickWeighted, type Random } from './random';

/**
 * Cosmetic pedestrians on the sidewalks of the adobe city. Like the cars, they only read the
 * mirror world: the number on a street follows the occupied lots beside it, shops and markets
 * draw more people, and nobody walks while the city is paused.
 */
export interface Walker {
  id: number;
  /** Robe colour index. */
  robe: number;
  tile: number;
  travelIn: Dir;
  travelOut: Dir;
  /** Progress through the tile, 0..1. */
  t: number;
  /** Tiles per second of game time. */
  speed: number;
  /** Game seconds left standing still (browsing a stall, greeting a neighbour). */
  pause: number;
  /** Which sidewalk: 1 the right-hand side of travel, -1 the left. */
  side: 1 | -1;
}

/** What the walkers need to know about the lots beside each street. */
export interface StreetLife extends RoadView {
  /** People a road tile draws, from the occupied lots around it (0 when none). */
  readonly footfall: ArrayLike<number>;
  /** Road tiles beside a shop or market, where people stop. */
  readonly stalls: ArrayLike<number>;
}

export const WALKER_ROBES = 4;
export const MAX_WALKERS = 220;
/** Sidewalk lane, outside the road surface (half width 0.28) and inside the lot edge. */
export const SIDEWALK_OFFSET = 0.37;
const WALK_SPEED = 0.32;
const MAX_DENSITY = 0.9;
const SPAWN_PER_POPULATE = 10;
const RETIRE_PER_POPULATE = 4;
const STALL_STOP_CHANCE = 0.35;
const STOP_SECONDS = [1.2, 3.5] as const;

/** Pedestrians expected on a road tile with the given footfall. */
export function walkerDensity(footfall: number): number {
  return footfall <= 0 ? 0 : Math.min(MAX_DENSITY, footfall);
}

export class WalkerSim {
  readonly walkers: Walker[] = [];
  private nextId = 1;

  constructor(
    private readonly random: Random,
    private readonly maxWalkers = MAX_WALKERS,
  ) {}

  clear(): void {
    this.walkers.length = 0;
  }

  /** Advances every walker by `dt` seconds of game time (0 while paused). */
  step(view: StreetLife, dt: number, visible: (tile: number) => boolean): void {
    let kept = 0;
    for (const w of this.walkers) if (this.advance(view, w, dt, visible)) this.walkers[kept++] = w;
    this.walkers.length = kept;
  }

  /** Drifts the walker count towards the footfall of the candidate (visible road) tiles. */
  populate(view: StreetLife, candidates: readonly number[]): void {
    const weights = new Float64Array(candidates.length);
    let total = 0;
    for (let k = 0; k < candidates.length; k++) {
      const w = walkerDensity(view.footfall[candidates[k] as number] as number);
      weights[k] = w;
      total += w;
    }
    const target = Math.min(this.maxWalkers, Math.round(total));
    if (this.walkers.length > target) {
      const extra = Math.min(RETIRE_PER_POPULATE, this.walkers.length - target);
      for (let k = 0; k < extra; k++)
        this.walkers.splice(Math.floor(this.random() * this.walkers.length), 1);
      return;
    }
    const missing = Math.min(SPAWN_PER_POPULATE, target - this.walkers.length);
    for (let k = 0; k < missing; k++) {
      const pick = pickWeighted(weights, total, this.random);
      if (pick < 0) break;
      this.spawn(view, candidates[pick] as number);
    }
  }

  private spawn(view: StreetLife, tile: number): void {
    const exits = roadExits(view, tile);
    if (exits.length === 0) return;
    const dir = exits[Math.floor(this.random() * exits.length)] as Dir;
    this.walkers.push({
      id: this.nextId++,
      robe: Math.floor(this.random() * WALKER_ROBES),
      tile,
      travelIn: dir,
      travelOut: dir,
      t: this.random(),
      speed: WALK_SPEED * (0.75 + this.random() * 0.5),
      pause: 0,
      side: this.random() < 0.5 ? 1 : -1,
    });
  }

  private advance(
    view: StreetLife,
    w: Walker,
    dt: number,
    visible: (tile: number) => boolean,
  ): boolean {
    if (!view.hasRoad(w.tile)) return false;
    if (w.pause > 0) {
      w.pause = Math.max(0, w.pause - dt);
      return true;
    }
    const before = w.t;
    w.t += dt * w.speed;
    // Stop once, half-way along a tile that fronts a stall.
    if (before < 0.5 && w.t >= 0.5 && (view.stalls[w.tile] as number) > 0 && dt > 0) {
      if (this.random() < STALL_STOP_CHANCE) {
        w.t = 0.5;
        w.pause = STOP_SECONDS[0] + this.random() * (STOP_SECONDS[1] - STOP_SECONDS[0]);
        return true;
      }
    }
    while (w.t >= 1) {
      const next = neighbour(view.size, w.tile, w.travelOut);
      if (next < 0 || !view.hasRoad(next) || !visible(next)) return false;
      w.tile = next;
      w.travelIn = w.travelOut;
      const out = nextDirection(view, next, w.travelIn, this.random);
      if (out === -1) return false;
      w.travelOut = out;
      w.t -= 1;
    }
    return true;
  }
}
