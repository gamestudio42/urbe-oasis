import { createEngine, hashState, SimulationEngine } from '@city/simulation';
import { updateUtilities } from '../../packages/simulation/src/systems/utilities';
import { describe, expect, it } from 'vitest';

function town(ruleset: 'classic' | 'oasis', size: number) {
  const e = createEngine({
    seed: 'utility-scratch',
    size,
    ruleset,
    funds: 100_000,
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
  });
  e.disastersEnabled = false;
  expect(e.execute({ type: 'place', kind: 'coalPlant', x: 4, y: 4 }).ok).toBe(true);
  expect(e.execute({ type: 'place', kind: 'well', x: 7, y: 4 }).ok).toBe(true);
  if (ruleset === 'oasis') {
    expect(e.execute({ type: 'place', kind: 'palm', x: 7, y: 5 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'cistern', x: 8, y: 4 }).ok).toBe(true);
  }
  return e;
}

function compareFresh(e: SimulationEngine) {
  const fresh = SimulationEngine.fromSnapshot(e.serialize());
  const before = hashState(e);
  // Reporting may reuse scratch memory but must not consume charge or alter service layers.
  expect(updateUtilities(e, false)).toEqual(updateUtilities(fresh, false));
  expect(hashState(e)).toBe(before);
  expect(updateUtilities(e)).toEqual(updateUtilities(fresh));
  expect(hashState(e)).toBe(hashState(fresh));
}

describe('utility scratch isolation', () => {
  it('keeps cold and reused solves identical across worlds, new ids, outages, demolition and empty networks', () => {
    const classic = town('classic', 32);
    const oasis = town('oasis', 48);
    for (const e of [oasis, classic, oasis, classic]) {
      compareFresh(e);
      for (let k = 0; k < 8; k++) {
        expect(e.execute({ type: 'place', kind: 'well', x: 9, y: 4 }).ok).toBe(true);
        compareFresh(e);
        expect(e.execute({ type: 'demolish', x0: 9, y0: 4, x1: 9, y1: 4 }).ok).toBe(true);
      }
      const plant = e.buildings.ofKind('coalPlant')[0]!;
      plant.offline = 8;
      compareFresh(e);
      expect(e.buildings.ofKind('well')[0]!.powered).toBe(false);
      plant.offline = 0;
      compareFresh(e);
      expect(e.buildings.ofKind('well')[0]!.powered).toBe(true);
    }
    for (const b of [...oasis.buildings.values()]) oasis.buildings.remove(b.id);
    compareFresh(oasis);
    expect(oasis.world.powered.some(Boolean)).toBe(false);
    expect(oasis.world.watered.some(Boolean)).toBe(false);
    expect(oasis.world.linked.some(Boolean)).toBe(false);
  });
});
