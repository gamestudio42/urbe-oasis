import { PLACEABLE_SPECS, isZoneKind, type BuildingRecord } from '@city/shared';
import {
  buildTown,
  createEngine,
  diagnoseTile,
  type SimulationEngine,
} from '@city/simulation';
import { describe, expect, it } from 'vitest';

/**
 * The inspector has to explain an Oasis failure without asking the worker again. These tests feed
 * the same hints the UI computes from `CityStats.oasis` plus the mirrored building.
 */

function oasisTown(): SimulationEngine {
  const e = createEngine({
    seed: 'neon-diag',
    size: 64,
    ruleset: 'oasis',
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    funds: 400_000,
  });
  e.disastersEnabled = false;
  buildTown(e);
  // The caravanserai is a service with jobs, so the sandstorm hints have a target to describe.
  e.execute({ type: 'place', kind: 'caravanserai', x: 38, y: 21 });
  return e;
}

function serviceOf(e: SimulationEngine): BuildingRecord | undefined {
  return [...e.buildings.values()].find(
    (b) => !isZoneKind(b.kind) && PLACEABLE_SPECS[b.kind].jobs > 0 && b.offline === 0,
  );
}

function codes(
  e: SimulationEngine,
  x: number,
  y: number,
  hints: NonNullable<Parameters<typeof diagnoseTile>[0]['oasis']>,
): string[] {
  const s = e.stats();
  return diagnoseTile(
    {
      world: e.world,
      building: (id) => e.buildings.get(id),
      demand: s.demand,
      taxes: s.taxes,
      power: s.power,
      oasis: hints,
    },
    x,
    y,
  ).map((p) => p.code);
}

const calm = { parched: false, owner: null, buried: false, unguarded: false, arcades: false };

describe('Oasis diagnostics', () => {
  it('reports a buried service first', () => {
    const e = oasisTown();
    const service = serviceOf(e);
    expect(service).toBeDefined();
    if (!service) return;
    const found = codes(e, service.x, service.y, { ...calm, buried: true });
    expect(found).toContain('BURIED');
    // Weight 3 outranks every other hint.
    expect(found[0]).toBe('BURIED');
  });

  it('reports an parched district', () => {
    const e = oasisTown();
    const found = codes(e, 20, 20, { ...calm, parched: true });
    expect(found).toContain('WATER_STRESS');
  });

  it('reports corporate ownership', () => {
    const e = oasisTown();
    const found = codes(e, 20, 20, { ...calm, owner: '#1' });
    expect(found).toContain('CARAVAN_LOT');
  });

  it('reports a missing windbreak', () => {
    const e = oasisTown();
    const found = codes(e, 20, 20, { ...calm, unguarded: true });
    expect(found).toContain('NO_WINDBREAK');
  });

  it('adds nothing when the Oasis hints are calm', () => {
    const e = oasisTown();
    const found = codes(e, 20, 20, calm);
    for (const code of ['BURIED', 'WATER_STRESS', 'CARAVAN_LOT', 'NO_WINDBREAK', 'NO_SHADE']) {
      expect(found).not.toContain(code);
    }
  });

  it('reports a zoned lot that is not on the data network', () => {
    const e = oasisTown();
    // Residential block north of the avenue. The town has water pipes and no canal yet.
    const found = codes(e, 10, 16, calm);
    expect(found).toContain('NO_SHADE');
    const service = serviceOf(e);
    expect(service).toBeDefined();
    if (!service) return;
    expect(codes(e, service.x, service.y, calm)).not.toContain('NO_SHADE');
  });

  it('keeps the classic diagnostics free of Oasis codes', () => {
    const e = createEngine({
      seed: 'classic-diag',
      size: 64,
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
      funds: 400_000,
    });
    e.disastersEnabled = false;
    buildTown(e);
    const s = e.stats();
    const found = diagnoseTile(
      {
        world: e.world,
        building: (id) => e.buildings.get(id),
        demand: s.demand,
        taxes: s.taxes,
        power: s.power,
      },
      20,
      20,
    ).map((p) => p.code);
    for (const code of ['BURIED', 'WATER_STRESS', 'CARAVAN_LOT', 'NO_WINDBREAK', 'ARCADE', 'NO_SHADE']) {
      expect(found).not.toContain(code);
    }
  });
});
