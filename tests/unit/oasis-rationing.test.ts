import {
  decodeSave,
  encodeSave,
  OASIS_SAVE_FORMAT,
  stringifySave,
  TICKS_PER_MONTH,
  type BuildingKind,
} from '@city/shared';
import { createEngine, hashState, SimulationEngine, waterDemand } from '@city/simulation';
import { computeMonthlyReport } from '../../packages/simulation/src/systems/economy';
import { updateUtilities } from '../../packages/simulation/src/systems/utilities';
import { updateGrid } from '../../packages/simulation/src/systems/oasis/grid';
import { describe, expect, it } from 'vitest';

const meta = { population: 0, funds: 200_000, savedAt: '2026-10-24T00:00:00.000Z' };
const options = { format: OASIS_SAVE_FORMAT };
function town(ruleset: 'oasis' | 'classic' = 'oasis') {
  const e = createEngine({
    seed: 'water-policy',
    size: 32,
    ruleset,
    funds: 200_000,
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
  });
  e.disastersEnabled = false;
  expect(e.execute({ type: 'place', kind: 'coalPlant', x: 4, y: 4 }).ok).toBe(true);
  expect(e.execute({ type: 'place', kind: 'well', x: 7, y: 4 }).ok).toBe(true);
  return e;
}
function lot(e: SimulationEngine, kind: BuildingKind, x: number, level = 4) {
  return e.buildings.add({
    kind,
    x,
    y: 4,
    w: 1,
    h: 1,
    level,
    capacity: 100,
    occupancy: 100,
    condition: 100,
    age: 0,
    abandoned: false,
    emptyMonths: 0,
    variant: 0,
    powered: true,
    watered: false,
    linked: false,
    offline: 0,
    attractiveness: 0,
  });
}
function load(e: SimulationEngine) {
  const decoded = decodeSave(stringifySave(encodeSave(e.serialize(), meta, options)), options);
  expect(decoded.ok).toBe(true);
  if (!decoded.ok) throw new Error(JSON.stringify(decoded.errors));
  return SimulationEngine.fromSnapshot(decoded.snapshot);
}

describe('oasis water rationing', () => {
  it('restores a near-capacity home, lowers grid stress and preserves the choice to restore normal supply', () => {
    const e = town();
    lot(e, 'residential', 8, 4);
    lot(e, 'residential', 9, 2);
    const home = lot(e, 'residential', 10, 1);
    updateUtilities(e);
    updateGrid(e);
    // Unshaded well: 22 units. Three homes: 24 normally, 19 while rationed.
    expect(home.watered).toBe(false);
    expect(e.oasis.parched).toHaveLength(1);
    expect(e.execute({ type: 'setWaterRationing', enabled: true }).ok).toBe(true);
    expect(home.watered).toBe(false); // Commands alone do not settle storage or roll outages.
    e.runTicks(1);
    expect(home.watered).toBe(true);
    expect(e.stats().water.demand).toBe(19);
    expect(e.oasis.parched).toHaveLength(0);
    expect(e.stats().oasis?.waterPolicy).toMatchObject({ normalDemand: 24, rationedDemand: 19 });
    e.execute({ type: 'setWaterRationing', enabled: false });
    e.runTicks(4);
    expect(home.watered).toBe(false);
    expect(e.stats().water.demand).toBe(24);
  });

  it('uses reduced demand when spending reserves; toggling alone never fills a cistern', () => {
    const e = town();
    e.execute({ type: 'place', kind: 'cistern', x: 7, y: 5 });
    lot(e, 'residential', 8, 5);
    lot(e, 'residential', 9, 5);
    const bank = e.buildings.ofKind('cistern')[0]!;
    e.oasis.cisterns = [{ buildingId: bank.id, charge: 1 }];
    const restored = SimulationEngine.fromSnapshot(e.serialize());
    e.execute({ type: 'setWaterRationing', enabled: true });
    for (let i = 0; i < 10; i++) {
      e.execute({ type: 'setWaterRationing', enabled: false });
      e.execute({ type: 'setWaterRationing', enabled: true });
    }
    expect(e.oasis.cisterns[0]?.charge).toBe(1);
    updateUtilities(e);
    updateUtilities(restored);
    expect(e.oasis.cisterns[0]?.charge).toBeCloseTo(1 - (54 - 22) / 120);
    expect(restored.oasis.cisterns[0]?.charge).toBeCloseTo(1 - (72 - 22) / 120);
  });

  it('cannot water a disconnected lot and never rounds a small positive demand to zero', () => {
    const e = town();
    const home = lot(e, 'residential', 25, 1);
    e.execute({ type: 'setWaterRationing', enabled: true });
    e.runTicks(1);
    expect(home.watered).toBe(false);
    expect(waterDemand(home, true)).toBeGreaterThan(0);
  });

  it('charges only business taxes for the fraction of the month used, even after switching off', () => {
    const e = town();
    e.execute({ type: 'setWaterRationing', enabled: true });
    e.runTicks(TICKS_PER_MONTH / 2);
    e.execute({ type: 'setWaterRationing', enabled: false });
    lot(e, 'residential', 8);
    lot(e, 'commercial', 9);
    lot(e, 'industrial', 10);
    const factors = { crisisRevenue: 1, epidemicCommercial: 1 };
    const normal = SimulationEngine.fromSnapshot(e.serialize());
    delete normal.oasis.waterPolicy;
    const base = computeMonthlyReport(normal, factors);
    const restricted = computeMonthlyReport(e, factors);
    expect(e.stats().oasis?.waterPolicy.accruedPenalty).toBe(0.1);
    expect(restricted.revenue.residential).toBe(base.revenue.residential);
    expect(
      Math.abs(restricted.revenue.commercial - base.revenue.commercial * 0.9),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(restricted.revenue.industrial - base.revenue.industrial * 0.9),
    ).toBeLessThanOrEqual(1);
    expect(restricted.expenses).toEqual(base.expenses);
    e.runTicks(TICKS_PER_MONTH / 2);
    expect(e.oasis.waterPolicy?.rationedTicks).toBe(0);
    expect(e.oasis.waterPolicy?.rationing).toBe(false);
  });

  it('replays identically across a mid-month save and retains accrued cost after reload', () => {
    const e = town();
    lot(e, 'residential', 8);
    e.execute({ type: 'setWaterRationing', enabled: true });
    e.runTicks(51);
    e.execute({ type: 'setWaterRationing', enabled: false });
    const restored = load(e);
    expect(hashState(restored)).toBe(hashState(e));
    expect(restored.oasis.waterPolicy?.rationedTicks).toBe(51);
    e.runMonths(3);
    restored.runMonths(3);
    expect(hashState(restored)).toBe(hashState(e));
  });

  it('accepts legacy saves without the policy and rejects malformed policy state and commands', () => {
    const e = town();
    expect(load(e).oasis.waterPolicy).toBeUndefined();
    expect(e.execute({ type: 'setWaterRationing', enabled: 'yes' as unknown as boolean }).ok).toBe(
      false,
    );
    e.oasis.waterPolicy = { rationing: true, rationedTicks: 1 };
    expect(decodeSave(stringifySave(encodeSave(e.serialize(), meta, options)), options).ok).toBe(
      false,
    );
    e.oasis.waterPolicy = { rationing: true, rationedTicks: TICKS_PER_MONTH + 1 };
    expect(decodeSave(stringifySave(encodeSave(e.serialize(), meta, options)), options).ok).toBe(
      false,
    );
  });

  it('rejects the policy in classic cities without changing state', () => {
    const e = town('classic');
    const before = hashState(e);
    expect(e.execute({ type: 'setWaterRationing', enabled: true }).ok).toBe(false);
    expect(hashState(e)).toBe(before);
    expect(e.serialize().oasis).toBeUndefined();
  });
});
