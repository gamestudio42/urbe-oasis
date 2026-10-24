import {
  Infra,
  OASIS_RATIONING,
  OASIS_SHADE,
  OASIS_WATER,
  PLACEABLE_SPECS,
  ZONE_SPECS,
  ZoneType,
  isZoneKind,
  type BuildingRecord,
  type PlaceableKind,
  type UtilityStats,
} from '@city/shared';
import type { SimulationEngine } from '../engine';
import { springNear } from './oasis/spring';
import { oasisShade, oasisPower, oasisWater } from './oasis/vertical';
import type { World } from '../world/world';
import { hubJobs } from './demand';

export interface UtilityResult extends UtilityStats {
  /** True when some consumer in a supplied component went unserved. */
  shortage: boolean;
}

interface NetworkSpec {
  /** 1 on tiles that carry the network. */
  conductors: Uint8Array;
  supply(b: BuildingRecord): number;
  demand(b: BuildingRecord): number;
  /** Adjusts the computed layer before it is written to the world. */
  postProcess?(next: Uint8Array): void;
}

export function powerDemand(b: BuildingRecord): number {
  if (!isZoneKind(b.kind)) return PLACEABLE_SPECS[b.kind].powerUse;
  if (b.abandoned) return 0;
  // Neon spires grow past the classic table; `oasisPower` extrapolates identically for both rules.
  const table = ZONE_SPECS[b.kind].power;
  return (table[b.level] ?? oasisPower(b.kind, b.level)) as number;
}

export function waterDemand(b: BuildingRecord, rationing = false): number {
  if (!isZoneKind(b.kind) || b.abandoned) return 0;
  const table = ZONE_SPECS[b.kind].water;
  const demand = (table[b.level] ?? oasisWater(b.kind, b.level)) as number;
  return rationing ? Math.ceil(demand * OASIS_RATIONING.demandMultiplier) : demand;
}

export function powerSupply(b: BuildingRecord): number {
  if (isZoneKind(b.kind) || b.offline > 0) return 0;
  return PLACEABLE_SPECS[b.kind].powerSupply;
}

export function pumpNearWater(world: World, b: BuildingRecord): boolean {
  for (let y = b.y - 1; y <= b.y + b.h; y++) {
    for (let x = b.x - 1; x <= b.x + b.w; x++) {
      if (world.inBounds(x, y) && world.isWater(world.index(x, y))) return true;
    }
  }
  return false;
}

export function waterSupply(world: World, b: BuildingRecord, oasis = false): number {
  if (isZoneKind(b.kind) || !b.powered || b.offline > 0) return 0;
  const spec = PLACEABLE_SPECS[b.kind];
  if (spec.waterSupply <= 0 && spec.waterSupplyNearWater <= 0) return 0;
  let supply = pumpNearWater(world, b) ? spec.waterSupplyNearWater : spec.waterSupply;
  // An unshaded well or pump loses water to the sun. Qanats are exempt.
  // `linked` is the shade flag from the previous solve: shade runs after water.
  if (oasis && (b.kind === 'well' || b.kind === 'waterPump') && b.linked !== true) {
    supply = Math.round(supply * OASIS_WATER.evaporation);
  }
  return supply;
}

/**
 * Water released by cisterns on the last oasis solve. Not serialized: the charge on
 * `engine.oasis.cisterns` is the persisted store, and this map is only what that solve spent.
 */
const cisternRelease = new WeakMap<SimulationEngine, Map<number, number>>();

/** Water a building adds. A cistern adds only the shortfall settled for this solve. */
export function oasisWaterOutput(engine: SimulationEngine, b: BuildingRecord): number {
  const oasis = engine.ruleset === 'oasis';
  const base = waterSupply(engine.world, b, oasis);
  if (!oasis || b.kind !== 'cistern') return base;
  return base + (cisternRelease.get(engine)?.get(b.id) ?? 0);
}

/** Water cisterns added on the last settle, for the grid report. */
export function cisternDelivery(engine: SimulationEngine): number {
  const releases = cisternRelease.get(engine);
  if (!releases) return 0;
  let total = 0;
  for (const water of releases.values()) total += water;
  return total;
}

/**
 * Before the water solve: a spare component charges its cisterns and they add nothing.
 * A short one is topped up only by the missing water, and the charge falls by that share.
 */
function settleCisterns(engine: SimulationEngine, conductors: Uint8Array): void {
  const releases = new Map<number, number>();
  cisternRelease.set(engine, releases);
  // Reset last delivery even when every bank has been removed, lost power or gone offline.
  // No charge can change without an operating bank, so there is no network to settle.
  let hasBank = false;
  for (const b of engine.buildings.values()) {
    if (b.kind === 'cistern' && b.powered && b.offline === 0) {
      hasBank = true;
      break;
    }
  }
  if (!hasBank) return;
  const components = walkComponents(
    engine,
    conductors,
    (b) => waterSupply(engine.world, b, true) > 0 || b.kind === 'cistern',
  );
  for (const buildings of components) {
    let base = 0;
    let demand = 0;
    const banks: BuildingRecord[] = [];
    for (const b of buildings) {
      base += waterSupply(engine.world, b, true);
      demand += waterDemand(b, engine.oasis.waterPolicy?.rationing);
      if (b.kind === 'cistern' && b.powered && b.offline === 0) banks.push(b);
    }
    if (banks.length === 0) continue;
    const shortfall = demand - base;
    if (shortfall <= 0) {
      for (const bank of banks) {
        const entry = cisternCharge(engine, bank.id);
        entry.charge = Math.min(1, entry.charge + OASIS_WATER.cisternDischarge);
      }
      continue;
    }
    const stored = banks.map((bank) => {
      const entry = cisternCharge(engine, bank.id);
      return { bank, entry, water: Math.round(entry.charge * OASIS_WATER.cisternOutput) };
    });
    let available = 0;
    for (const row of stored) available += row.water;
    if (available <= 0) continue;
    const deliver = Math.min(shortfall, available);
    let left = deliver;
    for (let i = 0; i < stored.length; i++) {
      const row = stored[i] as (typeof stored)[number];
      const share =
        i === stored.length - 1
          ? left
          : Math.min(left, Math.round((deliver * row.water) / available));
      left -= share;
      if (share <= 0) continue;
      releases.set(row.bank.id, share);
      row.entry.charge = Math.max(0, row.entry.charge - share / OASIS_WATER.cisternOutput);
    }
  }
}

function cisternCharge(
  engine: SimulationEngine,
  id: number,
): { buildingId: number; charge: number } {
  const found = engine.oasis.cisterns.find((c) => c.buildingId === id);
  if (found) return found;
  const created = { buildingId: id, charge: 0 };
  engine.oasis.cisterns.push(created);
  return created;
}

/** Bandwidth a zone lot asks for. Placeables do not consume data; they only need to be reached. */
export function shadeDemand(b: BuildingRecord): number {
  if (!isZoneKind(b.kind) || b.abandoned) return 0;
  return oasisShade(b.kind, b.level);
}

/**
 * Shade a spring house or palm adds. A palm needs neither power nor water. A spring house
 * needs power; full output also needs the spring nearby and water. `nearSpring` defaults to
 * true so a direct call still describes a house that has not lost the spring.
 */
export function shadeSupply(b: BuildingRecord, nearSpring = true): number {
  if (isZoneKind(b.kind) || b.offline > 0) return 0;
  if (b.kind === 'palm') return OASIS_SHADE.palmSupply;
  if (!b.powered) return 0;
  if (b.kind === 'springHouse') {
    if (nearSpring && b.watered) return OASIS_SHADE.springSupply;
    if (nearSpring || b.watered) return OASIS_SHADE.springSupplyDry;
    return 0;
  }
  return 0;
}

/**
 * Recomputes power, then water (pumps need power), then the neon data network (halls need both).
 * With `write` it updates the service layers and building flags; without it only the summary
 * is computed. The data pass does not run in a classic city.
 */
export function updateUtilities(
  engine: SimulationEngine,
  write = true,
): { power: UtilityResult; water: UtilityResult; data?: UtilityResult } {
  const w = engine.world;
  const infra = w.structure.infra;
  const zone = w.zone;
  const buildingId = w.buildingId;
  const powerConductors = new Uint8Array(w.tileCount);
  const waterConductors = new Uint8Array(w.tileCount);
  for (let i = 0; i < w.tileCount; i++) {
    const flags = infra[i] as number;
    const built = (buildingId[i] as number) !== 0;
    if (built || (flags & Infra.PowerLine) !== 0 || (zone[i] as number) !== ZoneType.None)
      powerConductors[i] = 1;
    if (built || (flags & Infra.Pipe) !== 0) waterConductors[i] = 1;
  }
  const power = solve(
    engine,
    write,
    'powered',
    (b) => b.powered,
    (b, on) => (b.powered = on),
    { conductors: powerConductors, supply: powerSupply, demand: powerDemand },
  );
  if (write && engine.ruleset === 'oasis') settleCisterns(engine, waterConductors);
  const water = solve(
    engine,
    write,
    'watered',
    (b) => b.watered,
    (b, on) => (b.watered = on),
    {
      conductors: waterConductors,
      supply: (b) => oasisWaterOutput(engine, b),
      demand: (b) =>
        waterDemand(b, engine.ruleset === 'oasis' && engine.oasis.waterPolicy?.rationing),
      postProcess: (next) => spreadWaterToEmptyZones(w, next),
    },
  );
  let data: UtilityResult | undefined;
  if (engine.ruleset === 'oasis') {
    const dataConductors = new Uint8Array(w.tileCount);
    for (let i = 0; i < w.tileCount; i++) {
      const built = (buildingId[i] as number) !== 0;
      if (built || ((infra[i] as number) & Infra.Canal) !== 0) dataConductors[i] = 1;
    }
    data = solve(
      engine,
      write,
      'linked',
      (b) => b.linked === true,
      (b, on) => {
        b.linked = on;
      },
      {
        conductors: dataConductors,
        supply: (b) => shadeSupply(b, springNear(engine, b)),
        demand: shadeDemand,
        postProcess: (next) => spreadWaterToEmptyZones(w, next),
      },
    );
  }
  if (write) updateHubJobs(engine);
  return data ? { power, water, data } : { power, water };
}

/** One connected component of the power network, as the classic solver sees it. */
export interface PowerComponent {
  buildings: BuildingRecord[];
  supply: number;
  demand: number;
}

/**
 * Groups buildings into power components using exactly the conductor rules of the classic
 * solver (built tiles, power lines and zoned tiles, jumping over a plain road). The neon grid
 * layer reuses this so overload, cascade and cisterns describe the same components the
 * `powered` layer was solved from.
 */
export function powerComponents(engine: SimulationEngine): PowerComponent[] {
  const w = engine.world;
  const size = w.size;
  const count = w.tileCount;
  const infra = w.structure.infra;
  const buildingId = w.buildingId;
  const conductors = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const flags = infra[i] as number;
    if (
      (buildingId[i] as number) !== 0 ||
      (flags & Infra.PowerLine) !== 0 ||
      (w.zone[i] as number) !== ZoneType.None
    )
      conductors[i] = 1;
  }
  const visited = new Uint8Array(count);
  const queue = new Int32Array(count);
  const claimed = new Set<number>();
  const components: PowerComponent[] = [];

  for (const source of engine.buildings.values()) {
    if (powerSupply(source) <= 0) continue;
    const start = w.index(source.x, source.y);
    if (visited[start] === 1) continue;
    const component: PowerComponent = { buildings: [], supply: 0, demand: 0 };
    let tail = 0;
    for (let y = source.y; y < source.y + source.h; y++) {
      for (let x = source.x; x < source.x + source.w; x++) {
        const t = y * size + x;
        visited[t] = 1;
        queue[tail++] = t;
      }
    }
    for (let head = 0; head < tail; head++) {
      const t = queue[head] as number;
      const id = buildingId[t] as number;
      if (id !== 0 && !claimed.has(id)) {
        const b = engine.buildings.get(id);
        if (b) {
          claimed.add(id);
          component.buildings.push(b);
          component.supply += powerSupply(b);
          component.demand += powerDemand(b);
        }
      }
      const tx = t % size;
      if (t >= size)
        tail = enqueue(
          conductors,
          infra,
          visited,
          queue,
          tail,
          t - size,
          t >= 2 * size ? t - 2 * size : -1,
        );
      if (tx < size - 1)
        tail = enqueue(conductors, infra, visited, queue, tail, t + 1, tx < size - 2 ? t + 2 : -1);
      if (t < count - size)
        tail = enqueue(
          conductors,
          infra,
          visited,
          queue,
          tail,
          t + size,
          t < count - 2 * size ? t + 2 * size : -1,
        );
      if (tx > 0)
        tail = enqueue(conductors, infra, visited, queue, tail, t - 1, tx > 1 ? t - 2 : -1);
    }
    components.push(component);
  }
  return components;
}

/** Sets hub capacity to its current job count and occupancy to it while the hub operates. */
function updateHubJobs(engine: SimulationEngine): void {
  let residents = 0;
  const operating = new Map<string, number>();
  const hubs: BuildingRecord[] = [];
  for (const b of engine.buildings.values()) {
    if (isZoneKind(b.kind)) {
      if (b.kind === 'residential' && !b.abandoned) residents += b.occupancy;
      continue;
    }
    if (PLACEABLE_SPECS[b.kind].jobs <= 0) continue;
    hubs.push(b);
    if (b.powered && b.offline === 0) operating.set(b.kind, (operating.get(b.kind) ?? 0) + 1);
  }
  for (const b of hubs) {
    const spec = PLACEABLE_SPECS[b.kind as PlaceableKind];
    b.capacity = hubJobs(spec, residents, operating.get(b.kind) ?? 0);
    b.occupancy = b.powered && b.offline === 0 ? b.capacity : 0;
  }
}

type ServiceLayer = 'powered' | 'watered' | 'linked';

function serviceLayer(w: World, layer: ServiceLayer): Uint8Array {
  return layer === 'linked' ? w.linked : w.structure[layer];
}

/** Scratch memory belongs to a world, never to a save or a utility result. */
interface UtilityScratch {
  next: Uint8Array;
  visited: Uint8Array;
  queue: Int32Array;
  state: Uint8Array;
  supply: Float64Array;
}
const utilityScratch = new WeakMap<World, UtilityScratch>();

function scratchFor(engine: SimulationEngine): UtilityScratch {
  const w = engine.world;
  let scratch = utilityScratch.get(w);
  const capacity = engine.buildings.nextId;
  if (!scratch) {
    scratch = {
      next: new Uint8Array(w.tileCount),
      visited: new Uint8Array(w.tileCount),
      queue: new Int32Array(w.tileCount),
      state: new Uint8Array(capacity),
      supply: new Float64Array(capacity),
    };
    utilityScratch.set(w, scratch);
  } else {
    scratch.next.fill(0);
    scratch.visited.fill(0);
    if (scratch.state.length < capacity) {
      const grown = Math.max(capacity, scratch.state.length * 2);
      scratch.state = new Uint8Array(grown);
      scratch.supply = new Float64Array(grown);
    } else scratch.state.fill(0);
  }
  return scratch;
}

function solve(
  engine: SimulationEngine,
  write: boolean,
  layer: ServiceLayer,
  getServed: (b: BuildingRecord) => boolean,
  setServed: (b: BuildingRecord, on: boolean) => void,
  spec: NetworkSpec,
): UtilityResult {
  const w = engine.world;
  const size = w.size;
  const count = w.tileCount;
  const conductors = spec.conductors;
  const infra = w.structure.infra;
  const buildingId = w.buildingId;
  const { next, visited, state, queue, supply: supplyById } = scratchFor(engine);
  // Supply inputs stay fixed during this pass. Recompute for every pass, since water depends
  // on the just-solved power flags and shade depends on the just-solved water flags.
  for (const b of engine.buildings.values()) supplyById[b.id] = spec.supply(b);
  const result: UtilityResult = { supply: 0, demand: 0, served: 0, shortage: false };
  let consumers = 0;
  let servedConsumers = 0;

  for (const source of engine.buildings.values()) {
    if ((supplyById[source.id] as number) <= 0) continue;
    const start = w.index(source.x, source.y);
    if (visited[start] === 1) continue;
    // Breadth-first discovery from the source footprint.
    let tail = 0;
    for (let y = source.y; y < source.y + source.h; y++) {
      for (let x = source.x; x < source.x + source.w; x++) {
        const t = y * size + x;
        visited[t] = 1;
        queue[tail++] = t;
      }
    }
    const order: BuildingRecord[] = [];
    const firstTile: number[] = [];
    let supply = 0;
    for (let head = 0; head < tail; head++) {
      const t = queue[head] as number;
      const id = buildingId[t] as number;
      if (id !== 0 && state[id] === UNREACHED) {
        const b = engine.buildings.get(id);
        if (b) {
          state[id] = UNSERVED;
          supply += supplyById[b.id] as number;
          order.push(b);
          firstTile.push(head);
        }
      }
      // Row bounds compare the index directly; only the column needs a division.
      const tx = t % size;
      if (t >= size)
        tail = enqueue(
          conductors,
          infra,
          visited,
          queue,
          tail,
          t - size,
          t >= 2 * size ? t - 2 * size : -1,
        );
      if (tx < size - 1)
        tail = enqueue(conductors, infra, visited, queue, tail, t + 1, tx < size - 2 ? t + 2 : -1);
      if (t < count - size)
        tail = enqueue(
          conductors,
          infra,
          visited,
          queue,
          tail,
          t + size,
          t < count - 2 * size ? t + 2 * size : -1,
        );
      if (tx > 0)
        tail = enqueue(conductors, infra, visited, queue, tail, t - 1, tx > 1 ? t - 2 : -1);
    }
    // Nearest-first allocation; the first consumer that does not fit cuts off the rest.
    let remaining = supply;
    let cutoff = Number.POSITIVE_INFINITY;
    for (let k = 0; k < order.length; k++) {
      const b = order[k] as BuildingRecord;
      const demand = spec.demand(b);
      const isSource = (supplyById[b.id] as number) > 0;
      if (demand > 0 && !isSource) {
        consumers++;
        result.demand += demand;
      }
      if (isSource || (cutoff === Number.POSITIVE_INFINITY && remaining >= demand)) {
        remaining -= isSource ? 0 : demand;
        state[b.id] = SERVED;
        if (demand > 0 && !isSource) servedConsumers++;
      } else {
        if (cutoff === Number.POSITIVE_INFINITY) cutoff = firstTile[k] as number;
        result.shortage = true;
      }
    }
    result.supply += supply;
    for (let k = 0; k < tail; k++) {
      const t = queue[k] as number;
      const id = buildingId[t] as number;
      next[t] = id !== 0 ? (state[id] === SERVED ? 1 : 0) : k < cutoff ? 1 : 0;
    }
  }

  for (const b of engine.buildings.values()) {
    const reached = state[b.id] as number;
    const on = reached === SERVED;
    if (write && getServed(b) !== on) {
      setServed(b, on);
      engine.buildings.touch(b);
    }
    if (reached === UNREACHED) {
      const demand = spec.demand(b);
      if (demand > 0 && (supplyById[b.id] as number) <= 0) {
        consumers++;
        result.demand += demand;
      }
    }
  }
  result.served = consumers === 0 ? 1 : servedConsumers / consumers;
  if (!write) return result;
  spec.postProcess?.(next);
  const data = serviceLayer(w, layer);
  for (let i = 0; i < w.tileCount; i++) {
    const v = next[i] as number;
    if (data[i] !== v) {
      data[i] = v;
      w.markDirty(i);
    }
  }
  return result;
}

const UNREACHED = 0;
const UNSERVED = 1;
const SERVED = 2;

/**
 * Groups every powered building into connected components, using the exact traversal of the
 * classic solver (including the hop over a road tile).
 */
export function powerNetworkComponents(engine: SimulationEngine): BuildingRecord[][] {
  const w = engine.world;
  const infra = w.structure.infra;
  const zone = w.zone;
  const buildingId = w.buildingId;
  const conductors = new Uint8Array(w.tileCount);
  for (let i = 0; i < w.tileCount; i++) {
    if (
      (buildingId[i] as number) !== 0 ||
      ((infra[i] as number) & Infra.PowerLine) !== 0 ||
      (zone[i] as number) !== ZoneType.None
    )
      conductors[i] = 1;
  }
  return walkComponents(engine, conductors, (b) => powerSupply(b) > 0);
}

/** Water components: buildings and pipes, starting at a tile that can give water. */
export function waterNetworkComponents(
  engine: SimulationEngine,
  isSource?: (b: BuildingRecord) => boolean,
): BuildingRecord[][] {
  const w = engine.world;
  const infra = w.structure.infra;
  const buildingId = w.buildingId;
  const conductors = new Uint8Array(w.tileCount);
  for (let i = 0; i < w.tileCount; i++) {
    if ((buildingId[i] as number) !== 0 || ((infra[i] as number) & Infra.Pipe) !== 0)
      conductors[i] = 1;
  }
  return walkComponents(engine, conductors, isSource ?? ((b) => oasisWaterOutput(engine, b) > 0));
}

function walkComponents(
  engine: SimulationEngine,
  conductors: Uint8Array,
  isSource: (b: BuildingRecord) => boolean,
): BuildingRecord[][] {
  const w = engine.world;
  const size = w.size;
  const count = w.tileCount;
  const infra = w.structure.infra;
  const buildingId = w.buildingId;
  const visited = new Uint8Array(count);
  const owned = new Uint8Array(engine.buildings.nextId);
  const queue = new Int32Array(count);
  const components: BuildingRecord[][] = [];

  for (const source of engine.buildings.values()) {
    if (!isSource(source)) continue;
    const start = w.index(source.x, source.y);
    if (visited[start] === 1) continue;
    const component: BuildingRecord[] = [];
    let tail = 0;
    for (let y = source.y; y < source.y + source.h; y++) {
      for (let x = source.x; x < source.x + source.w; x++) {
        const t = y * size + x;
        visited[t] = 1;
        queue[tail++] = t;
      }
    }
    for (let head = 0; head < tail; head++) {
      const t = queue[head] as number;
      const id = buildingId[t] as number;
      if (id !== 0 && owned[id] !== 1) {
        const b = engine.buildings.get(id);
        if (b) {
          owned[id] = 1;
          component.push(b);
        }
      }
      const tx = t % size;
      if (t >= size)
        tail = enqueue(
          conductors,
          infra,
          visited,
          queue,
          tail,
          t - size,
          t >= 2 * size ? t - 2 * size : -1,
        );
      if (tx < size - 1)
        tail = enqueue(conductors, infra, visited, queue, tail, t + 1, tx < size - 2 ? t + 2 : -1);
      if (t < count - size)
        tail = enqueue(
          conductors,
          infra,
          visited,
          queue,
          tail,
          t + size,
          t < count - 2 * size ? t + 2 * size : -1,
        );
      if (tx > 0)
        tail = enqueue(conductors, infra, visited, queue, tail, t - 1, tx > 1 ? t - 2 : -1);
    }
    components.push(component);
  }
  return components;
}

/**
 * Enqueues neighbour `n`; when `n` is a plain road tile, conduction jumps over it to `beyond`
 * (zones and buildings on both sides of a street stay connected).
 */
function enqueue(
  conductors: Uint8Array,
  infra: Uint8Array,
  visited: Uint8Array,
  queue: Int32Array,
  tail: number,
  n: number,
  beyond: number,
): number {
  if (visited[n] === 1) return tail;
  if (conductors[n] === 1) {
    visited[n] = 1;
    queue[tail] = n;
    return tail + 1;
  }
  if (
    beyond < 0 ||
    visited[beyond] === 1 ||
    ((infra[n] as number) & Infra.Road) === 0 ||
    conductors[beyond] !== 1
  )
    return tail;
  visited[beyond] = 1;
  queue[tail] = beyond;
  return tail + 1;
}

/** Empty zoned tiles count as watered when an orthogonal neighbour is watered. */
function spreadWaterToEmptyZones(w: World, next: Uint8Array): void {
  const size = w.size;
  const add: number[] = [];
  for (let i = 0; i < w.tileCount; i++) {
    if (
      (w.zone[i] as number) === ZoneType.None ||
      (w.buildingId[i] as number) !== 0 ||
      next[i] === 1
    )
      continue;
    const x = i % size;
    const y = (i / size) | 0;
    if (
      (y > 0 && next[i - size] === 1) ||
      (x < size - 1 && next[i + 1] === 1) ||
      (y < size - 1 && next[i + size] === 1) ||
      (x > 0 && next[i - 1] === 1)
    ) {
      add.push(i);
    }
  }
  for (const i of add) next[i] = 1;
}
