import { OASIS_STORM, PLACEABLE_SPECS, isZoneKind, type BuildingRecord } from '@city/shared';
import {
  activeStorm,
  buildTown,
  shelterCoverage,
  createEngine,
  windbreakCoverage,
  tickStorms,
  updateStorms,
  type SimulationEngine,
} from '@city/simulation';
import { describe, expect, it } from 'vitest';

/**
 * A flat neon city with the standard town plus a corporate HQ, which is the simplest building
 * the intrusion pass can target: a non-zone service with jobs in the neon ruleset.
 */
function hackTown(seed = 'neon-hack'): SimulationEngine {
  const e = createEngine({
    seed,
    size: 64,
    ruleset: 'oasis',
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    funds: 400_000,
  });
  e.disastersEnabled = false;
  buildTown(e);
  const hq = e.execute({ type: 'place', kind: 'caravanserai', x: 38, y: 21 });
  expect(hq.ok).toBe(true);
  e.refreshUtilities();
  return e;
}

/** The corporate HQ, the service the intrusion pass can target. */
function serviceOf(e: SimulationEngine): BuildingRecord | undefined {
  return [...e.buildings.values()].find(
    (b) => !isZoneKind(b.kind) && !b.abandoned && PLACEABLE_SPECS[b.kind].jobs > 0,
  );
}

describe('neon storms', () => {
  it('only rolls once per month', () => {
    const e = hackTown();
    const first = updateStorms(e);
    const second = updateStorms(e);
    expect(first.attempts).toBeLessThanOrEqual(1);
    expect(second).toEqual({ attempts: 0, blocked: 0, offline: 0 });
  });

  it('attempts storms across seeds and never exceeds one attempt per month', () => {
    let attempts = 0;
    for (let seed = 0; seed < 30; seed++) {
      const e = hackTown(`hack-${seed}`);
      attempts += updateStorms(e).attempts;
    }
    expect(attempts).toBeGreaterThan(0);
    expect(attempts).toBeLessThanOrEqual(30);
    expect(OASIS_STORM.maxChance).toBeLessThanOrEqual(1);
  });

  it('takes a hacked service offline for the configured window', () => {
    const e = hackTown();
    const service = serviceOf(e);
    expect(service).toBeDefined();
    if (!service) return;
    service.offline = OASIS_STORM.offlineTicks;
    e.oasis.storms.push({
      buildingId: service.id,
      ticks: OASIS_STORM.offlineTicks,
      windbreak: 0,
      kind: 'ransom',
    });
    expect(activeStorm(e, service.id)).toBe(true);
    for (let k = 0; k < OASIS_STORM.offlineTicks; k++) tickStorms(e);
    expect(activeStorm(e, service.id)).toBe(false);
    expect(service.offline).toBe(0);
  });

  it('measures windbreak coverage from a powered node inside the radius', () => {
    const e = hackTown();
    const service = serviceOf(e);
    expect(service).toBeDefined();
    if (!service) return;
    expect(windbreakCoverage(e, service)).toBe(0);
    expect(e.execute({ type: 'place', kind: 'windbreak', x: service.x, y: service.y + 3 }).ok).toBe(
      true,
    );
    e.refreshUtilities();
    expect(windbreakCoverage(e, service)).toBeGreaterThan(0);
    expect(windbreakCoverage(e, service)).toBeLessThanOrEqual(1);
  });

  it('ignores windbreak nodes that are offline', () => {
    const e = hackTown();
    const service = serviceOf(e);
    expect(service).toBeDefined();
    if (!service) return;
    e.execute({ type: 'place', kind: 'windbreak', x: service.x, y: service.y + 3 });
    e.refreshUtilities();
    const node = e.buildings.ofKind('windbreak')[0];
    expect(node).toBeDefined();
    if (!node) return;
    expect(windbreakCoverage(e, service)).toBeGreaterThan(0);
    node.offline = 10;
    expect(windbreakCoverage(e, service)).toBe(0);
  });

  it('ignores windbreak nodes outside the radius', () => {
    const e = hackTown();
    const service = serviceOf(e);
    expect(service).toBeDefined();
    if (!service) return;
    const far = OASIS_STORM.windbreakRadius + 4;
    expect(e.execute({ type: 'place', kind: 'windbreak', x: service.x + far, y: service.y }).ok).toBe(
      true,
    );
    e.refreshUtilities();
    const node = e.buildings.ofKind('windbreak')[0];
    expect(node).toBeDefined();
    if (!node) return;
    node.powered = true;
    expect(windbreakCoverage(e, service)).toBe(0);
  });

  it('reports city-wide coverage between zero and one', () => {
    const e = hackTown();
    const coverage = shelterCoverage(e);
    expect(coverage).toBeGreaterThanOrEqual(0);
    expect(coverage).toBeLessThanOrEqual(1);
  });

  it('is deterministic for the same seed', () => {
    const a = hackTown('hack-same');
    const b = hackTown('hack-same');
    a.runMonths(12);
    b.runMonths(12);
    expect(a.oasis.storms).toEqual(b.oasis.storms);
    expect(a.oasis.blocked).toBe(b.oasis.blocked);
  });

  it('stays silent in the classic ruleset', () => {
    const e = createEngine({
      seed: 'classic-hack',
      size: 64,
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
      funds: 400_000,
    });
    e.disastersEnabled = false;
    buildTown(e);
    e.runMonths(12);
    expect(e.oasis.storms).toEqual([]);
    expect(e.oasis.blocked).toBe(0);
  });
});
