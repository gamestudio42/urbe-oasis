import {
  OASIS_STORM,
  PLACEABLE_SPECS,
  isZoneKind,
  type BuildingRecord,
} from '@city/shared';
import type { SimulationEngine } from '../../engine';
import { nudgeSpring } from './spring';
import { monthIndex } from '../../time';

/**
 * Sandstorms (oasis ruleset).
 *
 * Once a month a city may be buried. The chance grows with population and falls with
 * windbreak coverage around the target. A storm that lands takes one service offline for
 * `offlineTicks` and nudges the spring. A blocked one only emits an event. Sand does not
 * take money.
 *
 * Target selection and the roll both use `engine.rng`, in building order after the windbreak scan.
 */

/** Kinds of sandstorm, purely for flavour and the toast copy. */
export const STORM_KINDS = ['haboob', 'drift', 'gust'] as const;
export type StormKind = (typeof STORM_KINDS)[number];

export interface StormResult {
  attempts: number;
  blocked: number;
  offline: number;
}

/** Monthly: one roll for the whole city, then one target among the services. */
export function updateStorms(engine: SimulationEngine): StormResult {
  const result: StormResult = { attempts: 0, blocked: 0, offline: 0 };
  const month = monthIndex(engine.tick);
  if (engine.oasis.lastStormMonth === month) return result;
  engine.oasis.lastStormMonth = month;

  expireStorms(engine);
  const population = cityPopulation(engine);
  const chance = Math.min(
    OASIS_STORM.maxChance,
    OASIS_STORM.baseChance + (population / 1000) * OASIS_STORM.populationChance,
  );
  if (!engine.rng.chance(chance)) return result;
  result.attempts++;

  const targets = [...engine.buildings.values()].filter(isServiceTarget);
  if (targets.length === 0) return result;
  const target = targets[engine.rng.range(0, targets.length - 1)] as BuildingRecord;
  const windbreak = windbreakCoverage(engine, target);
  const blocked = engine.rng.chance(windbreak * OASIS_STORM.windbreakMitigation);
  const kind = STORM_KINDS[engine.rng.int(STORM_KINDS.length)] as StormKind;

  if (blocked) {
    result.blocked++;
    engine.oasis.blocked++;
    engine.emit({ type: 'sandstorm', x: target.x, y: target.y, kind, blocked: true });
    return result;
  }
  target.offline = Math.max(target.offline, OASIS_STORM.offlineTicks);
  engine.buildings.touch(target);
  engine.oasis.storms.push({
    buildingId: target.id,
    ticks: OASIS_STORM.offlineTicks,
    windbreak: Math.round(windbreak * 1000) / 1000,
    kind,
  });
  const theft = Math.min(OASIS_STORM.theft, Math.max(0, engine.economy.funds));
  engine.economy.funds -= theft;
  engine.networksDirty = true;
  result.offline++;
  engine.emit({ type: 'sandstorm', x: target.x, y: target.y, kind, blocked: false });
  nudgeSpring(engine, 2);
  return result;
}

/** A service has jobs, is not a zone and is not a power plant: only those can be intruded on. */
function isServiceTarget(b: BuildingRecord): boolean {
  if (isZoneKind(b.kind) || b.abandoned) return false;
  return PLACEABLE_SPECS[b.kind].jobs > 0;
}

/**
 * Windbreak coverage 0..1 at a building: the best node within `windbreakRadius` scaled by its
 * distance, capped at 1. A node covers while it is powered and online.
 */
export function windbreakCoverage(engine: SimulationEngine, b: BuildingRecord): number {
  let best = 0;
  const radius = OASIS_STORM.windbreakRadius;
  for (const node of engine.buildings.ofKind('windbreak')) {
    if (!node.powered || node.offline > 0) continue;
    const d = Math.max(
      Math.max(node.x - b.x, b.x - (node.x + node.w - 1), 0),
      Math.max(node.y - b.y, b.y - (node.y + node.h - 1), 0),
    );
    if (d > radius) continue;
    best = Math.max(best, 1 - d / (radius + 1));
  }
  return Math.min(1, best);
}

/** City-wide share of services under windbreak cover, 0..1 (HUD and diagnostics). */
export function shelterCoverage(engine: SimulationEngine): number {
  let total = 0;
  let covered = 0;
  for (const b of engine.buildings.values()) {
    if (!isServiceTarget(b)) continue;
    total++;
    if (windbreakCoverage(engine, b) >= 0.5) covered++;
  }
  return total === 0 ? 0 : Math.round((covered / total) * 1000) / 1000;
}

/** Tick: counts down active storms, clearing the ones that expired. */
export function tickStorms(engine: SimulationEngine): void {
  if (engine.oasis.storms.length === 0) return;
  let changed = false;
  for (const storm of engine.oasis.storms) {
    storm.ticks--;
    if (storm.ticks > 0) continue;
    const b = engine.buildings.get(storm.buildingId);
    if (b && b.offline > 0) {
      b.offline = 0;
      engine.buildings.touch(b);
      changed = true;
    }
  }
  engine.oasis.storms = engine.oasis.storms.filter((i) => i.ticks > 0);
  if (changed) engine.networksDirty = true;
}

/** Drops storms whose building was demolished or destroyed. */
function expireStorms(engine: SimulationEngine): void {
  engine.oasis.storms = engine.oasis.storms.filter((i) =>
    engine.buildings.get(i.buildingId) !== undefined,
  );
}

function cityPopulation(engine: SimulationEngine): number {
  let total = 0;
  for (const b of engine.buildings.values()) {
    if (b.kind === 'residential' && !b.abandoned) total += b.occupancy;
  }
  return total;
}

/** Diagnostic: is this building currently buried by a sandstorm? */
export function activeStorm(engine: SimulationEngine, id: number): boolean {
  return engine.oasis.storms.some((i) => i.buildingId === id && i.ticks > 0);
}
