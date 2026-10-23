import { Terrain } from '@city/shared';
import { hashTerrain, relaxSlopes, SimulationEngine } from '@city/simulation';
import { describe, expect, it } from 'vitest';

describe('terrain generation', () => {
  it('is deterministic for a given seed', () => {
    const a = SimulationEngine.create({ seed: 'terrain-1' });
    const b = SimulationEngine.create({ seed: 'terrain-1' });
    expect(hashTerrain(a)).toBe(hashTerrain(b));
  });

  it('differs between seeds', () => {
    const a = SimulationEngine.create({ seed: 'terrain-1' });
    const b = SimulationEngine.create({ seed: 'terrain-2' });
    expect(hashTerrain(a)).not.toBe(hashTerrain(b));
  });

  it('respects the slope constraint between adjacent vertices', () => {
    const { world } = SimulationEngine.create({ seed: 'slopes', terrain: { hills: 1 } });
    const vs = world.vertexSize;
    for (let vy = 0; vy < vs; vy++) {
      for (let vx = 0; vx < vs; vx++) {
        const h = world.heights[vy * vs + vx] as number;
        if (vx + 1 < vs)
          expect(Math.abs(h - (world.heights[vy * vs + vx + 1] as number))).toBeLessThanOrEqual(1);
        if (vy + 1 < vs)
          expect(Math.abs(h - (world.heights[(vy + 1) * vs + vx] as number))).toBeLessThanOrEqual(
            1,
          );
      }
    }
  });

  it('keeps water tiles flat at sea level and produces a sensible mix', () => {
    const { world } = SimulationEngine.create({ seed: 'mix', size: 128 });
    let water = 0;
    let flatLand = 0;
    for (let y = 0; y < world.size; y++) {
      for (let x = 0; x < world.size; x++) {
        const i = world.index(x, y);
        if (world.terrain[i] === Terrain.Water) {
          water++;
          expect(world.maxCorner(x, y)).toBe(0);
        } else if (world.isFlat(x, y)) {
          flatLand++;
        }
      }
    }
    const total = world.tileCount;
    expect(water / total).toBeGreaterThan(0.05);
    expect(water / total).toBeLessThan(0.4);
    expect(flatLand / total).toBeGreaterThan(0.35);
  });

  it('generates a flat map on request', () => {
    const { world } = SimulationEngine.create({ seed: 'flat', size: 32, terrain: { flat: true } });
    expect(world.heights.every((h) => h === 0)).toBe(true);
    expect(world.terrain.every((t) => t === Terrain.Grass)).toBe(true);
  });

  it('relaxSlopes only lowers vertices', () => {
    const heights = Uint8Array.from([5, 0, 0, 0, 9, 0, 0, 0, 0]);
    relaxSlopes(heights, 3);
    expect(Array.from(heights)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 0]);
  });
});
