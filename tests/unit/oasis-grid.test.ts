import { BALANCE, OASIS_WATER, OASIS_HEAT, PLACEABLE_SPECS } from '@city/shared';
import {
  cisternSummary,
  createEngine,
  isParched,
  oasisCapacity,
  oasisMaxLevel,
  SimulationEngine,
} from '@city/simulation';
import { describe, expect, it } from 'vitest';

/** A flat Oasis city with a road, a coal plant and a few dense residential lots. */
function oasisTown(size = 40): SimulationEngine {
  const e = createEngine({
    seed: 'neon-grid',
    size,
    name: 'Oasis',
    ruleset: 'oasis',
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    funds: 200_000,
  });
  e.disastersEnabled = false;
  e.execute({ type: 'road', x0: 4, y0: 10, x1: 30, y1: 10 });
  e.execute({ type: 'place', kind: 'coalPlant', x: 6, y: 12 });
  return e;
}

describe('Oasis water grid', () => {
  it('keeps a lightly loaded component out of overload', () => {
    const e = oasisTown();
    e.runMonths(2);
    expect(e.oasis.parched).toEqual([]);
    expect(isParched(e, e.world.index(10, 10))).toBe(false);
  });

  it('adds qanat supply to the water network', () => {
    const e = oasisTown();
    e.refreshUtilities();
    const before = e.stats().water.supply;
    expect(e.execute({ type: 'place', kind: 'qanat', x: 9, y: 12 }).ok).toBe(true);
    e.refreshUtilities();
    expect(e.stats().water.supply).toBe(before + OASIS_WATER.qanatSupply);
  });

  it('charges an idle cistern bank and reports it', () => {
    const e = oasisTown();
    // The coal plant footprint is 3x3 at (6,12); the bank sits on its east edge.
    expect(e.execute({ type: 'place', kind: 'well', x: 9, y: 12 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'cistern', x: 10, y: 12 }).ok).toBe(true);
    e.runMonths(1);
    e.refreshUtilities();
    const summary = cisternSummary(e);
    expect(summary.banks).toBe(1);
    expect(summary.charge).toBeGreaterThan(0);
  });

  it('spends cistern charge only on the water the district is missing', () => {
    const e = createEngine({
      seed: 'cistern-spend',
      size: 32,
      ruleset: 'oasis',
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
      funds: 400_000,
    });
    e.disastersEnabled = false;
    expect(e.execute({ type: 'place', kind: 'coalPlant', x: 4, y: 4 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'well', x: 7, y: 4 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'cistern', x: 7, y: 5 }).ok).toBe(true);
    for (const x of [8, 9]) {
      e.buildings.add({
        kind: 'residential',
        x,
        y: 4,
        w: 1,
        h: 1,
        level: 5,
        capacity: 40,
        occupancy: 10,
        condition: 100,
        age: 0,
        abandoned: false,
        emptyMonths: 0,
        variant: 0,
        powered: true,
        watered: false,
        offline: 0,
        attractiveness: 0,
      });
    }
    const bank = e.buildings.ofKind('cistern')[0];
    expect(bank).toBeDefined();
    if (!bank) return;
    const stored = e.oasis.cisterns.find((c) => c.buildingId === bank.id);
    if (stored) stored.charge = 1;
    else e.oasis.cisterns.push({ buildingId: bank.id, charge: 1 });
    e.refreshUtilities();
    const entry = e.oasis.cisterns.find((c) => c.buildingId === bank.id);
    const well = Math.round(40 * OASIS_WATER.evaporation);
    const demand = 36 * 2;
    const spent = demand - well;
    expect(entry?.charge).toBeCloseTo(1 - spent / OASIS_WATER.cisternOutput, 5);
    expect(e.stats().water.supply).toBe(well + spent);
  });

  it('marks a component as parched past the threshold', () => {
    const e = createEngine({
      seed: 'overload',
      size: 32,
      ruleset: 'oasis',
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
      funds: 400_000,
    });
    e.disastersEnabled = false;
    // A coal plant powers a well. Two level-5 homes drink more than the well can give.
    expect(e.execute({ type: 'place', kind: 'coalPlant', x: 4, y: 4 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'well', x: 7, y: 4 }).ok).toBe(true);
    for (const x of [8, 9]) {
      e.buildings.add({
        kind: 'residential',
        x,
        y: 4,
        w: 1,
        h: 1,
        level: 5,
        capacity: 40,
        occupancy: 10,
        condition: 100,
        age: 0,
        abandoned: false,
        emptyMonths: 0,
        variant: 0,
        powered: true,
        watered: false,
        offline: 0,
        attractiveness: 0,
      });
    }
    e.refreshUtilities();
    const water = e.stats().water;
    expect(water.supply).toBe(Math.round(40 * OASIS_WATER.evaporation));
    expect(water.demand / water.supply).toBeGreaterThanOrEqual(OASIS_WATER.overloadThreshold);
    expect(e.oasis.parched.length).toBe(1);
    expect(isParched(e, e.world.index(8, 4))).toBe(true);
    expect(isParched(e, e.world.index(28, 4))).toBe(false);
  });

  it('takes a qanat offline when a parched district cascades', () => {
    const e = createEngine({
      seed: 'qanat-cascade',
      size: 32,
      ruleset: 'oasis',
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
      funds: 400_000,
    });
    e.disastersEnabled = false;
    expect(e.execute({ type: 'place', kind: 'coalPlant', x: 4, y: 4 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'well', x: 7, y: 4 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'qanat', x: 7, y: 5 }).ok).toBe(true);
    for (let x = 8; x < 18; x++) {
      e.buildings.add({
        kind: 'residential',
        x,
        y: 4,
        w: 1,
        h: 1,
        level: 5,
        capacity: 40,
        occupancy: 10,
        condition: 100,
        age: 0,
        abandoned: false,
        emptyMonths: 0,
        variant: 0,
        powered: true,
        watered: false,
        offline: 0,
        attractiveness: 0,
      });
    }
    let dried = false;
    for (let n = 0; n < 400 && !dried; n++) {
      e.refreshUtilities();
      const qanat = e.buildings.ofKind('qanat')[0];
      dried = qanat !== undefined && qanat.offline > 0;
    }
    expect(dried).toBe(true);
    const events = e.takeEvents().filter((event) => event.type === 'canalCollapse');
    expect(events.length).toBeGreaterThan(0);
  });

  it('is deterministic for the same seed and commands', () => {
    const a = oasisTown();
    const b = oasisTown();
    a.runMonths(4);
    b.runMonths(4);
    expect(a.stats()).toEqual(b.stats());
  });
});

describe('Oasis building heights', () => {
  it('raises the level cap but keeps the classic cap for a classic city', () => {
    expect(oasisMaxLevel(2, true, false, 5)).toBe(BALANCE.zones.maxLevelDense);
    expect(oasisMaxLevel(2, true, true, 5)).toBe(OASIS_HEAT.maxLevelDense);
    expect(oasisMaxLevel(1, false, true, 2)).toBeLessThanOrEqual(2);
  });

  it('extrapolates capacity past the classic table', () => {
    const classic = 400;
    expect(oasisCapacity('residential', 6)).toBeGreaterThan(classic);
    // Level 5 still reads the classic number exactly.
    expect(oasisCapacity('residential', 5)).toBe(classic);
  });

  it('keeps the Oasis-only placeables out of the classic spec costs', () => {
    expect(PLACEABLE_SPECS.qanat.waterSupply).toBeGreaterThan(0);
    expect(PLACEABLE_SPECS.cistern.cost).toBeGreaterThan(0);
  });
});
