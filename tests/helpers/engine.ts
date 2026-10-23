import { Terrain } from '@city/shared';
import { createEngine, relaxSlopes, type SimulationEngine } from '@city/simulation';

/** Flat grass map without trees, water or hills. */
export function flatEngine(size = 32, seed = 'test'): SimulationEngine {
  return createEngine({
    seed,
    size,
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
  });
}

/** Turns a rectangle of tiles into water (all corners at height 0). */
export function addWater(
  engine: SimulationEngine,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  const w = engine.world;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) w.terrain[w.index(x, y)] = Terrain.Water;
  }
  w.terrainVersion++;
}

/** Raises a hill with its peak at vertex (vx, vy), relaxing slopes around it. */
export function addHill(engine: SimulationEngine, vx: number, vy: number, height: number): void {
  const w = engine.world;
  const vs = w.vertexSize;
  for (let y = 0; y < vs; y++) {
    for (let x = 0; x < vs; x++) {
      const d = Math.abs(x - vx) + Math.abs(y - vy);
      w.heights[y * vs + x] = Math.max(w.heights[y * vs + x] as number, Math.max(0, height - d));
    }
  }
  relaxSlopes(w.heights, vs);
}

/** Adds a dummy residential building so unlock rules see `count` inhabitants. */
export function seedResidents(engine: SimulationEngine, count: number, x = 30, y = 30): void {
  engine.buildings.add({
    kind: 'residential',
    x,
    y,
    w: 1,
    h: 1,
    level: 1,
    capacity: count,
    occupancy: count,
    condition: 100,
    age: 0,
    abandoned: false,
    emptyMonths: 0,
    variant: 0,
    powered: true,
    watered: true,
    offline: 0,
    attractiveness: 1,
  });
}

export function slopeConstraintHolds(engine: SimulationEngine): boolean {
  const w = engine.world;
  const vs = w.vertexSize;
  const h = w.heights;
  for (let v = 0; v < h.length; v++) {
    const vx = v % vs;
    if (vx < vs - 1 && Math.abs((h[v] as number) - (h[v + 1] as number)) > 1) return false;
    if (v + vs < h.length && Math.abs((h[v] as number) - (h[v + vs] as number)) > 1) return false;
  }
  return true;
}
