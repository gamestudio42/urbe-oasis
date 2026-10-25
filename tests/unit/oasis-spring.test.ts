import { OASIS_SHADE, OASIS_WATER } from '@city/shared';
import { createEngine, shadeSupply } from '@city/simulation';
import { describe, expect, it } from 'vitest';

describe('oasis spring and evaporation', () => {
  it('starts the spring at the centre of a flat map', () => {
    const e = createEngine({
      seed: 'spring-centre',
      size: 24,
      ruleset: 'oasis',
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
      funds: 50_000,
    });
    expect(e.oasis.springX).toBe(12);
    expect(e.oasis.springY).toBe(12);
    expect(e.stats().oasis?.spring).toEqual({ x: 12, y: 12 });
  });

  it('gives a watered spring house its full supply while the spring is near', () => {
    const e = createEngine({
      seed: 'spring-near',
      size: 24,
      ruleset: 'oasis',
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
      funds: 50_000,
    });
    e.disastersEnabled = false;
    expect(e.execute({ type: 'place', kind: 'coalPlant', x: 4, y: 4 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'springHouse', x: 8, y: 4 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'well', x: 7, y: 4 }).ok).toBe(true);
    e.refreshUtilities();
    const house = e.buildings.ofKind('springHouse')[0];
    expect(house?.powered).toBe(true);
    expect(house?.watered).toBe(true);
    expect(e.stats().oasis?.data.supply).toBe(OASIS_SHADE.springSupply);
  });

  it('drops a far, dry spring house to nothing', () => {
    const e = createEngine({
      seed: 'spring-far',
      size: 64,
      ruleset: 'oasis',
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
      funds: 50_000,
    });
    const house = e.buildings.add({
      kind: 'springHouse',
      x: 1,
      y: 1,
      w: 2,
      h: 2,
      level: 1,
      capacity: 0,
      occupancy: 0,
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
    expect(shadeSupply(house, false)).toBe(0);
    expect(shadeSupply(house, true)).toBe(OASIS_SHADE.springSupplyDry);
  });

  it('evaporates an unshaded well and keeps a shaded one', () => {
    const dry = createEngine({
      seed: 'evap',
      size: 16,
      ruleset: 'oasis',
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
      funds: 50_000,
    });
    dry.disastersEnabled = false;
    expect(dry.execute({ type: 'place', kind: 'coalPlant', x: 2, y: 2 }).ok).toBe(true);
    expect(dry.execute({ type: 'place', kind: 'well', x: 5, y: 2 }).ok).toBe(true);
    dry.refreshUtilities();
    expect(dry.stats().water.supply).toBe(Math.round(40 * OASIS_WATER.evaporation));

    expect(dry.execute({ type: 'place', kind: 'palm', x: 6, y: 2 }).ok).toBe(true);
    dry.refreshUtilities();
    dry.refreshUtilities();
    expect(dry.buildings.ofKind('well')[0]?.linked).toBe(true);
    expect(dry.stats().water.supply).toBe(40);
  });
});
