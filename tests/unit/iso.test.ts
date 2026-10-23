import { SimulationEngine } from '@city/simulation';
import { describe, expect, it } from 'vitest';
import {
  pickTile,
  screenToGrid,
  tileCenter,
  vertexToScreen,
} from '../../packages/view-city/src/iso';

describe('isometric projection', () => {
  it('maps grid axes to screen diagonals', () => {
    expect(vertexToScreen(0, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(vertexToScreen(1, 0, 0)).toEqual({ x: 32, y: 16 });
    expect(vertexToScreen(0, 1, 0)).toEqual({ x: -32, y: 16 });
    expect(vertexToScreen(1, 1, 2)).toEqual({ x: 0, y: 16 });
  });

  it('inverts the projection on a given plane', () => {
    for (const [x, y, h] of [
      [3.25, 7.5, 0],
      [10, 2, 4],
      [0.5, 0.5, 1],
    ] as const) {
      const s = vertexToScreen(x, y, h);
      const g = screenToGrid(s.x, s.y, h);
      expect(g.x).toBeCloseTo(x, 9);
      expect(g.y).toBeCloseTo(y, 9);
    }
  });

  it('picks the tile under the centre of every tile, including on hills', () => {
    const { world } = SimulationEngine.create({
      seed: 'pick',
      size: 48,
      terrain: { hills: 1, water: 0.1 },
    });
    let checked = 0;
    for (let y = 0; y < world.size; y += 3) {
      for (let x = 0; x < world.size; x += 3) {
        const c = tileCenter(world, x, y);
        const picked = pickTile(world, c.x, c.y, 12);
        expect(picked).not.toBeNull();
        // On steep terrain a front tile may cover the back one; the result must still be in front or equal.
        expect((picked?.x ?? 0) + (picked?.y ?? 0)).toBeGreaterThanOrEqual(x + y);
        if (world.isFlat(x, y) && picked) {
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('picks exactly on flat terrain', () => {
    const { world } = SimulationEngine.create({ seed: 'flat', size: 32, terrain: { flat: true } });
    for (const [x, y] of [
      [0, 0],
      [5, 9],
      [31, 31],
      [17, 3],
    ] as const) {
      const c = tileCenter(world, x, y);
      expect(pickTile(world, c.x, c.y, 12)).toEqual({ x, y });
    }
    expect(pickTile(world, -5000, -5000, 12)).toBeNull();
  });
});
