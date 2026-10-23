import {
  BALANCE,
  Infra,
  OASIS_SHADE,
  PLACEABLE_SPECS,
  ZoneDensity,
  ZoneType,
  isZoneKind,
  type BuildingRecord,
  type Problem,
  type ProblemCode,
  type RciValues,
  type UtilityStats,
  type ZoneBuildingKind,
} from '@city/shared';
import { maxLevel, ZONE_KIND } from './systems/growth';
import { RoadNetwork } from './systems/roads';
import { gatewayRoads, hubRoad } from './systems/traffic';
import type { World } from './world/world';

/** Everything diagnostics need; works on the engine or on the UI's mirror world. */
export interface DiagnoseContext {
  world: World;
  building(id: number): BuildingRecord | undefined;
  demand: RciValues;
  taxes: RciValues;
  power: UtilityStats;
  /** Reused between calls when available; built from `world` otherwise. */
  roads?: RoadNetwork;
  /** Neon-only hints; omitted by the classic UI. */
  oasis?: {
    /** District is above the grid overload threshold. */
    parched: boolean;
    /** Caravan that owns the lot, if any. */
    owner: string | null;
    /** Service is offline because of an intrusion. */
    hacked: boolean;
    /** No windbreak node covers this tile. */
    unguarded: boolean;
    /** Drone lanes cross this district. */
    drones: boolean;
  };
}

const THRESHOLDS = {
  pollution: { major: 96, minor: 48 },
  crime: { major: 120, minor: 70 },
  lowLandValue: 40,
  congestion: { major: 160, minor: 100 },
  lowAccess: 64,
  taxes: { major: 12, minor: 9 },
} as const;

const NO_DESTINATION: Record<ZoneBuildingKind, ProblemCode> = {
  residential: 'NO_JOB_ACCESS',
  commercial: 'NO_CUSTOMERS',
  industrial: 'NO_WORKERS',
};

/**
 * Explains why a tile is (not) developing, ordered by severity (3 = blocking). Mirrors the
 * growth rules of the engine; see docs/simulation-spec.md section 12.
 */
export function diagnoseTile(ctx: DiagnoseContext, x: number, y: number): Problem[] {
  const w = ctx.world;
  if (!w.inBounds(x, y)) return [];
  const i = w.index(x, y);
  const id = w.buildingId[i] as number;
  const building = id === 0 ? undefined : ctx.building(id);
  const problems: Problem[] = [];
  const add = (code: ProblemCode, severity: Problem['severity']) =>
    problems.push({ code, severity });

  if ((w.fire[i] as number) > 0) add('ON_FIRE', 3);
  if (w.hasInfra(i, Infra.Rubble)) add('RUBBLE', 3);
  if ((w.flood[i] as number) > 0) add('FLOODED', 3);

  const neon = ctx.oasis;
  if (neon?.hacked) add('BURIED', 3);
  if (neon?.parched) add('WATER_STRESS', 2);
  if (neon?.owner) add('CARAVAN_LOT', 1);
  if (neon?.unguarded) add('NO_WINDBREAK', 1);
  if (neon?.drones) add('ARCADE', 0);

  if (building && !isZoneKind(building.kind)) {
    const spec = PLACEABLE_SPECS[building.kind];
    const needsPower = spec.powerUse > 0;
    if (needsPower && !building.powered) add(powerProblem(ctx), 3);
    if (neon && (building.kind === 'windbreak' || building.kind === 'arcade') && w.linked[i] !== 1) {
      add('NO_SHADE', 2);
    }
    if (spec.requiresRoad) {
      const roads = ctx.roads ?? new RoadNetwork(w);
      roads.update();
      if (hubRoad(w, roads, building) < 0) add('NO_ROAD', 3);
    }
    return sortProblems(problems);
  }

  const zone = w.zone[i] as ZoneType;
  const kind: ZoneBuildingKind | undefined = building
    ? (building.kind as ZoneBuildingKind)
    : ZONE_KIND[zone];
  if (!kind) {
    if (problems.length === 0) add('NO_ZONE', 0);
    return sortProblems(problems);
  }
  if (building?.abandoned) add('ABANDONED', 3);

  const roads = ctx.roads ?? new RoadNetwork(w);
  roads.update();
  if (!roads.hasAccess(i)) {
    add('NO_ROAD', 3);
  } else if (!reachesDestination(ctx, roads, i, zone)) {
    add(NO_DESTINATION[kind], 3);
  } else if ((w.influence.access[i] as number) < THRESHOLDS.lowAccess) {
    add(NO_DESTINATION[kind], 2);
  }
  if (w.powered[i] !== 1) add(powerProblem(ctx), 3);
  if (ctx.demand[kind] <= 0) add('LOW_DEMAND', 2);

  const tax = ctx.taxes[kind];
  if (tax >= THRESHOLDS.taxes.major) add('HIGH_TAXES', 2);
  else if (tax >= THRESHOLDS.taxes.minor) add('HIGH_TAXES', 1);

  const density = w.zoneDensity[i] as number;
  const watered = w.watered[i] === 1;
  const neonCity = neon !== undefined;
  const linked = w.linked[i] === 1;
  if (!watered && density === ZoneDensity.Dense) {
    const capped = building ? building.level >= BALANCE.zones.maxLevelWithoutWater : false;
    add('NO_WATER_FOR_LEVEL', capped ? 2 : 1);
  }
  if (neonCity && !linked) {
    const capped = building ? building.level >= OASIS_SHADE.maxLevelWithoutShade : false;
    add('NO_SHADE', capped ? 2 : 1);
  }

  const inf = w.influence;
  if (kind !== 'industrial') {
    const p = inf.pollution[i] as number;
    if (p >= THRESHOLDS.pollution.major) add('POLLUTION', 2);
    else if (p >= THRESHOLDS.pollution.minor) add('POLLUTION', 1);
    if ((inf.landValue[i] as number) < THRESHOLDS.lowLandValue) add('LOW_LAND_VALUE', 1);
  }
  const crime = inf.crime[i] as number;
  if (crime >= THRESHOLDS.crime.major) add('CRIME', 2);
  else if (crime >= THRESHOLDS.crime.minor) add('CRIME', 1);

  const road = roads.accessRoad[i] as number;
  if (road >= 0) {
    const traffic = inf.traffic[road] as number;
    if (traffic >= THRESHOLDS.congestion.major) add('CONGESTION', 2);
    else if (traffic >= THRESHOLDS.congestion.minor) add('CONGESTION', 1);
  }

  if (
    building &&
    !building.abandoned &&
    building.level >= maxLevel(density, watered, neonCity, linked)
  ) {
    add('MAX_LEVEL', 0);
  }
  if (!problems.some((p) => p.severity >= 2)) add('GROWING', 0);
  return sortProblems(problems);
}

function powerProblem(ctx: DiagnoseContext): ProblemCode {
  return ctx.power.supply > 0 && ctx.power.demand > ctx.power.supply ? 'BROWNOUT' : 'NO_POWER';
}

/** Same rule as `hasDestination` in the traffic system, evaluated on demand. */
function reachesDestination(
  ctx: DiagnoseContext,
  roads: RoadNetwork,
  i: number,
  zone: ZoneType,
): boolean {
  const w = ctx.world;
  const c = roads.componentOf(i);
  if (c === 0) return false;
  if (roads.edgeConnected[c] === 1) return true;
  for (const g of gatewayRoads(w, roads, worldBuildings(ctx))) {
    if (roads.componentOf(g) === c) return true;
  }
  for (let t = 0; t < w.tileCount; t++) {
    const z = w.zone[t] as ZoneType;
    if (z === ZoneType.None) continue;
    const isTarget =
      zone === ZoneType.Residential ? z !== ZoneType.Residential : z === ZoneType.Residential;
    if (isTarget && roads.componentOf(t) === c) return true;
  }
  return false;
}

/** Placeable buildings on the map, each once (zone buildings never act as gateways). */
function worldBuildings(ctx: DiagnoseContext): BuildingRecord[] {
  const seen = new Set<number>();
  const list: BuildingRecord[] = [];
  const ids = ctx.world.buildingId;
  for (let t = 0; t < ids.length; t++) {
    const id = ids[t] as number;
    if (id === 0 || seen.has(id)) continue;
    seen.add(id);
    const b = ctx.building(id);
    if (b && !isZoneKind(b.kind)) list.push(b);
  }
  return list;
}

function sortProblems(problems: Problem[]): Problem[] {
  return problems
    .map((p, order) => ({ p, order }))
    .sort((a, b) => b.p.severity - a.p.severity || a.order - b.order)
    .map(({ p }) => p);
}
