import { nextDirection, neighbour, roadExits, type Dir, type RoadView } from './roads';
import { pickWeighted, type Random } from './random';

export type VehicleKind = 'car' | 'truck' | 'fireTruck';

export interface Vehicle {
  id: number;
  kind: VehicleKind;
  /** Body colour index (cars). */
  color: number;
  /** Tile index the vehicle is on. */
  tile: number;
  travelIn: Dir;
  travelOut: Dir;
  /** Progress through the tile, 0..1. */
  t: number;
  /** Tiles per second of game time on a free road. */
  speed: number;
}

export const CAR_COLORS = 6;
export const MAX_CARS = 250;
const CAR_SPEED = 1.4;
const TRUCK_SPEED = 1.05;
const TRUCK_SHARE = 0.15;
/** Cars a road tile shows as soon as it carries any traffic. */
const BASE_DENSITY = 0.15;
const MAX_DENSITY = 0.6;
const SPAWN_PER_POPULATE = 8;
const RETIRE_PER_POPULATE = 3;

/** Cars expected on a road tile with the given simulated traffic (0..255). */
export function carDensity(traffic: number): number {
  if (traffic <= 0) return 0;
  return Math.min(MAX_DENSITY, BASE_DENSITY + (0.9 * traffic) / 255);
}

/** Speed factor on a tile: congested roads are slower. */
export function congestionSpeed(traffic: number): number {
  return 1 - (0.5 * Math.min(255, traffic)) / 255;
}

/**
 * Cosmetic cars driving on the visible roads. The number of cars follows the simulated traffic
 * of the candidate tiles; cars leave when their road disappears or they drive out of view.
 */
export class VehicleSim {
  readonly vehicles: Vehicle[] = [];
  private nextId = 1;

  constructor(
    private readonly random: Random,
    private readonly maxCars = MAX_CARS,
  ) {}

  clear(): void {
    this.vehicles.length = 0;
  }

  /** Advances every car by `dt` seconds of game time (0 while paused). */
  step(view: RoadView, dt: number, visible: (tile: number) => boolean): void {
    let kept = 0;
    for (const v of this.vehicles) {
      if (this.advance(view, v, dt, visible)) this.vehicles[kept++] = v;
    }
    this.vehicles.length = kept;
  }

  /**
   * Spawns or retires a few cars so the count drifts towards the traffic-driven target of the
   * candidate tiles (the visible road tiles).
   */
  populate(view: RoadView, candidates: readonly number[]): void {
    const weights = new Float64Array(candidates.length);
    let total = 0;
    for (let k = 0; k < candidates.length; k++) {
      const w = carDensity(view.traffic[candidates[k] as number] as number);
      weights[k] = w;
      total += w;
    }
    const target = Math.min(this.maxCars, Math.round(total));
    if (this.vehicles.length > target) {
      const extra = Math.min(RETIRE_PER_POPULATE, this.vehicles.length - target);
      for (let k = 0; k < extra; k++) {
        this.vehicles.splice(Math.floor(this.random() * this.vehicles.length), 1);
      }
      return;
    }
    const missing = Math.min(SPAWN_PER_POPULATE, target - this.vehicles.length);
    for (let k = 0; k < missing; k++) {
      const pick = pickWeighted(weights, total, this.random);
      if (pick < 0) break;
      this.spawn(view, candidates[pick] as number);
    }
  }

  private spawn(view: RoadView, tile: number): void {
    const exits = roadExits(view, tile);
    if (exits.length === 0) return;
    const dir = exits[Math.floor(this.random() * exits.length)] as Dir;
    const truck = this.random() < TRUCK_SHARE;
    this.vehicles.push({
      id: this.nextId++,
      kind: truck ? 'truck' : 'car',
      color: Math.floor(this.random() * CAR_COLORS),
      tile,
      travelIn: dir,
      travelOut: dir,
      t: this.random(),
      speed: (truck ? TRUCK_SPEED : CAR_SPEED) * (0.85 + this.random() * 0.3),
    });
  }

  /** Moves one car; false when it must be removed. */
  private advance(
    view: RoadView,
    v: Vehicle,
    dt: number,
    visible: (tile: number) => boolean,
  ): boolean {
    if (!view.hasRoad(v.tile)) return false;
    v.t += dt * v.speed * congestionSpeed(view.traffic[v.tile] as number);
    while (v.t >= 1) {
      const next = neighbour(view.size, v.tile, v.travelOut);
      if (next < 0 || !view.hasRoad(next) || !visible(next)) return false;
      v.tile = next;
      v.travelIn = v.travelOut;
      const out = nextDirection(view, next, v.travelIn, this.random);
      if (out === -1) return false;
      v.travelOut = out;
      v.t -= 1;
    }
    return true;
  }
}
