import {
  BALANCE,
  Infra,
  OASIS_SHADE,
  PLACEABLE_SPECS,
  RejectReason,
  ZoneDensity,
  ZoneType,
  isZoneKind,
  type Area,
  type BuildingRecord,
  type CommandPreview,
  type PlaceableKind,
  type Ruleset,
  type TileRejection,
  type ToolCommand,
} from '@city/shared';
import type { World } from '../world/world';
import { lPath, normalizeArea, rectTiles } from './shapes';

/** Read-only view used for planning. Implemented by the engine and by the UI mirror. */
export interface PlanContext {
  readonly world: World;
  building(id: number): BuildingRecord | undefined;
  readonly funds: number;
  readonly bankrupt: boolean;
  readonly population: number;
  /** Absent means classic, so a canal command cannot slip into a city that has no data rules. */
  readonly ruleset?: Ruleset;
}

/** What demolish removes on a tile, decided at planning time. */
export const DemolishOp = {
  Building: 1,
  Surface: 2,
  Zone: 3,
  Trees: 4,
  Pipe: 5,
  Canal: 6,
} as const;
export type DemolishOp = (typeof DemolishOp)[keyof typeof DemolishOp];

export interface ToolPlan extends CommandPreview {
  /** One op per entry of `valid` (demolish only). */
  ops: DemolishOp[];
  /** Vertex index and new height (level only). */
  heights: Array<[number, number]>;
  /** Buildings removed by demolish. */
  removeBuildings: number[];
}

const SURFACE_BLOCKERS = Infra.Road | Infra.PowerLine | Infra.Rubble;

class PlanBuilder {
  readonly valid: number[] = [];
  readonly invalid: TileRejection[] = [];
  readonly ops: DemolishOp[] = [];
  readonly heights: Array<[number, number]> = [];
  readonly removeBuildings: number[] = [];
  cost = 0;
  /** Set when a single invalid tile must refuse the whole command. */
  atomic = false;
  outOfBounds = 0;

  accept(i: number, cost: number, op?: DemolishOp): void {
    this.valid.push(i);
    this.cost += cost;
    if (op !== undefined) this.ops.push(op);
  }

  reject(i: number, reason: RejectReason): void {
    this.invalid.push({ index: i, reason });
  }

  finish(ctx: PlanContext): ToolPlan {
    const base = {
      cost: this.cost,
      valid: this.valid,
      invalid: this.invalid,
      ops: this.ops,
      heights: this.heights,
      removeBuildings: this.removeBuildings,
    };
    const fail = (reason: RejectReason): ToolPlan => ({ ...base, ok: false, reason });
    if (ctx.bankrupt) return fail(RejectReason.Bankrupt);
    const reason = dominantReason(this.invalid);
    if (this.atomic && this.invalid.length > 0) return fail(reason ?? RejectReason.Invalid);
    if (this.valid.length === 0) {
      if (reason) return fail(reason);
      return fail(this.outOfBounds > 0 ? RejectReason.OutOfBounds : RejectReason.NothingToDo);
    }
    if (this.cost > ctx.funds) return fail(RejectReason.InsufficientFunds);
    return reason ? { ...base, ok: true, reason } : { ...base, ok: true };
  }
}

/** Most frequent rejection; `ALREADY_BUILT` only counts when nothing else was rejected. */
function dominantReason(invalid: TileRejection[]): RejectReason | undefined {
  const counts = new Map<RejectReason, number>();
  for (const r of invalid) counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1);
  let best: RejectReason | undefined;
  let bestCount = 0;
  for (const [reason, count] of counts) {
    if (reason === RejectReason.AlreadyBuilt) continue;
    if (count > bestCount) {
      best = reason;
      bestCount = count;
    }
  }
  if (best) return best;
  return counts.has(RejectReason.AlreadyBuilt) ? RejectReason.AlreadyBuilt : undefined;
}

/** Validates a tool command and computes its cost and effects without changing state. */
export function planToolCommand(ctx: PlanContext, command: ToolCommand): ToolPlan {
  const plan = new PlanBuilder();
  switch (command.type) {
    case 'road':
      forTiles(ctx.world, lPath(command), plan, (i) => planRoad(ctx, i, plan));
      break;
    case 'powerLine':
      forTiles(ctx.world, lPath(command), plan, (i) => planPowerLine(ctx, i, plan));
      break;
    case 'pipe':
      forTiles(ctx.world, lPath(command), plan, (i) => planPipe(ctx, i, plan));
      break;
    case 'canal':
      forTiles(ctx.world, lPath(command), plan, (i) => planFiber(ctx, i, plan));
      break;
    case 'zone':
      forTiles(ctx.world, rectTiles(command), plan, (i) =>
        planZone(ctx, i, command.zone, command.density, plan),
      );
      break;
    case 'plantTrees':
      forTiles(ctx.world, rectTiles(command), plan, (i) => planTrees(ctx, i, plan));
      break;
    case 'demolish': {
      const seen = new Set<number>();
      forTiles(ctx.world, rectTiles(command), plan, (i) =>
        planDemolish(ctx, i, command.underground === true, seen, plan),
      );
      break;
    }
    case 'place':
      planPlace(ctx, command.kind, command.x, command.y, plan);
      break;
    case 'level':
      planLevel(ctx, command, plan);
      break;
    case 'raise':
      planHeightChange(ctx, command, plan, (h) => Math.min(BALANCE.map.maxHeight, h + 1));
      break;
    case 'lower':
      planHeightChange(ctx, command, plan, (h) => Math.max(0, h - 1));
      break;
  }
  return plan.finish(ctx);
}

function forTiles(
  world: World,
  tiles: Array<[number, number]>,
  plan: PlanBuilder,
  fn: (i: number) => void,
): void {
  for (const [x, y] of tiles) {
    if (!world.inBounds(x, y)) {
      plan.outOfBounds++;
      continue;
    }
    fn(world.index(x, y));
  }
}

function treeCost(world: World, i: number): number {
  return (world.trees[i] as number) > 0 ? BALANCE.costs.clearTrees : 0;
}

function planRoad(ctx: PlanContext, i: number, plan: PlanBuilder): void {
  const w = ctx.world;
  const x = w.xOf(i);
  const y = w.yOf(i);
  if ((w.fire[i] as number) > 0) return plan.reject(i, RejectReason.OnFire);
  if (w.hasInfra(i, Infra.Road)) return plan.reject(i, RejectReason.AlreadyBuilt);
  if (w.hasInfra(i, Infra.Rubble)) return plan.reject(i, RejectReason.Rubble);
  if ((w.buildingId[i] as number) !== 0) return plan.reject(i, RejectReason.Occupied);
  if ((w.flood[i] as number) > 0) return plan.reject(i, RejectReason.Water);
  if (w.isWater(i)) return plan.accept(i, BALANCE.costs.bridge);
  if (!w.isGentle(x, y)) return plan.reject(i, RejectReason.Slope);
  plan.accept(i, BALANCE.costs.road + treeCost(w, i));
}

function planPowerLine(ctx: PlanContext, i: number, plan: PlanBuilder): void {
  const w = ctx.world;
  if ((w.fire[i] as number) > 0) return plan.reject(i, RejectReason.OnFire);
  // Zones and buildings already conduct power.
  if (
    w.hasInfra(i, Infra.PowerLine) ||
    (w.buildingId[i] as number) !== 0 ||
    (w.zone[i] as number) !== ZoneType.None
  ) {
    return plan.reject(i, RejectReason.AlreadyBuilt);
  }
  if (w.hasInfra(i, Infra.Rubble)) return plan.reject(i, RejectReason.Rubble);
  if (w.isWater(i)) return plan.accept(i, BALANCE.costs.powerLineOverWater);
  if (!w.isGentle(w.xOf(i), w.yOf(i))) return plan.reject(i, RejectReason.Slope);
  plan.accept(i, BALANCE.costs.powerLine + treeCost(w, i));
}

function planPipe(ctx: PlanContext, i: number, plan: PlanBuilder): void {
  if (ctx.world.hasInfra(i, Infra.Pipe)) return plan.reject(i, RejectReason.AlreadyBuilt);
  plan.accept(i, BALANCE.costs.pipe);
}

/** Same placement rules as a pipe. Classic cities reject the command so the bit stays unset. */
function planFiber(ctx: PlanContext, i: number, plan: PlanBuilder): void {
  if ((ctx.ruleset ?? 'classic') !== 'oasis') return plan.reject(i, RejectReason.Invalid);
  if (ctx.world.hasInfra(i, Infra.Canal)) return plan.reject(i, RejectReason.AlreadyBuilt);
  plan.accept(i, OASIS_SHADE.canalCost);
}

function planZone(
  ctx: PlanContext,
  i: number,
  zone: ZoneType,
  density: ZoneDensity,
  plan: PlanBuilder,
): void {
  const w = ctx.world;
  const current = w.zone[i] as ZoneType;
  const id = w.buildingId[i] as number;
  if (zone === ZoneType.None) {
    if (current === ZoneType.None) return;
    if (id !== 0) return plan.reject(i, RejectReason.Occupied);
    return plan.accept(i, 0);
  }
  if ((w.fire[i] as number) > 0) return plan.reject(i, RejectReason.OnFire);
  if (w.isWater(i) || (w.flood[i] as number) > 0) return plan.reject(i, RejectReason.Water);
  if (w.hasInfra(i, Infra.Rubble)) return plan.reject(i, RejectReason.Rubble);
  if (w.hasInfra(i, Infra.Road | Infra.PowerLine)) return plan.reject(i, RejectReason.Occupied);
  const zoneCost =
    density === ZoneDensity.Dense ? BALANCE.costs.zoneDense : BALANCE.costs.zoneLight;
  if (id !== 0) {
    const b = ctx.building(id);
    if (!b || !isZoneKind(b.kind) || current !== zone) return plan.reject(i, RejectReason.Occupied);
    if ((w.zoneDensity[i] as number) === density) return plan.reject(i, RejectReason.AlreadyBuilt);
    if (density === ZoneDensity.Light && b.level > BALANCE.zones.maxLevelLight) {
      return plan.reject(i, RejectReason.Occupied);
    }
    return plan.accept(i, zoneCost);
  }
  if (current === zone && (w.zoneDensity[i] as number) === density)
    return plan.reject(i, RejectReason.AlreadyBuilt);
  if (!w.isFlat(w.xOf(i), w.yOf(i))) return plan.reject(i, RejectReason.Slope);
  plan.accept(i, zoneCost + treeCost(w, i));
}

function planTrees(ctx: PlanContext, i: number, plan: PlanBuilder): void {
  const w = ctx.world;
  if ((w.fire[i] as number) > 0) return plan.reject(i, RejectReason.OnFire);
  if (w.isWater(i) || (w.flood[i] as number) > 0) return plan.reject(i, RejectReason.Water);
  if (
    (w.buildingId[i] as number) !== 0 ||
    (w.zone[i] as number) !== ZoneType.None ||
    w.hasInfra(i, SURFACE_BLOCKERS)
  ) {
    return plan.reject(i, RejectReason.Occupied);
  }
  if ((w.trees[i] as number) >= 3) return plan.reject(i, RejectReason.AlreadyBuilt);
  plan.accept(i, BALANCE.costs.plantTree);
}

function planDemolish(
  ctx: PlanContext,
  i: number,
  underground: boolean,
  seen: Set<number>,
  plan: PlanBuilder,
): void {
  const w = ctx.world;
  if (seen.has(i)) return;
  if (underground) {
    if (w.hasInfra(i, Infra.Pipe)) plan.accept(i, BALANCE.costs.demolishTile, DemolishOp.Pipe);
    if (w.hasInfra(i, Infra.Canal)) plan.accept(i, BALANCE.costs.demolishTile, DemolishOp.Canal);
    return;
  }
  const id = w.buildingId[i] as number;
  if (id !== 0) {
    const b = ctx.building(id);
    if (!b) return plan.reject(i, RejectReason.Invalid);
    const footprint = footprintOf(w, b);
    if (footprint.some((t) => (w.fire[t] as number) > 0))
      return plan.reject(i, RejectReason.OnFire);
    let cost = BALANCE.costs.demolishTile * footprint.length;
    if (isZoneKind(b.kind)) cost += BALANCE.costs.demolishPerLevel * b.level;
    plan.removeBuildings.push(id);
    for (const t of footprint) {
      seen.add(t);
      plan.accept(t, t === footprint[0] ? cost : 0, DemolishOp.Building);
    }
    return;
  }
  if ((w.fire[i] as number) > 0) return plan.reject(i, RejectReason.OnFire);
  if (w.hasInfra(i, SURFACE_BLOCKERS))
    return plan.accept(i, BALANCE.costs.demolishTile, DemolishOp.Surface);
  if ((w.zone[i] as number) !== ZoneType.None) return plan.accept(i, 0, DemolishOp.Zone);
  if ((w.trees[i] as number) > 0) return plan.accept(i, BALANCE.costs.clearTrees, DemolishOp.Trees);
}

function footprintOf(world: World, b: BuildingRecord): number[] {
  const out: number[] = [];
  for (let dy = 0; dy < b.h; dy++)
    for (let dx = 0; dx < b.w; dx++) out.push(world.index(b.x + dx, b.y + dy));
  return out;
}

function planPlace(
  ctx: PlanContext,
  kind: PlaceableKind,
  x0: number,
  y0: number,
  plan: PlanBuilder,
): void {
  const w = ctx.world;
  const spec = PLACEABLE_SPECS[kind];
  plan.atomic = true;
  if (!w.inBounds(x0, y0) || !w.inBounds(x0 + spec.size - 1, y0 + spec.size - 1)) {
    plan.outOfBounds++;
    plan.reject(-1, RejectReason.OutOfBounds);
    return;
  }
  if (spec.minPopulation > 0 && ctx.population < spec.minPopulation) {
    for (let y = y0; y < y0 + spec.size; y++) {
      for (let x = x0; x < x0 + spec.size; x++) plan.reject(w.index(x, y), RejectReason.Locked);
    }
    return;
  }
  const h0 = w.elevation(x0, y0);
  let cost = spec.cost;
  for (let y = y0; y < y0 + spec.size; y++) {
    for (let x = x0; x < x0 + spec.size; x++) {
      const i = w.index(x, y);
      if ((w.fire[i] as number) > 0) plan.reject(i, RejectReason.OnFire);
      else if (w.isWater(i) || (w.flood[i] as number) > 0) plan.reject(i, RejectReason.Water);
      else if (w.hasInfra(i, Infra.Rubble)) plan.reject(i, RejectReason.Rubble);
      else if ((w.buildingId[i] as number) !== 0 || w.hasInfra(i, Infra.Road | Infra.PowerLine)) {
        plan.reject(i, RejectReason.Occupied);
      } else if (!w.isFlat(x, y) || w.elevation(x, y) !== h0)
        plan.reject(i, RejectReason.NotFlatFootprint);
      else {
        plan.valid.push(i);
        cost += treeCost(w, i);
      }
    }
  }
  plan.cost = cost;
  const origin = w.index(x0, y0);
  if (spec.requiresWater && !footprintTouches(w, x0, y0, spec.size, (i) => w.isWater(i))) {
    plan.reject(origin, RejectReason.NeedsWater);
  } else if (
    spec.requiresRoad &&
    !footprintTouches(w, x0, y0, spec.size, (i) => w.hasInfra(i, Infra.Road), true)
  ) {
    plan.reject(origin, RejectReason.NeedsRoad);
  }
}

/** True when a neighbour of the square footprint matches `pred`. */
export function footprintTouches(
  world: World,
  x0: number,
  y0: number,
  size: number,
  pred: (i: number) => boolean,
  orthogonal = false,
): boolean {
  for (let y = y0 - 1; y <= y0 + size; y++) {
    for (let x = x0 - 1; x <= x0 + size; x++) {
      const outsideX = x < x0 || x >= x0 + size;
      const outsideY = y < y0 || y >= y0 + size;
      if (!outsideX && !outsideY) continue;
      if (orthogonal && outsideX && outsideY) continue;
      if (world.inBounds(x, y) && pred(world.index(x, y))) return true;
    }
  }
  return false;
}

function planLevel(ctx: PlanContext, area: Area, plan: PlanBuilder): void {
  const w = ctx.world;
  const sx = Math.min(Math.max(area.x0, 0), w.size - 1);
  const sy = Math.min(Math.max(area.y0, 0), w.size - 1);
  const target = w.elevation(sx, sy);
  planHeightChange(ctx, area, plan, () => target);
}

/** Raise, lower or flatten: set each vertex in the rectangle, then keep |Δh| ≤ 1. */
function planHeightChange(
  ctx: PlanContext,
  area: Area,
  plan: PlanBuilder,
  targetOf: (current: number) => number,
): void {
  const w = ctx.world;
  plan.atomic = true;
  const r = normalizeArea(area);
  const x0 = Math.max(0, r.x0);
  const y0 = Math.max(0, r.y0);
  const x1 = Math.min(w.size - 1, r.x1);
  const y1 = Math.min(w.size - 1, r.y1);
  if (x0 > x1 || y0 > y1) {
    plan.outOfBounds++;
    return;
  }
  const vs = w.vertexSize;
  const next = new Map<number, number>();
  const queue: number[] = [];
  const heightOf = (v: number): number => next.get(v) ?? (w.heights[v] as number);

  for (let vy = y0; vy <= y1 + 1; vy++) {
    for (let vx = x0; vx <= x1 + 1; vx++) {
      const v = vy * vs + vx;
      const target = targetOf(heightOf(v));
      if (heightOf(v) !== target) {
        next.set(v, target);
        queue.push(v);
      }
    }
  }
  // Propagate the slope constraint (|Δh| <= 1 between orthogonal vertices) outwards.
  for (let q = 0; q < queue.length; q++) {
    const v = queue[q] as number;
    const h = heightOf(v);
    const vx = v % vs;
    const vy = (v / vs) | 0;
    const neighbors = [
      vx > 0 ? v - 1 : -1,
      vx < vs - 1 ? v + 1 : -1,
      vy > 0 ? v - vs : -1,
      vy < vs - 1 ? v + vs : -1,
    ];
    for (const n of neighbors) {
      if (n < 0) continue;
      const hn = heightOf(n);
      if (hn > h + 1) next.set(n, h + 1);
      else if (hn < h - 1) next.set(n, h - 1);
      else continue;
      queue.push(n);
    }
  }
  if (next.size === 0) return;

  let units = 0;
  const affected = new Set<number>();
  for (const [v, h] of next) {
    units += Math.abs(h - (w.heights[v] as number));
    plan.heights.push([v, h]);
    const vx = v % vs;
    const vy = (v / vs) | 0;
    for (const [tx, ty] of [
      [vx - 1, vy - 1],
      [vx, vy - 1],
      [vx - 1, vy],
      [vx, vy],
    ] as const) {
      if (w.inBounds(tx, ty)) affected.add(w.index(tx, ty));
    }
  }
  for (const i of [...affected].sort((a, b) => a - b)) {
    if (
      (w.buildingId[i] as number) !== 0 ||
      w.hasInfra(i, SURFACE_BLOCKERS) ||
      (w.fire[i] as number) > 0
    ) {
      plan.reject(i, RejectReason.LevelAffectsConstruction);
    } else if ((w.zone[i] as number) !== ZoneType.None && !isFlatAfter(w, i, heightOf)) {
      plan.reject(i, RejectReason.LevelAffectsConstruction);
    } else plan.valid.push(i);
  }
  plan.cost = units * BALANCE.costs.levelPerUnit;
}

function isFlatAfter(w: World, i: number, heightOf: (v: number) => number): boolean {
  const vs = w.vertexSize;
  const n = w.yOf(i) * vs + w.xOf(i);
  const h = heightOf(n);
  return heightOf(n + 1) === h && heightOf(n + vs) === h && heightOf(n + vs + 1) === h;
}
