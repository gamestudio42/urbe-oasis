import { directionBetween, reverse, routeBfs, type Dir, type RoadView } from './roads';
import type { Vehicle } from './vehicles';

export interface FireView extends RoadView {
  readonly fire: ArrayLike<number>;
  readonly fireCover: ArrayLike<number>;
}

export interface StationFootprint {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TruckState = 'driving' | 'working' | 'returning';

export interface FireTruck extends Vehicle {
  route: number[];
  index: number;
  state: TruckState;
  /** Burning tile the truck was sent to. */
  target: number;
  /** Seconds of game time spent parked at the fire. */
  worked: number;
}

export const MAX_TRUCKS = 4;
const TRUCK_SPEED = 2;
const SCAN_INTERVAL = 0.5;
/** Covered fires often go out within a few ticks; the truck still parks for this long. */
export const MIN_WORK_TIME = 2;
const MAX_REPORTS = 8;
const ROUTE_LIMIT = 48;
/** A truck parks on a road tile within this distance of the fire. */
const PARK_RADIUS = 3;
/** Fires closer than this to a truck's target belong to the same incident. */
const INCIDENT_RADIUS = 4;
/** The truck stays while anything burns this close to its target. */
const WORK_RADIUS = 2;
const ROUTE_ATTEMPTS_PER_SCAN = 6;

function chebyshev(size: number, a: number, b: number): number {
  return Math.max(
    Math.abs((a % size) - (b % size)),
    Math.abs(Math.floor(a / size) - Math.floor(b / size)),
  );
}

/** Road tiles touching a station footprint (including diagonals), in index order. */
export function stationAccess(view: RoadView, s: StationFootprint): number[] {
  const tiles: number[] = [];
  for (let y = s.y - 1; y <= s.y + s.h; y++) {
    for (let x = s.x - 1; x <= s.x + s.w; x++) {
      const inside = x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h;
      if (inside || x < 0 || y < 0 || x >= view.size || y >= view.size) continue;
      const i = y * view.size + x;
      if (view.hasRoad(i)) tiles.push(i);
    }
  }
  return tiles;
}

/** Road route from the nearest station to a road tile next to the fire, or null. */
export function dispatchRoute(
  view: RoadView,
  stations: readonly StationFootprint[],
  fireTile: number,
): number[] | null {
  const sources = [...new Set(stations.flatMap((s) => stationAccess(view, s)))].sort(
    (a, b) => a - b,
  );
  if (sources.length === 0) return null;
  return routeBfs(
    view,
    sources,
    (i) => chebyshev(view.size, i, fireTile) <= PARK_RADIUS,
    ROUTE_LIMIT,
  );
}

function burningNear(view: FireView, tile: number, radius: number): boolean {
  const size = view.size;
  const cx = tile % size;
  const cy = Math.floor(tile / size);
  for (let y = Math.max(0, cy - radius); y <= Math.min(size - 1, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x <= Math.min(size - 1, cx + radius); x++) {
      if ((view.fire[y * size + x] as number) > 0) return true;
    }
  }
  return false;
}

/**
 * Cosmetic fire engines. A fire covered by a station (`fireCover > 0`) and reachable by road
 * gets a truck that drives there, parks with its lights on until the fire is out, drives back
 * and disappears at the station. Fires are found by scanning the fire layer and through
 * `report()` (the simulation's fire events), since a well covered fire may be out before the
 * next scan. The simulation's fire rules do not depend on any of this.
 */
export class FireDispatch {
  readonly trucks: FireTruck[] = [];
  private readonly reported: number[] = [];
  private nextId = 1;
  private sinceScan = SCAN_INTERVAL;

  constructor(private readonly maxTrucks = MAX_TRUCKS) {}

  clear(): void {
    this.trucks.length = 0;
    this.reported.length = 0;
    this.sinceScan = SCAN_INTERVAL;
  }

  /** Queues a fire that started on `tile`; it is dispatched on the next scan, burning or not. */
  report(tile: number): void {
    if (this.reported.length < MAX_REPORTS && !this.reported.includes(tile)) {
      this.reported.push(tile);
    }
  }

  /** Advances by `dt` seconds of game time; nothing happens while paused. */
  step(view: FireView, stations: readonly StationFootprint[], dt: number): void {
    if (dt <= 0) return;
    this.sinceScan += dt;
    if (this.sinceScan >= SCAN_INTERVAL) {
      this.sinceScan = 0;
      this.scan(view, stations);
    }
    let kept = 0;
    for (const truck of this.trucks) {
      if (this.advance(view, truck, dt)) this.trucks[kept++] = truck;
    }
    this.trucks.length = kept;
  }

  private scan(view: FireView, stations: readonly StationFootprint[]): void {
    const reported = this.reported.splice(0);
    if (stations.length === 0) return;
    let attempts = 0;
    const tryDispatch = (i: number): boolean => {
      if (this.trucks.length >= this.maxTrucks || attempts >= ROUTE_ATTEMPTS_PER_SCAN) return false;
      if ((view.fireCover[i] as number) === 0 || this.handled(view.size, i)) return true;
      attempts++;
      const route = dispatchRoute(view, stations, i);
      if (route) this.dispatch(view.size, route, i);
      return true;
    };
    for (const i of reported) {
      if (i < view.fire.length && !tryDispatch(i)) return;
    }
    for (let i = 0; i < view.fire.length; i++) {
      if ((view.fire[i] as number) > 0 && !tryDispatch(i)) return;
    }
  }

  private handled(size: number, tile: number): boolean {
    return this.trucks.some(
      (t) => t.state !== 'returning' && chebyshev(size, t.target, tile) <= INCIDENT_RADIUS,
    );
  }

  private dispatch(size: number, route: number[], target: number): void {
    const dir =
      route.length > 1 ? directionBetween(size, route[0] as number, route[1] as number) : 0;
    this.trucks.push({
      id: this.nextId++,
      kind: 'fireTruck',
      color: 0,
      tile: route[0] as number,
      travelIn: dir,
      travelOut: dir,
      t: 0,
      speed: TRUCK_SPEED,
      route,
      index: 0,
      state: 'driving',
      target,
      worked: 0,
    });
  }

  /** Moves one truck; false when it must be removed. */
  private advance(view: FireView, truck: FireTruck, dt: number): boolean {
    if (!view.hasRoad(truck.tile)) return false;
    if (truck.state === 'working') {
      truck.worked += dt;
      if (truck.worked >= MIN_WORK_TIME && !burningNear(view, truck.target, WORK_RADIUS)) {
        this.headBack(view.size, truck);
      }
      return true;
    }
    truck.t += dt * truck.speed;
    const last = truck.route.length - 1;
    for (;;) {
      if (truck.index === last) {
        if (truck.state === 'returning') return truck.t < 1;
        if (truck.t >= 0.5) {
          truck.t = 0.5;
          truck.state = 'working';
        }
        return true;
      }
      if (truck.t < 1) return true;
      truck.index++;
      truck.tile = truck.route[truck.index] as number;
      if (!view.hasRoad(truck.tile)) return false;
      truck.t -= 1;
      truck.travelIn = truck.travelOut;
      truck.travelOut =
        truck.index < last
          ? directionBetween(view.size, truck.tile, truck.route[truck.index + 1] as number)
          : truck.travelIn;
    }
  }

  private headBack(size: number, truck: FireTruck): void {
    truck.route = [...truck.route].reverse();
    truck.index = 0;
    truck.tile = truck.route[0] as number;
    const dir: Dir =
      truck.route.length > 1
        ? directionBetween(size, truck.route[0] as number, truck.route[1] as number)
        : reverse(truck.travelIn);
    truck.travelIn = dir;
    truck.travelOut = dir;
    truck.t = 0.5;
    truck.state = 'returning';
  }
}
