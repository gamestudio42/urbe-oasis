import {
  BALANCE,
  Infra,
  ZONE_SPECS,
  ZoneDensity,
  ZoneType,
  type BuildingRecord,
  type ZoneBuildingKind,
} from '@city/shared';
import type { SimulationEngine } from '../engine';
import { tileVariant } from '../world/variant';
import type { CityTotals } from './demand';
import type { RoadNetwork } from './roads';
import { hasDestination, type ComponentStats } from './traffic';
import { oasisCapacity, oasisMaxLevel } from './oasis/vertical';

export const ZONE_KIND: Record<number, ZoneBuildingKind> = {
  [ZoneType.Residential]: 'residential',
  [ZoneType.Commercial]: 'commercial',
  [ZoneType.Industrial]: 'industrial',
};

const TRANSPORT_BY_DISTANCE = [1, 1, 0.7, 0.4] as const;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** 1 / 0.7 / 0.4 for a road within 1 / 2 / 3 tiles, reduced by that road's congestion. */
export function transportScore(engine: SimulationEngine, roads: RoadNetwork, i: number): number {
  const d = roads.accessDistance[i] as number;
  if (d >= TRANSPORT_BY_DISTANCE.length) return 0;
  const road = roads.accessRoad[i] as number;
  const congestion = Math.min(1, (engine.world.influence.traffic[road] as number) / 128);
  return (TRANSPORT_BY_DISTANCE[d] as number) * (1 - 0.5 * congestion);
}

/** Attractiveness 0..1 of a zone tile for a zone kind (spec section 5). */
export function attractiveness(
  engine: SimulationEngine,
  roads: RoadNetwork,
  i: number,
  kind: ZoneBuildingKind,
): number {
  const w = engine.world;
  const inf = w.influence;
  const access = (inf.access[i] as number) / 255;
  const land = (inf.landValue[i] as number) / 255;
  const pollution = (inf.pollution[i] as number) / 255;
  const crime = (inf.crime[i] as number) / 255;
  const power = w.powered[i] === 1 ? 1 : 0;
  const water = w.watered[i] === 1 ? 1 : 0;
  const transport = transportScore(engine, roads, i);
  const police = (inf.police[i] as number) / 255;
  const fire = (inf.fireCover[i] as number) / 255;
  if (kind === 'residential') {
    const a = BALANCE.attractiveness.residential;
    const services =
      (police + fire + (inf.health[i] as number) / 255 + (inf.education[i] as number) / 255) / 4;
    return clamp01(
      a.access * access +
        a.landValue * land +
        a.services * services +
        a.power * power +
        a.water * water +
        a.transport * transport -
        a.pollution * pollution -
        a.crime * crime,
    );
  }
  if (kind === 'commercial') {
    const a = BALANCE.attractiveness.commercial;
    return clamp01(
      a.access * access +
        a.landValue * land +
        a.transport * transport +
        a.power * power +
        a.water * water +
        a.services * ((police + fire) / 2) +
        a.base -
        a.crime * crime -
        a.pollution * pollution,
    );
  }
  const a = BALANCE.attractiveness.industrial;
  return clamp01(
    a.access * access +
      a.transport * transport +
      a.power * power +
      a.water * water +
      a.cheapLand * (1 - land) +
      a.fireCover * fire +
      a.base -
      a.crime * crime,
  );
}

export function maxLevel(
  density: number,
  watered: boolean,
  oasis = false,
  linked = true,
): number {
  const z = BALANCE.zones;
  const cap = density === ZoneDensity.Dense ? z.maxLevelDense : z.maxLevelLight;
  const classic = watered ? cap : Math.min(cap, z.maxLevelWithoutWater);
  return oasis ? oasisMaxLevel(density, watered, true, classic, linked) : classic;
}

export interface GrowthContext {
  totals: CityTotals;
  roads: RoadNetwork;
  components: ComponentStats;
  /** Residential occupancy factor during an epidemic (1 otherwise). */
  epidemic: number;
}

export interface GrowthResult {
  spawned: number;
  upgraded: number;
  downgraded: number;
  abandoned: number;
  recovered: number;
}

/** Monthly growth pass over zone tiles in index order (one RNG draw per decision). */
export function updateGrowth(engine: SimulationEngine, ctx: GrowthContext): GrowthResult {
  const w = engine.world;
  const g = BALANCE.growth;
  const result: GrowthResult = {
    spawned: 0,
    upgraded: 0,
    downgraded: 0,
    abandoned: 0,
    recovered: 0,
  };
  const { totals, roads } = ctx;
  const laborRatio =
    (totals.workforce + g.externalWorkers) /
    Math.max(totals.commercialJobs + totals.industrialJobs, 1);

  for (let i = 0; i < w.tileCount; i++) {
    const zone = w.zone[i] as number;
    if (zone === ZoneType.None) continue;
    const kind = ZONE_KIND[zone] as ZoneBuildingKind;
    const demand = engine.demand[kind];
    const id = w.buildingId[i] as number;
    if (id !== 0) {
      const b = engine.buildings.get(id);
      if (b && b.kind === kind) updateBuilding(engine, b, i, demand, laborRatio, ctx, result);
      continue;
    }
    if (demand <= 0 || !roads.hasAccess(i) || w.powered[i] !== 1) continue;
    if ((w.fire[i] as number) > 0 || (w.flood[i] as number) > 0 || w.hasInfra(i, Infra.Rubble))
      continue;
    if (!hasDestination(ctx.components, roads, i, zone as ZoneType)) continue;
    const a = attractiveness(engine, roads, i, kind);
    if (engine.rng.next() >= g.spawnRate * demand * a) continue;
    const x = w.xOf(i);
    const y = w.yOf(i);
    w.setLayer('trees', i, 0);
    const oasis = engine.ruleset === 'oasis';
    engine.buildings.add({
      kind,
      x,
      y,
      w: 1,
      h: 1,
      level: 1,
      capacity: oasis ? oasisCapacity(kind, 1) : (ZONE_SPECS[kind].capacity[1] as number),
      occupancy: 0,
      condition: 100,
      age: 0,
      abandoned: false,
      emptyMonths: 0,
      variant: tileVariant(x, y),
      powered: true,
      watered: w.watered[i] === 1,
      ...(oasis ? { linked: w.linked[i] === 1 } : {}),
      offline: 0,
      attractiveness: Math.round(a * 1000) / 1000,
    });
    result.spawned++;
  }
  return result;
}

function updateBuilding(
  engine: SimulationEngine,
  b: BuildingRecord,
  i: number,
  demand: number,
  laborRatio: number,
  ctx: GrowthContext,
  result: GrowthResult,
): void {
  const w = engine.world;
  const g = BALANCE.growth;
  const kind = b.kind as ZoneBuildingKind;
  const spec = ZONE_SPECS[kind];
  const hasRoad =
    ctx.roads.hasAccess(i) && hasDestination(ctx.components, ctx.roads, i, w.zone[i] as ZoneType);
  const powered = w.powered[i] === 1;
  const a = attractiveness(engine, ctx.roads, i, kind);
  b.age++;
  b.attractiveness = Math.round(a * 1000) / 1000;

  if (b.abandoned) {
    if (
      a >= g.recoverAttractiveness &&
      demand > g.recoverDemand &&
      hasRoad &&
      powered &&
      engine.rng.chance(g.recoverRate)
    ) {
      b.abandoned = false;
      b.level = 1;
      b.capacity = spec.capacity[1];
      b.occupancy = 0;
      b.condition = 60;
      b.emptyMonths = 0;
      engine.buildings.touch(b);
      w.markDirty(i);
      result.recovered++;
    }
    return;
  }

  // Occupancy moves part of the way towards its target each month.
  let target = 0;
  if (hasRoad && powered) {
    if (kind === 'residential') {
      const r = g.residentialOccupancy;
      target = b.capacity * clamp01(r.base + r.attract * a + r.demand * demand) * ctx.epidemic;
    } else {
      const j = g.jobOccupancy;
      target = b.capacity * clamp01(laborRatio) * clamp01(j.base + j.attract * a);
    }
  }
  const delta = (target - b.occupancy) * g.occupancyRate;
  b.occupancy = Math.max(
    0,
    Math.min(b.capacity, b.occupancy + (delta >= 0 ? Math.ceil(delta) : Math.floor(delta))),
  );

  const oasis = engine.ruleset === 'oasis';
  const cap = maxLevel(
    w.zoneDensity[i] as number,
    w.watered[i] === 1,
    oasis,
    oasis && w.linked[i] === 1,
  );
  const threshold = g.upgradeThresholds[b.level] ?? g.upgradeThresholds[g.upgradeThresholds.length - 1];
  if (
    b.level < cap &&
    b.occupancy >= g.upgradeOccupancy * b.capacity &&
    demand > g.upgradeDemand &&
    a >= (threshold as number) &&
    engine.rng.chance(g.upgradeRate * clamp01(g.upgradeBias + g.upgradeDemandGain * demand))
  ) {
    b.level++;
    b.capacity = oasis ? oasisCapacity(kind, b.level) : (spec.capacity[b.level] as number);
    engine.buildings.touch(b);
    w.markDirty(i);
    result.upgraded++;
  } else if (
    b.level > 1 &&
    b.occupancy < g.downgradeOccupancy * b.capacity &&
    demand < g.downgradeDemand &&
    engine.rng.chance(g.downgradeRate)
  ) {
    b.level--;
    b.capacity = oasis ? oasisCapacity(kind, b.level) : (spec.capacity[b.level] as number);
    b.occupancy = Math.min(b.occupancy, b.capacity);
    engine.buildings.touch(b);
    w.markDirty(i);
    result.downgraded++;
  }

  const decaying = a < g.decayAttractiveness || !powered || !hasRoad;
  b.condition = Math.max(
    0,
    Math.min(100, b.condition + (decaying ? -g.conditionLoss : g.conditionGain)),
  );
  b.emptyMonths = b.occupancy === 0 ? b.emptyMonths + 1 : 0;
  if (b.condition <= 0 || b.emptyMonths >= g.abandonEmptyMonths) {
    b.abandoned = true;
    b.occupancy = 0;
    engine.buildings.touch(b);
    w.markDirty(i);
    result.abandoned++;
  }
}
