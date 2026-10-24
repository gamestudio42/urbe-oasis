import { BALANCE, PLACEABLE_SPECS, ZONE_SPECS, isZoneKind, type PlaceableKind } from '@city/shared';
import type { SimulationEngine } from '../engine';
import type { World } from '../world/world';
import type { RoadNetwork } from './roads';
import { isOperatingHub } from './traffic';

/** Separable box blur with clamped edges (averages only in-bounds samples). */
export function boxBlur(src: Float32Array, size: number, radius: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < size; y++) {
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const lo = x < radius ? 0 : x - radius;
      const hi = x + radius >= size ? size - 1 : x + radius;
      const i = row + x;
      // Interior windows use fixed offsets, keeping the original left-to-right addition order.
      if (radius === 1 && x > 0 && x < size - 1) {
        tmp[i] = (0 + (src[i - 1] as number) + (src[i] as number) + (src[i + 1] as number)) / 3;
      } else if (radius === 2 && x > 1 && x < size - 2) {
        tmp[i] =
          (0 +
            (src[i - 2] as number) +
            (src[i - 1] as number) +
            (src[i] as number) +
            (src[i + 1] as number) +
            (src[i + 2] as number)) /
          5;
      } else {
        let sum = 0;
        for (let k = row + lo; k <= row + hi; k++) sum += src[k] as number;
        tmp[i] = sum / (hi - lo + 1);
      }
    }
  }
  // Vertical pass row by row; each pixel still sums its window from top to bottom.
  const sums = new Float64Array(size);
  for (let y = 0; y < size; y++) {
    const lo = y < radius ? 0 : y - radius;
    const hi = y + radius >= size ? size - 1 : y + radius;
    // Keep Float32 rounding between passes, and the same top-to-bottom additions. Each
    // interior pixel now writes its accumulator once instead of once per window row.
    if (radius === 1 && y > 0 && y < size - 1) {
      for (let i = y * size; i < (y + 1) * size; i++)
        out[i] =
          (0 + (tmp[i - size] as number) + (tmp[i] as number) + (tmp[i + size] as number)) / 3;
      continue;
    }
    if (radius === 2 && y > 1 && y < size - 2) {
      for (let i = y * size; i < (y + 1) * size; i++)
        out[i] =
          (0 +
            (tmp[i - 2 * size] as number) +
            (tmp[i - size] as number) +
            (tmp[i] as number) +
            (tmp[i + size] as number) +
            (tmp[i + 2 * size] as number)) /
          5;
      continue;
    }
    sums.fill(0);
    for (let k = lo; k <= hi; k++) {
      const row = k * size;
      for (let x = 0; x < size; x++) sums[x] = (sums[x] as number) + (tmp[row + x] as number);
    }
    const n = hi - lo + 1;
    const row = y * size;
    for (let x = 0; x < size; x++) out[row + x] = (sums[x] as number) / n;
  }
  return out;
}

function toByte(v: number): number {
  return v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v);
}

/** Tiles within Chebyshev `radius` of any park, with distance (255 = none). */
function parkDistance(engine: SimulationEngine, radius: number): Uint8Array {
  const w = engine.world;
  const dist = new Uint8Array(w.tileCount).fill(255);
  for (const b of engine.buildings.values()) {
    if (b.kind !== 'park') continue;
    for (let y = b.y - radius; y < b.y + b.h + radius; y++) {
      for (let x = b.x - radius; x < b.x + b.w + radius; x++) {
        if (!w.inBounds(x, y)) continue;
        const d = Math.max(
          Math.max(b.x - x, x - (b.x + b.w - 1), 0),
          Math.max(b.y - y, y - (b.y + b.h - 1), 0),
        );
        const i = w.index(x, y);
        if (d < (dist[i] as number)) dist[i] = d;
      }
    }
  }
  return dist;
}

/**
 * Land value from operating hubs: `spec.landValue` beside the footprint, fading linearly to 0
 * one tile past `spec.landValueRadius` (the marina's waterfront, the airport's noise).
 */
function hubLandValue(engine: SimulationEngine): Float32Array | null {
  const w = engine.world;
  let field: Float32Array | null = null;
  for (const b of engine.buildings.values()) {
    if (!isOperatingHub(b)) continue;
    const spec = PLACEABLE_SPECS[b.kind as PlaceableKind];
    const radius = spec.landValueRadius;
    if (spec.landValue === 0 || radius <= 0) continue;
    field ??= new Float32Array(w.tileCount);
    for (let y = b.y - radius; y < b.y + b.h + radius; y++) {
      for (let x = b.x - radius; x < b.x + b.w + radius; x++) {
        if (!w.inBounds(x, y)) continue;
        const d = Math.max(
          Math.max(b.x - x, x - (b.x + b.w - 1), 0),
          Math.max(b.y - y, y - (b.y + b.h - 1), 0),
        );
        const i = w.index(x, y);
        field[i] = (field[i] as number) + spec.landValue * (1 - d / (radius + 1));
      }
    }
  }
  return field;
}

const waterCache = new WeakMap<World, { version: number; cap: number; dist: Uint8Array }>();

/** `computeWaterDistance`, cached per world until its terrain changes. */
function waterDistance(w: World, cap: number): Uint8Array {
  const cached = waterCache.get(w);
  if (cached && cached.version === w.terrainVersion && cached.cap === cap) return cached.dist;
  const dist = computeWaterDistance(w, cap);
  waterCache.set(w, { version: w.terrainVersion, cap, dist });
  return dist;
}

/** Chebyshev distance to the nearest water tile, capped at `cap` (multi-source BFS). */
function computeWaterDistance(w: World, cap: number): Uint8Array {
  const size = w.size;
  const dist = new Uint8Array(w.tileCount).fill(255);
  const queue = new Int32Array(w.tileCount);
  let tail = 0;
  for (let i = 0; i < w.tileCount; i++) {
    if (w.isWater(i)) {
      dist[i] = 0;
      queue[tail++] = i;
    }
  }
  for (let head = 0; head < tail; head++) {
    const t = queue[head] as number;
    const d = dist[t] as number;
    if (d >= cap) continue;
    const tx = t % size;
    const ty = (t / size) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const n = ny * size + nx;
        if ((dist[n] as number) !== 255) continue;
        dist[n] = d + 1;
        queue[tail++] = n;
      }
    }
  }
  return dist;
}

/** Monthly: pollution, then land value (using last month's crime), then crime. */
export function updateInfluence(engine: SimulationEngine, roads: RoadNetwork): void {
  const w = engine.world;
  const size = w.size;
  const count = w.tileCount;
  const inf = w.influence;
  const { traffic, pollution, landValue, crime: crimeLayer, education, health, police } = inf;
  const terrain = w.terrain;
  const trees = w.trees;
  const fire = w.fire;
  const cfg = BALANCE.influence;
  const parks = parkDistance(engine, BALANCE.services.parkRadius);

  // Pollution sources.
  const pc = cfg.pollution;
  const sources = new Float32Array(count);
  for (const b of engine.buildings.values()) {
    const value = isZoneKind(b.kind)
      ? b.abandoned
        ? 0
        : ZONE_SPECS[b.kind].pollution * b.level
      : PLACEABLE_SPECS[b.kind].pollution;
    if (value <= 0) continue;
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let i = y * size + b.x; i < y * size + b.x + b.w; i++)
        sources[i] = (sources[i] as number) + value;
    }
  }
  for (let i = 0; i < count; i++) {
    sources[i] = (sources[i] as number) + pc.trafficFactor * (traffic[i] as number);
    if ((fire[i] as number) > 0) sources[i] = (sources[i] as number) + pc.fire;
  }
  const blurred = boxBlur(boxBlur(sources, size, 2), size, 2);
  for (let i = 0; i < count; i++) {
    let p = pc.gain * (blurred[i] as number) - pc.treeReduction * (trees[i] as number);
    if ((parks[i] as number) <= 3) p -= pc.parkReduction;
    pollution[i] = toByte(p);
  }

  // Land value.
  const lv = cfg.landValue;
  const parkValue = BALANCE.services.parkValue;
  const parkSpan = BALANCE.services.parkRadius + 1;
  const water = waterDistance(w, lv.waterRadius);
  const hubs = hubLandValue(engine);
  const centre = populationCentre(engine);
  const heights = w.heights;
  const vs = w.vertexSize;
  const accessRoad = roads.accessRoad;
  const raw = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    if ((terrain[i] as number) === 0) continue;
    const x = i % size;
    const y = (i / size) | 0;
    // Lowest corner of the tile (World.elevation without the temporary array).
    const v0 = y * vs + x;
    const ha = heights[v0] as number;
    const hb = heights[v0 + 1] as number;
    const hc = heights[v0 + vs + 1] as number;
    const hd = heights[v0 + vs] as number;
    const elevation = Math.min(ha, hb, hc, hd);
    let v = lv.base;
    if ((water[i] as number) <= lv.waterRadius) v += lv.waterBonus;
    v += lv.perElevation * elevation;
    v += lv.perTree * (trees[i] as number);
    const pd = parks[i] as number;
    if (pd !== 255) v += parkValue * (1 - pd / parkSpan);
    v += lv.education * (education[i] as number) + lv.health * (health[i] as number);
    v += lv.police * (police[i] as number);
    if ((accessRoad[i] as number) !== -1) v += lv.roadAccess;
    if (hubs) v += hubs[i] as number;
    if (centre)
      v += Math.max(0, lv.centerBonus - (Math.abs(x - centre.x) + Math.abs(y - centre.y)) / 2);
    v -=
      lv.pollution * (pollution[i] as number) +
      lv.crime * (crimeLayer[i] as number) +
      lv.traffic * (traffic[i] as number);
    raw[i] = v;
  }
  const lvBlur = boxBlur(raw, size, 1);
  for (let i = 0; i < count; i++)
    landValue[i] = (terrain[i] as number) === 0 ? 0 : toByte(lvBlur[i] as number);

  // Crime on developed tiles.
  const cr = cfg.crime;
  const crime = new Float32Array(count);
  for (const b of engine.buildings.values()) {
    if (b.kind === 'park') continue;
    const base = cr.base + cr.perLevel * b.level + (b.abandoned ? cr.abandoned : 0);
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let i = y * size + b.x; i < y * size + b.x + b.w; i++) {
        const v = base + (128 - (landValue[i] as number)) / 2 - cr.police * (police[i] as number);
        crime[i] = Math.max(0, v);
      }
    }
  }
  const crimeBlur = boxBlur(crime, size, 1);
  for (let i = 0; i < count; i++) crimeLayer[i] = toByte(crimeBlur[i] as number);
  w.influenceDirty = true;
}

/** Occupancy-weighted centroid of residential buildings, rounded to a tile. */
export function populationCentre(engine: SimulationEngine): { x: number; y: number } | null {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const b of engine.buildings.values()) {
    if (b.kind !== 'residential' || b.abandoned || b.occupancy <= 0) continue;
    sx += b.x * b.occupancy;
    sy += b.y * b.occupancy;
    n += b.occupancy;
  }
  return n === 0 ? null : { x: Math.round(sx / n), y: Math.round(sy / n) };
}
