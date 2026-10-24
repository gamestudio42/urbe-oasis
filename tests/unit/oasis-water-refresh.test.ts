import { OASIS_WATER, type PlaceableKind } from '@city/shared';
import { createEngine, hashState, SimulationEngine } from '@city/simulation';
import { cascade, refreshGrid, updateGrid } from '../../packages/simulation/src/systems/oasis/grid';
import { cisternDelivery, updateUtilities } from '../../packages/simulation/src/systems/utilities';
import { describe, expect, it } from 'vitest';

function district(source: PlaceableKind, homes: number, bank = false) {
  const e = createEngine({
    seed: 'water-refresh',
    size: 32,
    ruleset: 'oasis',
    funds: 400_000,
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
  });
  e.disastersEnabled = false;
  expect(e.execute({ type: 'place', kind: 'coalPlant', x: 4, y: 4 }).ok).toBe(true);
  expect(e.execute({ type: 'place', kind: source, x: 7, y: 4 }).ok).toBe(true);
  if (bank) expect(e.execute({ type: 'place', kind: 'cistern', x: 7, y: 5 }).ok).toBe(true);
  for (let x = 8; x < 8 + homes; x++) {
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
  e.takeEvents();
  return e;
}

describe('Oasis water refresh', () => {
  it.each(['offline', 'power loss', 'demolition'] as const)(
    'clears a previous cistern delivery after %s without spending reserves',
    (transition) => {
      const e = district('well', 2, true);
      const bank = e.buildings.ofKind('cistern')[0]!;
      e.oasis.cisterns = [{ buildingId: bank.id, charge: 1 }];
      updateUtilities(e);
      const spent = 72 - Math.round(40 * OASIS_WATER.evaporation);
      expect(cisternDelivery(e)).toBe(spent);
      const remaining = e.oasis.cisterns[0]!.charge;
      expect(remaining).toBeCloseTo(1 - spent / OASIS_WATER.cisternOutput);
      const beforeRead = hashState(e);
      updateUtilities(e, false);
      expect(hashState(e)).toBe(beforeRead);
      expect(cisternDelivery(e)).toBe(spent);

      if (transition === 'offline') bank.offline = 8;
      else if (transition === 'power loss') e.buildings.ofKind('coalPlant')[0]!.offline = 8;
      else expect(e.execute({ type: 'demolish', x0: 7, y0: 5, x1: 7, y1: 5 }).ok).toBe(true);
      const reserves = e.oasis.cisterns.map((c) => ({ ...c }));
      const utilities = updateUtilities(e);
      expect(cisternDelivery(e)).toBe(0);
      expect(e.oasis.cisterns).toEqual(reserves);
      // With no source there is no supplied component to overload; lots are still unserved.
      expect(utilities.water.shortage).toBe(transition !== 'power loss');
      expect(utilities.water.served).toBeLessThan(1);
      expect(utilities.water.supply).toBe(transition === 'power loss' ? 0 : 22);

      if (transition !== 'demolition') {
        bank.offline = 0;
        e.buildings.ofKind('coalPlant')[0]!.offline = 0;
        updateUtilities(e);
        expect(cisternDelivery(e)).toBe(spent);
        expect(e.oasis.cisterns[0]!.charge).toBeLessThan(remaining);
      }
    },
  );

  it.each(['qanat', 'well'] as const)(
    'preserves RNG, events and live stress across a %s cascade',
    (source) => {
      const optimized = district(source, 10);
      const separate = SimulationEngine.fromSnapshot(optimized.serialize());
      separate.takeEvents();
      let cascaded = false;
      let unchanged = false;
      for (let attempt = 0; attempt < 400 && !cascaded; attempt++) {
        const actualUtilities = updateUtilities(optimized);
        const referenceUtilities = updateUtilities(separate);
        const expectedCascade = cascade(separate, referenceUtilities.water);
        const expected = updateGrid(separate);
        expected.cascaded = expectedCascade.cascaded;
        const actual = refreshGrid(optimized, actualUtilities.water);
        expect(actual).toEqual(expected);
        expect(hashState(optimized)).toBe(hashState(separate));
        const events = optimized.takeEvents();
        expect(events).toEqual(separate.takeEvents());
        if (actual.cascaded > 0) {
          cascaded = true;
          expect(
            events.some((e) => e.type === (source === 'qanat' ? 'canalCollapse' : 'waterStress')),
          ).toBe(true);
          if (source === 'qanat') {
            expect(optimized.buildings.ofKind('qanat')[0]!.offline).toBeGreaterThan(0);
            // The sole source just failed: retaining the pre-cascade components is incorrect.
            expect(actual.parched).toBe(0);
          }
        } else unchanged = true;
      }
      expect(unchanged).toBe(true);
      expect(cascaded).toBe(true);
    },
  );
});
