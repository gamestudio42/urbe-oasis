import { BALANCE, Terrain, type TerrainOptions } from '@city/shared';
import type { Rng } from '../rng/rng';
import type { World } from '../world/world';
import { FractalNoise } from './noise';

export const DEFAULT_TERRAIN: TerrainOptions = { water: 0.14, hills: 0.5, forest: 0.35, rivers: 1 };

export function generateTerrain(world: World, rng: Rng, options: TerrainOptions): void {
  if (options.flat) {
    world.heights.fill(0);
    world.terrain.fill(Terrain.Grass);
    world.trees.fill(0);
    world.markAllDirty();
    return;
  }

  const size = world.size;
  const vs = world.vertexSize;
  const heightNoise = new FractalNoise(rng, 3, 4);
  const moistureNoise = new FractalNoise(rng, 4, 3);
  const forestNoise = new FractalNoise(rng, 6, 3);

  // 1. Raw height per vertex.
  const raw = new Float64Array(vs * vs);
  for (let vy = 0; vy < vs; vy++) {
    for (let vx = 0; vx < vs; vx++) {
      raw[vy * vs + vx] = heightNoise.sample(vx / size, vy / size);
    }
  }

  // 2. Water tiles: lowest fraction of tile centres, plus rivers.
  const centre = new Float64Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = y * vs + x;
      centre[y * size + x] =
        ((raw[v] as number) +
          (raw[v + 1] as number) +
          (raw[v + vs] as number) +
          (raw[v + vs + 1] as number)) /
        4;
    }
  }
  const sorted = Float64Array.from(centre).sort();
  const waterFraction = Math.max(0, Math.min(0.5, options.water));
  const seaLevel =
    waterFraction <= 0 ? -1 : (sorted[Math.floor(waterFraction * (sorted.length - 1))] as number);
  const maxRaw = sorted[sorted.length - 1] as number;

  const water = new Uint8Array(size * size);
  for (let i = 0; i < water.length; i++) water[i] = (centre[i] as number) < seaLevel ? 1 : 0;
  for (let r = 0; r < options.rivers; r++) carveRiver(water, size, rng);

  // 3. Quantized vertex heights; vertices touching water sit at sea level. Land heights blend the
  // rank of the raw value (even spread of levels) with its linear value (broad lowlands).
  const maxHeight = Math.round(BALANCE.map.maxHeight * Math.max(0, Math.min(1, options.hills)));
  const heights = world.heights;
  const landRaw = Float64Array.from(raw.filter((r) => r >= seaLevel)).sort();
  const span = Math.max(1e-9, maxRaw - Math.max(seaLevel, 0));
  for (let vy = 0; vy < vs; vy++) {
    for (let vx = 0; vx < vs; vx++) {
      const v = vy * vs + vx;
      if (touchesWater(water, size, vx, vy)) {
        heights[v] = 0;
        continue;
      }
      const value = raw[v] as number;
      const rank = landRaw.length > 0 ? lowerBound(landRaw, value) / landRaw.length : 0;
      const linear = Math.max(0, Math.min(1, (value - Math.max(seaLevel, 0)) / span));
      const t = 0.65 * rank * rank + 0.35 * linear;
      heights[v] = Math.min(maxHeight, Math.floor(t * (maxHeight + 1)));
    }
  }
  relaxSlopes(heights, vs);

  // 4. Terrain type and vegetation per tile. The forest threshold is a percentile of the noise.
  const forestValues = new Float64Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++)
      forestValues[y * size + x] = forestNoise.sample((x + 0.5) / size, (y + 0.5) / size);
  }
  const forestSorted = Float64Array.from(forestValues).sort();
  const forestFraction = Math.max(0, Math.min(1, options.forest));
  const forestThreshold =
    forestFraction <= 0
      ? 2
      : (forestSorted[Math.floor((1 - forestFraction) * (forestSorted.length - 1))] as number);
  const forestMax = forestSorted[forestSorted.length - 1] as number;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      world.trees[i] = 0;
      if (water[i] === 1) {
        world.terrain[i] = Terrain.Water;
        continue;
      }
      const elevation = world.minCorner(x, y);
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      if (elevation === 0 && nearWater(water, size, x, y)) {
        world.terrain[i] = Terrain.Sand;
        continue;
      }
      if (maxHeight >= 4 && world.maxCorner(x, y) >= maxHeight - 1) {
        world.terrain[i] = Terrain.Rock;
        continue;
      }
      world.terrain[i] = moistureNoise.sample(u, v) < 0.33 ? Terrain.Dirt : Terrain.Grass;
      const f = forestValues[i] as number;
      if (f > forestThreshold) {
        const t = (f - forestThreshold) / Math.max(1e-9, forestMax - forestThreshold);
        world.trees[i] = Math.min(3, 1 + Math.floor(t * 4));
      }
    }
  }

  world.markAllDirty();
}

/** Number of sorted values strictly lower than `value` (binary search). */
function lowerBound(sorted: Float64Array, value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sorted[mid] as number) < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function touchesWater(water: Uint8Array, size: number, vx: number, vy: number): boolean {
  for (let dy = -1; dy <= 0; dy++) {
    for (let dx = -1; dx <= 0; dx++) {
      const x = vx + dx;
      const y = vy + dy;
      if (x >= 0 && y >= 0 && x < size && y < size && water[y * size + x] === 1) return true;
    }
  }
  return false;
}

function nearWater(water: Uint8Array, size: number, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < size && ny < size && water[ny * size + nx] === 1) return true;
    }
  }
  return false;
}

/** Random walk from one edge to the opposite one, two tiles wide. */
function carveRiver(water: Uint8Array, size: number, rng: Rng): void {
  const horizontal = rng.chance(0.5);
  let lateral = rng.range(Math.floor(size * 0.2), Math.floor(size * 0.8));
  let drift = 0;
  for (let along = 0; along < size; along++) {
    if (rng.chance(0.35)) drift = Math.max(-1, Math.min(1, drift + (rng.chance(0.5) ? 1 : -1)));
    lateral = Math.max(2, Math.min(size - 3, lateral + drift));
    for (let w = 0; w < 2; w++) {
      const x = horizontal ? along : lateral + w;
      const y = horizontal ? lateral + w : along;
      water[y * size + x] = 1;
    }
  }
}

/** Lowers vertices until every pair of orthogonal neighbours differs by at most one level. */
export function relaxSlopes(heights: Uint8Array, vs: number): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      const start = pass === 0 ? 0 : heights.length - 1;
      const step = pass === 0 ? 1 : -1;
      for (let v = start; v >= 0 && v < heights.length; v += step) {
        const vx = v % vs;
        const vy = (v / vs) | 0;
        let limit = 255;
        if (vx > 0) limit = Math.min(limit, heights[v - 1] as number);
        if (vx < vs - 1) limit = Math.min(limit, heights[v + 1] as number);
        if (vy > 0) limit = Math.min(limit, heights[v - vs] as number);
        if (vy < vs - 1) limit = Math.min(limit, heights[v + vs] as number);
        if ((heights[v] as number) > limit + 1) {
          heights[v] = limit + 1;
          changed = true;
        }
      }
    }
  }
}
