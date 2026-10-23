import { ZoneDensity, ZoneType } from '@city/shared';
import { boxBlur, flatCity } from '@city/simulation';
import { describe, expect, it } from 'vitest';

function townWithStation(funding: number) {
  const e = flatCity('services', 48);
  e.execute({ type: 'road', x0: 0, y0: 10, x1: 47, y1: 10 });
  e.execute({ type: 'place', kind: 'windTurbine', x: 1, y: 12 });
  e.execute({ type: 'place', kind: 'policeStation', x: 2, y: 11 });
  e.execute({ type: 'setFunding', department: 'police', value: funding });
  e.runMonths(1);
  return e;
}

describe('service coverage', () => {
  it('spreads along roads and fades with distance', () => {
    const e = townWithStation(100);
    const police = e.world.influence.police;
    const at = (x: number, y: number) => police[e.world.index(x, y)] as number;
    expect(at(3, 12)).toBe(255);
    expect(at(10, 10)).toBeGreaterThan(at(20, 10));
    expect(at(20, 10)).toBeGreaterThan(0);
    // Beyond the radius (22 road tiles) and away from roads there is no coverage.
    expect(at(40, 10)).toBe(0);
    expect(at(20, 30)).toBe(0);
  });

  it('scales with department funding', () => {
    const full = townWithStation(100);
    const half = townWithStation(50);
    const i = full.world.index(15, 10);
    expect(half.world.influence.police[i] as number).toBeLessThan(
      full.world.influence.police[i] as number,
    );
    expect(half.world.influence.police[i] as number).toBeGreaterThan(0);
  });
});

describe('influence maps', () => {
  it('box blur preserves the total away from the edges', () => {
    const size = 16;
    const src = new Float32Array(size * size);
    src[8 * size + 8] = 25;
    const out = boxBlur(src, size, 2);
    let total = 0;
    for (const v of out) total += v;
    expect(total).toBeCloseTo(25, 4);
    expect(out[8 * size + 8]).toBeCloseTo(1, 4);
    expect(out[8 * size + 11]).toBe(0);
  });

  it('industry pollutes its neighbourhood and lowers land value', () => {
    const e = flatCity('pollution', 48);
    e.execute({ type: 'road', x0: 0, y0: 20, x1: 47, y1: 20 });
    e.execute({ type: 'place', kind: 'coalPlant', x: 30, y: 21 });
    e.execute({
      type: 'zone',
      zone: ZoneType.Residential,
      density: ZoneDensity.Light,
      x0: 2,
      y0: 21,
      x1: 6,
      y1: 23,
    });
    e.runMonths(1);
    const inf = e.world.influence;
    const centre = e.world.index(31, 22);
    const near = e.world.index(31, 25);
    const far = e.world.index(4, 22);
    expect(inf.pollution[centre] as number).toBeGreaterThan(100);
    expect(inf.pollution[near] as number).toBeGreaterThan(40);
    expect(inf.pollution[far] as number).toBe(0);
    expect(inf.landValue[near] as number).toBeLessThan(inf.landValue[far] as number);
  });

  it('parks and trees raise land value', () => {
    const e = flatCity('parks', 48);
    e.execute({ type: 'road', x0: 0, y0: 20, x1: 47, y1: 20 });
    e.execute({ type: 'place', kind: 'park', x: 10, y: 22 });
    e.execute({ type: 'place', kind: 'park', x: 11, y: 22 });
    e.runMonths(1);
    const lv = e.world.influence.landValue;
    expect(lv[e.world.index(10, 23)] as number).toBeGreaterThan(
      lv[e.world.index(30, 23)] as number,
    );
  });
});
