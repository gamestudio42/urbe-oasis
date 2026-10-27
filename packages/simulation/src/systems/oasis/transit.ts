import { OASIS_TRANSIT, type BuildingRecord } from '@city/shared';
import type { SimulationEngine } from '../../engine';
import type { RoadNetwork } from '../roads';
import { hubRoad, type PathTree } from '../traffic';

/**
 * Caravan routes (oasis ruleset).
 *
 * Each stop serves the road tiles within `stopRadius` of it. When a trip starts on a tile a stop
 * serves, that stop shares its road network with another stop (a route), and the trip's path ends
 * on a served tile, `riderShare` of it rides the caravans and leaves the road. Each stop boards at most `stopCapacity` riders a month; beyond
 * that, its riders are scaled down evenly. No random draws: stops are taken in building order
 * and the first stop to serve a tile keeps it. See docs/oasis-spec.md, "Caravan routes".
 */

export interface TransitCatchment {
  /** Per tile: 1 + index into `stops` of the stop serving it, or 0. */
  stopOf: Int32Array;
  stops: BuildingRecord[];
  /** Per stop (1-based, like `stopOf`): true when its road component has another stop. */
  onRoute: Uint8Array;
}

/** Stops in service: online and beside a road. */
export function transitCatchment(engine: SimulationEngine, roads: RoadNetwork): TransitCatchment {
  const w = engine.world;
  const stopOf = new Int32Array(w.tileCount);
  const stops: BuildingRecord[] = [];
  const components: number[] = [];
  const r = OASIS_TRANSIT.stopRadius;
  for (const b of engine.buildings.ofKind('caravanStop')) {
    const road = b.offline > 0 ? -1 : hubRoad(w, roads, b);
    if (road < 0) continue;
    stops.push(b);
    components.push(roads.componentOf(road));
    const id = stops.length;
    for (let y = Math.max(0, b.y - r); y <= Math.min(w.size - 1, b.y + r); y++) {
      for (let x = Math.max(0, b.x - r); x <= Math.min(w.size - 1, b.x + r); x++) {
        const i = w.index(x, y);
        if ((stopOf[i] as number) === 0) stopOf[i] = id;
      }
    }
  }
  // A route needs two stops on the same road network.
  const onRoute = new Uint8Array(stops.length + 1);
  for (let k = 0; k < stops.length; k++) {
    for (let j = 0; j < stops.length; j++) {
      if (j !== k && components[j] === components[k]) {
        onRoute[k + 1] = 1;
        break;
      }
    }
  }
  return { stopOf, stops, onRoute };
}

/** The tree's source at the end of the path from `start`, or -1 when it is unreachable. */
export function pathEnd(tree: PathTree, start: number): number {
  if (!Number.isFinite(tree.dist[start] as number)) return -1;
  let node = start;
  for (let next = tree.parent[node] as number; next >= 0; next = tree.parent[node] as number) {
    node = next;
  }
  return node;
}

/** A trip that may ride: its start, tree, full amount and the stop that boards it. */
export interface TransitTrip {
  start: number;
  tree: PathTree;
  amount: number;
  stop: number;
}

/**
 * The boarding stop of a trip, or 0 when it drives. Both ends must lie beside stops, and the
 * boarding stop must be on a route (another stop shares its road network).
 */
export function boardingStop(catchment: TransitCatchment, tree: PathTree, start: number): number {
  const from = catchment.stopOf[start] as number;
  if (from === 0 || catchment.onRoute[from] === 0) return 0;
  const end = pathEnd(tree, start);
  if (end < 0) return 0;
  return (catchment.stopOf[end] as number) !== 0 ? from : 0;
}

/**
 * Riders per trip after each stop's capacity, in trip order. Writes each stop's riders and
 * capacity on its record (occupancy / capacity), touching the ones that changed.
 */
export function boardRiders(
  engine: SimulationEngine,
  catchment: TransitCatchment,
  trips: readonly TransitTrip[],
): number[] {
  const n = catchment.stops.length;
  const wanted = new Float64Array(n + 1);
  for (const trip of trips) {
    wanted[trip.stop] = (wanted[trip.stop] as number) + trip.amount * OASIS_TRANSIT.riderShare;
  }
  const cap = OASIS_TRANSIT.stopCapacity;
  const scale = (stop: number) => {
    const want = wanted[stop] as number;
    return want > cap ? cap / want : 1;
  };
  const riders = new Map<number, number>();
  for (let k = 0; k < n; k++) {
    const stop = catchment.stops[k] as BuildingRecord;
    riders.set(stop.id, Math.round(Math.min(cap, wanted[k + 1] as number)));
  }
  // A stop out of service (buried, or cut from the roads) boards nobody.
  for (const stop of engine.buildings.ofKind('caravanStop')) {
    const boarded = riders.get(stop.id) ?? 0;
    if (stop.occupancy === boarded && stop.capacity === cap) continue;
    stop.occupancy = boarded;
    stop.capacity = cap;
    engine.buildings.touch(stop);
  }
  return trips.map((trip) => trip.amount * OASIS_TRANSIT.riderShare * scale(trip.stop));
}

/** Stops in service, riders boarded at the last traffic pass and the monthly capacity. */
export function transitSummary(engine: SimulationEngine): {
  stops: number;
  riders: number;
  capacity: number;
} {
  let stops = 0;
  let riders = 0;
  for (const b of engine.buildings.ofKind('caravanStop')) {
    if (b.offline > 0) continue;
    stops++;
    riders += b.occupancy;
  }
  return { stops, riders, capacity: stops * OASIS_TRANSIT.stopCapacity };
}
