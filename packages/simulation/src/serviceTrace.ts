import {
  Infra,
  OASIS_SHADE,
  OASIS_JOURNEY,
  OASIS_WATER,
  PLACEABLE_SPECS,
  ZoneType,
  isZoneKind,
  type BuildingRecord,
  type PlaceableKind,
} from '@city/shared';
import {
  powerDemand,
  powerSupply,
  shadeDemand,
  shadeSupply,
  waterDemand,
  waterSupply,
} from './systems/utilities';
import type { World } from './world/world';

/**
 * Read-only explanations of the power, water and shade networks for the UI. Works on the
 * engine world or the UI mirror; it never writes a layer or a building flag. Conduction uses
 * the solver's rule (including the hop over a plain road tile), but supply comes from the
 * mirrored flags, so a trace describes the last solve rather than predicting the next one.
 */
export type ServiceNetwork = 'power' | 'water' | 'shade';

/** Why a source adds less than its rated output, or nothing at all. */
export type SourceIssue =
  'OFFLINE' | 'NO_POWER' | 'NO_WATER' | 'FAR_FROM_SPRING' | 'UNSHADED' | 'EMPTY';

export interface TracedSource {
  /** 0 for a building the plan would place. */
  id: number;
  kind: PlaceableKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Output on the last solve (or expected output for a planned building). */
  supply: number;
  /** Cisterns hold water back; their output is reported apart from the regular supply. */
  reserve: boolean;
  issue: SourceIssue | null;
  planned: boolean;
}

export interface ServiceTrace {
  network: ServiceNetwork;
  /** Conducting tiles reached from the start, in breadth-first order. */
  tiles: number[];
  sources: TracedSource[];
  supply: number;
  /** What powered cisterns could release right now. */
  reserve: number;
  demand: number;
  consumers: number;
  /** Consumers flagged as served on the last solve. */
  served: number;
}

export interface ServiceContext {
  world: World;
  building(id: number): BuildingRecord | undefined;
  /** Wandering spring; spring houses outside its radius lose most of their shade. */
  spring: { x: number; y: number } | null;
  /** Mean cistern charge 0..1 from the city statistics. */
  cisternCharge?: number;
  rationing?: boolean;
  /** The journey's drought cuts well and pump output. */
  drought?: boolean;
}

/** What a tool command would add to a network. */
export interface ServicePlan {
  /** Tiles that will conduct this network once built. */
  tiles: readonly number[];
  /** A building the command would place. Its footprint conducts every network. */
  building?: { kind: PlaceableKind; x: number; y: number };
}

export type ServiceStatus = 'served' | 'disconnected' | 'sourcesIdle' | 'shortage' | 'none';

export interface ServiceExplanation {
  network: ServiceNetwork;
  status: ServiceStatus;
  /** Distinct reasons sources in reach are idle or reduced, in source order. */
  issues: SourceIssue[];
  trace: ServiceTrace;
}

const LINE: Record<ServiceNetwork, number> = {
  power: Infra.PowerLine,
  water: Infra.Pipe,
  shade: Infra.Canal,
};

/** The network a tool extends, or null when it does not build part of one. */
export function serviceNetworkOf(tool: string): ServiceNetwork | null {
  if (tool === 'powerLine') return 'power';
  if (tool === 'pipe') return 'water';
  if (tool === 'canal') return 'shade';
  if (!(tool in PLACEABLE_SPECS)) return null;
  const kind = tool as PlaceableKind;
  if (kind === 'palm' || kind === 'springHouse') return 'shade';
  if (kind === 'cistern') return 'water';
  const spec = PLACEABLE_SPECS[kind];
  if (spec.waterSupply > 0 || spec.waterSupplyNearWater > 0) return 'water';
  if (spec.powerSupply > 0) return 'power';
  return null;
}

/** True when a placeable can add to `network` (cisterns count as a reserve). */
export function isServiceSource(kind: PlaceableKind, network: ServiceNetwork): boolean {
  const spec = PLACEABLE_SPECS[kind];
  if (network === 'power') return spec.powerSupply > 0;
  if (network === 'water')
    return kind === 'cistern' || spec.waterSupply > 0 || spec.waterSupplyNearWater > 0;
  return kind === 'palm' || kind === 'springHouse';
}

function conductorMask(world: World, network: ServiceNetwork): Uint8Array {
  const mask = new Uint8Array(world.tileCount);
  const flag = LINE[network];
  for (let i = 0; i < world.tileCount; i++) {
    if (
      (world.buildingId[i] as number) !== 0 ||
      ((world.structure.infra[i] as number) & flag) !== 0 ||
      // Oasis lots carry every network, built or not (the trace only serves Oasis cities).
      (world.zone[i] as number) !== ZoneType.None
    )
      mask[i] = 1;
  }
  return mask;
}

function nearSpring(ctx: ServiceContext, x: number, y: number): boolean {
  if (!ctx.spring) return true;
  const dx = Math.abs(x - ctx.spring.x);
  const dy = Math.abs(y - ctx.spring.y);
  return Math.max(dx, dy) <= OASIS_SHADE.springRadius;
}

function existingSource(
  ctx: ServiceContext,
  network: ServiceNetwork,
  b: BuildingRecord,
): Omit<TracedSource, 'id' | 'kind' | 'x' | 'y' | 'w' | 'h' | 'planned'> {
  const kind = b.kind as PlaceableKind;
  if (b.offline > 0) return { supply: 0, reserve: kind === 'cistern', issue: 'OFFLINE' };
  if (network === 'power') return { supply: powerSupply(b), reserve: false, issue: null };
  if (network === 'water') {
    if (kind === 'cistern') {
      if (!b.powered) return { supply: 0, reserve: true, issue: 'NO_POWER' };
      const charge = ctx.cisternCharge ?? 0;
      const supply = Math.round(charge * OASIS_WATER.cisternOutput);
      return { supply, reserve: true, issue: supply > 0 ? null : 'EMPTY' };
    }
    if (!b.powered) return { supply: 0, reserve: false, issue: 'NO_POWER' };
    const supply = droughtCut(ctx, kind, waterSupply(ctx.world, b, true));
    const unshaded = (kind === 'well' || kind === 'waterPump') && b.linked !== true;
    return { supply, reserve: false, issue: unshaded ? 'UNSHADED' : null };
  }
  const near = nearSpring(ctx, b.x, b.y);
  const supply = shadeSupply(b, near);
  if (kind !== 'springHouse') return { supply, reserve: false, issue: null };
  const issue: SourceIssue | null = !b.powered
    ? 'NO_POWER'
    : !near
      ? 'FAR_FROM_SPRING'
      : !b.watered
        ? 'NO_WATER'
        : null;
  return { supply, reserve: false, issue };
}

/** Expected output of a building the plan would add, judged against today's networks. */
function plannedSource(
  ctx: ServiceContext,
  network: ServiceNetwork,
  kind: PlaceableKind,
  x: number,
  y: number,
): Omit<TracedSource, 'id' | 'kind' | 'x' | 'y' | 'w' | 'h' | 'planned'> {
  const spec = PLACEABLE_SPECS[kind];
  const footprint: number[] = [];
  for (let dy = 0; dy < spec.size; dy++)
    for (let dx = 0; dx < spec.size; dx++)
      if (ctx.world.inBounds(x + dx, y + dy)) footprint.push(ctx.world.index(x + dx, y + dy));
  const reaches = (other: ServiceNetwork) =>
    hasOutput(traceService(ctx, other, footprint, { tiles: footprint }));
  if (network === 'power') return { supply: spec.powerSupply, reserve: false, issue: null };
  if (network === 'shade') {
    if (kind === 'palm') return { supply: OASIS_SHADE.palmSupply, reserve: false, issue: null };
    if (!reaches('power')) return { supply: 0, reserve: false, issue: 'NO_POWER' };
    const near = nearSpring(ctx, x, y);
    const watered = reaches('water');
    if (near && watered) return { supply: OASIS_SHADE.springSupply, reserve: false, issue: null };
    return {
      supply: near || watered ? OASIS_SHADE.springSupplyDry : 0,
      reserve: false,
      issue: near ? 'NO_WATER' : 'FAR_FROM_SPRING',
    };
  }
  if (!reaches('power')) return { supply: 0, reserve: kind === 'cistern', issue: 'NO_POWER' };
  if (kind === 'cistern') return { supply: 0, reserve: true, issue: 'EMPTY' };
  const record = {
    x,
    y,
    w: spec.size,
    h: spec.size,
    kind,
    powered: true,
    offline: 0,
  } as BuildingRecord;
  const rated = waterSupply(ctx.world, record, false);
  const shaded = kind === 'qanat' || reaches('shade');
  return {
    supply: droughtCut(ctx, kind, shaded ? rated : Math.round(rated * OASIS_WATER.evaporation)),
    reserve: false,
    issue: shaded ? null : 'UNSHADED',
  };
}

/** Mirrors `droughtOutput` in the journey system. */
function droughtCut(ctx: ServiceContext, kind: PlaceableKind, supply: number): number {
  if (!ctx.drought || (kind !== 'well' && kind !== 'waterPump')) return supply;
  return Math.round(supply * OASIS_JOURNEY.droughtFactor);
}

function hasOutput(trace: ServiceTrace): boolean {
  return trace.supply + trace.reserve > 0;
}

function demandOf(ctx: ServiceContext, network: ServiceNetwork, b: BuildingRecord): number {
  if (network === 'power') return powerDemand(b);
  if (network === 'water') return waterDemand(b, ctx.rationing === true);
  return shadeDemand(b);
}

function servedFlag(network: ServiceNetwork, b: BuildingRecord): boolean {
  return network === 'power' ? b.powered : network === 'water' ? b.watered : b.linked === true;
}

/**
 * The connected part of `network` that `start` belongs to, with `plan` treated as already built.
 * Start tiles that do not conduct are ignored; an empty start gives an empty trace.
 */
export function traceService(
  ctx: ServiceContext,
  network: ServiceNetwork,
  start: readonly number[],
  plan?: ServicePlan,
): ServiceTrace {
  const w = ctx.world;
  const size = w.size;
  const count = w.tileCount;
  const conductors = conductorMask(w, network);
  const planned = plan?.building;
  const plannedSpec = planned ? PLACEABLE_SPECS[planned.kind] : null;
  for (const t of plan?.tiles ?? []) if (t >= 0 && t < count) conductors[t] = 1;
  if (planned && plannedSpec)
    for (let dy = 0; dy < plannedSpec.size; dy++)
      for (let dx = 0; dx < plannedSpec.size; dx++)
        if (w.inBounds(planned.x + dx, planned.y + dy))
          conductors[w.index(planned.x + dx, planned.y + dy)] = 1;
  const inPlanned = (t: number) => {
    if (!planned || !plannedSpec) return false;
    const x = t % size;
    const y = (t / size) | 0;
    return (
      x >= planned.x &&
      y >= planned.y &&
      x < planned.x + plannedSpec.size &&
      y < planned.y + plannedSpec.size
    );
  };
  const visited = new Uint8Array(count);
  const queue: number[] = [];
  for (const t of start) {
    if (t < 0 || t >= count || visited[t] === 1 || conductors[t] !== 1) continue;
    visited[t] = 1;
    queue.push(t);
  }
  const visit = (n: number, beyond: number) => {
    if (visited[n] === 1) return;
    if (conductors[n] === 1) {
      visited[n] = 1;
      queue.push(n);
      return;
    }
    if (
      beyond < 0 ||
      visited[beyond] === 1 ||
      ((w.structure.infra[n] as number) & Infra.Road) === 0 ||
      conductors[beyond] !== 1
    )
      return;
    visited[beyond] = 1;
    queue.push(beyond);
  };
  const seen = new Set<number>();
  const trace: ServiceTrace = {
    network,
    tiles: queue,
    sources: [],
    supply: 0,
    reserve: 0,
    demand: 0,
    consumers: 0,
    served: 0,
  };
  let plannedSeen = false;
  for (let head = 0; head < queue.length; head++) {
    const t = queue[head] as number;
    const id = w.buildingId[t] as number;
    if (id !== 0 && !seen.has(id)) {
      seen.add(id);
      const b = ctx.building(id);
      if (b) {
        if (!isZoneKind(b.kind) && isServiceSource(b.kind, network)) {
          const source = existingSource(ctx, network, b);
          trace.sources.push({
            id,
            kind: b.kind,
            x: b.x,
            y: b.y,
            w: b.w,
            h: b.h,
            planned: false,
            ...source,
          });
        } else {
          const demand = demandOf(ctx, network, b);
          if (demand > 0) {
            trace.consumers++;
            trace.demand += demand;
            if (servedFlag(network, b)) trace.served++;
          }
        }
      }
    }
    if (planned && plannedSpec && !plannedSeen && inPlanned(t)) {
      plannedSeen = true;
      if (isServiceSource(planned.kind, network)) {
        trace.sources.push({
          id: 0,
          kind: planned.kind,
          x: planned.x,
          y: planned.y,
          w: plannedSpec.size,
          h: plannedSpec.size,
          planned: true,
          ...plannedSource(ctx, network, planned.kind, planned.x, planned.y),
        });
      }
    }
    const tx = t % size;
    if (t >= size) visit(t - size, t >= 2 * size ? t - 2 * size : -1);
    if (tx < size - 1) visit(t + 1, tx < size - 2 ? t + 2 : -1);
    if (t < count - size) visit(t + size, t < count - 2 * size ? t + 2 * size : -1);
    if (tx > 0) visit(t - 1, tx > 1 ? t - 2 : -1);
  }
  for (const s of trace.sources) {
    if (s.reserve) trace.reserve += s.supply;
    else trace.supply += s.supply;
  }
  return trace;
}

function servedLayer(world: World, network: ServiceNetwork): Uint8Array {
  return network === 'power' ? world.powered : network === 'water' ? world.watered : world.linked;
}

/**
 * Why a tile has (or lacks) a service. Empty zoned lots draw water and shade from an orthogonal
 * neighbour, the same rule the solver applies, so their trace starts there.
 */
export function explainService(
  ctx: ServiceContext,
  network: ServiceNetwork,
  x: number,
  y: number,
): ServiceExplanation {
  const w = ctx.world;
  const empty: ServiceTrace = {
    network,
    tiles: [],
    sources: [],
    supply: 0,
    reserve: 0,
    demand: 0,
    consumers: 0,
    served: 0,
  };
  if (!w.inBounds(x, y)) return { network, status: 'none', issues: [], trace: empty };
  const i = w.index(x, y);
  const built = (w.buildingId[i] as number) !== 0;
  const zoned = (w.zone[i] as number) !== ZoneType.None;
  const line = ((w.structure.infra[i] as number) & LINE[network]) !== 0;
  let start: number[] = [];
  if (built || line || (network === 'power' && zoned)) start = [i];
  else if (zoned) {
    if (y > 0) start.push(i - w.size);
    if (x < w.size - 1) start.push(i + 1);
    if (y < w.size - 1) start.push(i + w.size);
    if (x > 0) start.push(i - 1);
  } else return { network, status: 'none', issues: [], trace: empty };
  const trace = traceService(ctx, network, start);
  const issues: SourceIssue[] = [];
  for (const s of trace.sources) if (s.issue && !issues.includes(s.issue)) issues.push(s.issue);
  const status: ServiceStatus =
    servedLayer(w, network)[i] === 1
      ? 'served'
      : trace.sources.length === 0
        ? 'disconnected'
        : !hasOutput(trace)
          ? 'sourcesIdle'
          : 'shortage';
  return { network, status, issues, trace };
}
