import {
  BALANCE,
  Infra,
  PLACEABLE_SPECS,
  ZoneType,
  isZoneKind,
  type BuildingRecord,
  type PlaceableKind,
} from '@city/shared';
import type { SimulationEngine } from '../engine';
import { arcadeRelief } from './oasis/airTraffic';
import type { World } from '../world/world';
import { MinHeap } from './heap';
import type { RoadNetwork } from './roads';

/** Aggregates per road component (index = component id). */
export interface ComponentStats {
  residents: Float64Array;
  commercialJobs: Float64Array;
  industrialJobs: Float64Array;
  /** Zoned tiles with road access per component, developed or not (trip destinations). */
  residentialZones: Float64Array;
  jobZones: Float64Array;
  edge: Uint8Array;
}

export interface PathTree {
  /** Float64 on purpose: keys pushed to the heap must compare exactly with stored distances. */
  dist: Float64Array;
  parent: Int32Array;
}

export interface TrafficResult {
  avgCongestion: number;
  /** Shortest-path trees from job sites, homes and shops (kept for diagnostics). */
  jobs: PathTree;
  homes: PathTree;
  shops: PathTree;
  components: ComponentStats;
}

/** A hub that operates: powered, intact and with jobs. */
export function isOperatingHub(b: BuildingRecord): boolean {
  if (isZoneKind(b.kind)) return false;
  return PLACEABLE_SPECS[b.kind].jobs > 0 && b.powered && b.offline === 0;
}

/**
 * Road tiles beside operating gateway hubs (airport, marina). Each one links its road component
 * to the region like a road leaving the map: external jobs and workers arrive there.
 */
export function gatewayRoads(
  world: World,
  roads: RoadNetwork,
  buildings: Iterable<BuildingRecord>,
): number[] {
  const list: number[] = [];
  for (const b of buildings) {
    if (!isOperatingHub(b) || !PLACEABLE_SPECS[b.kind as PlaceableKind].gateway) continue;
    const road = hubRoad(world, roads, b);
    if (road >= 0) list.push(road);
  }
  return list;
}

/** `roads.edgeConnected`, plus the components reached by a gateway road. */
export function regionalComponents(roads: RoadNetwork, gateways: readonly number[]): Uint8Array {
  if (gateways.length === 0) return roads.edgeConnected;
  const edge = roads.edgeConnected.slice();
  for (const g of gateways) edge[roads.componentOf(g)] = 1;
  return edge;
}

export function componentStats(engine: SimulationEngine, roads: RoadNetwork): ComponentStats {
  const n = roads.componentCount + 1;
  const w = engine.world;
  const stats: ComponentStats = {
    residents: new Float64Array(n),
    commercialJobs: new Float64Array(n),
    industrialJobs: new Float64Array(n),
    residentialZones: new Float64Array(n),
    jobZones: new Float64Array(n),
    edge: regionalComponents(roads, gatewayRoads(w, roads, engine.buildings.values())),
  };
  for (let i = 0; i < w.tileCount; i++) {
    const zone = w.zone[i] as ZoneType;
    if (zone === ZoneType.None) continue;
    const c = roads.componentOf(i);
    if (c === 0) continue;
    if (zone === ZoneType.Residential)
      stats.residentialZones[c] = (stats.residentialZones[c] as number) + 1;
    else stats.jobZones[c] = (stats.jobZones[c] as number) + 1;
  }
  for (const b of engine.buildings.values()) {
    if (!isZoneKind(b.kind) || b.abandoned) continue;
    const c = roads.componentOf(w.index(b.x, b.y));
    if (c === 0) continue;
    if (b.kind === 'residential') stats.residents[c] = (stats.residents[c] as number) + b.occupancy;
    else if (b.kind === 'commercial')
      stats.commercialJobs[c] = (stats.commercialJobs[c] as number) + b.capacity;
    else stats.industrialJobs[c] = (stats.industrialJobs[c] as number) + b.capacity;
  }
  for (const b of engine.buildings.values()) {
    if (!isOperatingHub(b)) continue;
    const road = hubRoad(w, roads, b);
    if (road < 0) continue;
    const c = roads.componentOf(road);
    stats.jobZones[c] = (stats.jobZones[c] as number) + 1;
    const spec = PLACEABLE_SPECS[b.kind as PlaceableKind];
    if (spec.jobKind === 'commercial')
      stats.commercialJobs[c] = (stats.commercialJobs[c] as number) + b.occupancy;
    else if (spec.jobKind === 'industrial')
      stats.industrialJobs[c] = (stats.industrialJobs[c] as number) + b.occupancy;
  }
  return stats;
}

/** First road tile orthogonally beside the footprint that belongs to a component, or -1. */
export function hubRoad(
  world: World,
  roads: RoadNetwork,
  b: { x: number; y: number; w: number; h: number },
): number {
  for (let y = b.y - 1; y <= b.y + b.h; y++) {
    for (let x = b.x - 1; x <= b.x + b.w; x++) {
      const outsideX = x < b.x || x >= b.x + b.w;
      const outsideY = y < b.y || y >= b.y + b.h;
      if (outsideX === outsideY) continue;
      if (!world.inBounds(x, y)) continue;
      const i = world.index(x, y);
      if (!world.hasInfra(i, Infra.Road)) continue;
      if (roads.componentOf(i) !== 0) return i;
    }
  }
  return -1;
}

/**
 * Trip generation succeeds when the tile's road component reaches a destination zone: job zones
 * for homes, residential zones for job sites, or the region through a map-edge road. Empty zones
 * count, so the first buildings of a new city can appear before any job exists.
 */
export function hasDestination(
  stats: ComponentStats,
  roads: RoadNetwork,
  i: number,
  zone: ZoneType,
): boolean {
  const c = roads.componentOf(i);
  if (c === 0) return false;
  if (stats.edge[c] === 1) return true;
  const targets = zone === ZoneType.Residential ? stats.jobZones : stats.residentialZones;
  return (targets[c] as number) > 0;
}

/** Linear distance decay: 1 up to `nearCommute`, 0 at `maxCommute`. */
export function commuteDecay(distance: number): number {
  const { nearCommute, maxCommute } = BALANCE.traffic;
  if (distance <= nearCommute) return 1;
  if (distance >= maxCommute) return 0;
  return 1 - (distance - nearCommute) / (maxCommute - nearCommute);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Extra cost of entering each road tile (-1 off-road), from last month's congestion. */
function congestionPenalty(world: World, congestion: Float32Array): Float64Array {
  const { congestionThreshold, congestionCost } = BALANCE.traffic;
  const infra = world.structure.infra;
  const penalty = new Float64Array(world.tileCount).fill(-1);
  for (let i = 0; i < world.tileCount; i++) {
    if (((infra[i] as number) & Infra.Road) === 0) continue;
    const excess = Math.max(0, (congestion[i] as number) - congestionThreshold);
    penalty[i] = congestionCost * excess * excess;
  }
  return penalty;
}

/** Multi-source Dijkstra over road tiles; edge cost grows with last month's congestion. */
export function roadDijkstra(world: World, sources: number[], congestion: Float32Array): PathTree {
  return dijkstra(world, sources, congestionPenalty(world, congestion));
}

function dijkstra(world: World, sources: number[], penalty: Float64Array): PathTree {
  const { maxCommute, searchFactor } = BALANCE.traffic;
  const maxCost = maxCommute * searchFactor;
  const size = world.size;
  const dist = new Float64Array(world.tileCount).fill(Number.POSITIVE_INFINITY);
  const parent = new Int32Array(world.tileCount).fill(-1);
  const heap = new MinHeap(4096);
  // Tiles beyond `maxCost` keep their distance but are never expanded, so they skip the heap.
  const relax = (from: number, to: number, d: number) => {
    const extra = penalty[to] as number;
    if (extra < 0) return;
    const nd = d + 1 + extra;
    if (nd < (dist[to] as number)) {
      dist[to] = nd;
      parent[to] = from;
      if (nd <= maxCost) heap.push(to, nd);
    }
  };
  const lastRow = world.tileCount - size;
  const expand = (t: number, d: number) => {
    const x = t % size;
    if (t >= size) relax(t, t - size, d);
    if (x < size - 1) relax(t, t + 1, d);
    if (t < lastRow) relax(t, t + size, d);
    if (x > 0) relax(t, t - 1, d);
  };
  // Sources (key 0) pop before every other key (>= 1) in node order, so they bypass the heap.
  const starts = Int32Array.from(sources).sort();
  for (const s of starts) dist[s] = 0;
  for (let k = 0; k < starts.length; k++) {
    const s = starts[k] as number;
    if (k > 0 && s === starts[k - 1]) continue;
    expand(s, 0);
  }
  while (heap.size > 0) {
    const t = heap.pop();
    const d = heap.lastKey;
    if (d > (dist[t] as number)) continue;
    expand(t, d);
  }
  return { dist, parent };
}

/** Monthly: accessibility per zone tile and aggregate trip assignment on the road graph. */
export function updateTraffic(engine: SimulationEngine, roads: RoadNetwork): TrafficResult {
  const w = engine.world;
  const t = BALANCE.traffic;
  const traffic = w.influence.traffic;
  const congestion = new Float32Array(w.tileCount);
  for (let i = 0; i < w.tileCount; i++) congestion[i] = (traffic[i] as number) / 128;

  const jobSites: number[] = [];
  const homeSites: number[] = [];
  const shopSites: number[] = [];
  for (const b of engine.buildings.values()) {
    if (!isZoneKind(b.kind) || b.abandoned) continue;
    const road = roads.accessRoad[w.index(b.x, b.y)] as number;
    if (road < 0) continue;
    if (b.kind === 'residential') {
      if (b.occupancy > 0) homeSites.push(road);
    } else {
      jobSites.push(road);
      if (b.kind === 'commercial') shopSites.push(road);
    }
  }
  // Roads leaving the map and gateway hubs connect to the region: external jobs and workers.
  for (const r of [...roads.edgeRoads, ...gatewayRoads(w, roads, engine.buildings.values())]) {
    jobSites.push(r);
    homeSites.push(r);
  }
  const penalty = congestionPenalty(w, congestion);
  const jobs = dijkstra(w, jobSites, penalty);
  const homes = dijkstra(w, homeSites, penalty);
  const shops = dijkstra(w, shopSites, penalty);
  const comps = componentStats(engine, roads);

  // Accessibility of every zoned tile (stored 0..255 in the access layer).
  const access = w.influence.access;
  const ext = BALANCE.demand.externalJobs;
  const extWorkers = BALANCE.growth.externalWorkers;
  const labor = BALANCE.demand.laborRate;
  for (let i = 0; i < w.tileCount; i++) {
    const zone = w.zone[i] as ZoneType;
    const road = roads.accessRoad[i] as number;
    if (zone === ZoneType.None || road < 0) {
      access[i] = 0;
      continue;
    }
    const c = roads.component[road] as number;
    const edge = comps.edge[c] === 1;
    const residents = comps.residents[c] as number;
    const workforce = labor * residents + (edge ? extWorkers : 0);
    const allJobs =
      (comps.commercialJobs[c] as number) + (comps.industrialJobs[c] as number) + (edge ? ext : 0);
    let value: number;
    if (zone === ZoneType.Residential) {
      value =
        clamp01(allJobs / Math.max(labor * residents, 1)) * commuteDecay(jobs.dist[road] as number);
    } else if (zone === ZoneType.Commercial) {
      const customers = 0.12 * residents;
      value =
        clamp01(customers / Math.max(comps.commercialJobs[c] as number, 4)) *
        commuteDecay(homes.dist[road] as number);
    } else {
      value = clamp01(workforce / Math.max(allJobs, 10)) * commuteDecay(homes.dist[road] as number);
    }
    access[i] = Math.round(value * 255);
  }

  // Trip assignment along shortest-path trees.
  const flow = new Float32Array(w.tileCount);
  for (const b of engine.buildings.values()) {
    if (b.kind !== 'residential' || b.abandoned || b.occupancy <= 0) continue;
    const road = roads.accessRoad[w.index(b.x, b.y)] as number;
    if (road < 0) continue;
    addTrips(flow, jobs, road, labor * b.occupancy);
    addTrips(flow, shops, road, t.shoppingRate * b.occupancy);
  }
  const funding = engine.economy.funding.transport / 100;
  // Drone lanes relieve the road network before the capacity limit is applied.
  const relief = engine.ruleset === 'oasis' ? arcadeRelief(engine, roadsCountGuess(w)) : 0;
  const capacity = t.roadCapacity * (0.5 + 0.5 * funding) * (1 + relief);
  const k = t.congestionSmoothing;
  let sum = 0;
  let roadsCount = 0;
  for (let i = 0; i < w.tileCount; i++) {
    if (!w.hasInfra(i, Infra.Road)) {
      traffic[i] = 0;
      continue;
    }
    const fresh = Math.min(255, ((flow[i] as number) / capacity) * 128);
    const value = Math.round((1 - k) * (traffic[i] as number) + k * fresh);
    traffic[i] = value;
    sum += value / 128;
    roadsCount++;
  }
  w.influenceDirty = true;
  return {
    avgCongestion: roadsCount === 0 ? 0 : sum / roadsCount,
    jobs,
    homes,
    shops,
    components: comps,
  };
}

/** Road tiles on the map, used to scale drone relief. */
function roadsCountGuess(w: SimulationEngine['world']): number {
  let n = 0;
  for (let i = 0; i < w.tileCount; i++) if (w.hasInfra(i, Infra.Road)) n++;
  return n;
}

/** Adds `amount` trips on every road tile from `start` back to the tree's nearest source. */
function addTrips(flow: Float32Array, tree: PathTree, start: number, amount: number): void {
  if (!Number.isFinite(tree.dist[start] as number)) return;
  for (let node = start; node >= 0; node = tree.parent[node] as number) {
    flow[node] = (flow[node] as number) + amount;
  }
}
