import { Infra, Terrain } from '@city/shared';
import { World } from '@city/simulation';
import { describe, expect, it } from 'vitest';

describe('World', () => {
  it('indexes tiles and vertices consistently', () => {
    const w = new World(8);
    expect(w.index(3, 2)).toBe(19);
    expect(w.xOf(19)).toBe(3);
    expect(w.yOf(19)).toBe(2);
    expect(w.vertex(8, 8)).toBe(80);
  });

  it('derives flatness and elevation from corner heights', () => {
    const w = new World(4);
    w.heights[w.vertex(1, 1)] = 1;
    expect(w.isFlat(0, 0)).toBe(false);
    expect(w.isGentle(0, 0)).toBe(true);
    expect(w.elevation(0, 0)).toBe(0);
    expect(w.corners(1, 1)).toEqual([1, 0, 0, 0]);
    expect(w.isFlat(2, 2)).toBe(true);
  });

  it('tracks dirty tiles once', () => {
    const w = new World(4);
    w.setInfra(5, Infra.Road, true);
    w.setInfra(5, Infra.PowerLine, true);
    w.setLayer('terrain', 6, Terrain.Grass);
    w.setLayer('terrain', 6, Terrain.Grass);
    expect(w.takeDirty()).toEqual([5, 6]);
    expect(w.takeDirty()).toEqual([]);
    expect(w.hasInfra(5, Infra.Road)).toBe(true);
    expect(w.getTile(1, 1).powerLine).toBe(true);
  });
});
