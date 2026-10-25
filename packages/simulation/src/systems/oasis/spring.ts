import { OASIS_SHADE, type BuildingRecord } from '@city/shared';
import type { SimulationEngine } from '../../engine';
import { Rng } from '../../rng/rng';
import { monthIndex } from '../../time';

/**
 * The wandering spring (oasis ruleset).
 *
 * A spring house gives its full shade only while it stands inside `springRadius` of the spring
 * and has water. The spring starts at the map centre and steps every `springMoveMonths`.
 *
 * The roll uses its own generator, derived from the city seed and the month. It does not draw
 * from `engine.rng`, so caravans and sandstorms keep the stream they already had.
 */

/** Places the spring at the centre the first time an oasis city is created or loaded. */
export function ensureSpring(engine: SimulationEngine): void {
  const state = engine.oasis;
  if (state.springX >= 0 && state.springY >= 0) return;
  const size = engine.world.size;
  const found = findOpen(engine, Math.floor(size / 2), Math.floor(size / 2));
  state.springX = found.x;
  state.springY = found.y;
}

/** Monthly: record the first month, then step the spring on its own cadence. */
export function updateSpring(engine: SimulationEngine): void {
  ensureSpring(engine);
  const month = monthIndex(engine.tick);
  const state = engine.oasis;
  if (state.lastSpringMonth < 0) {
    state.lastSpringMonth = month;
    return;
  }
  if (month - state.lastSpringMonth < OASIS_SHADE.springMoveMonths) return;
  state.lastSpringMonth = month;
  relocate(engine, OASIS_SHADE.springStep, Rng.fromSeed(`${engine.seed}:spring:${month}`));
}

/** A sandstorm that lands pushes the spring a short step. */
export function nudgeSpring(engine: SimulationEngine, step: number): void {
  ensureSpring(engine);
  relocate(engine, step, Rng.fromSeed(`${engine.seed}:nudge:${engine.tick}`));
}

/** Chebyshev distance from a building's origin to the spring, within `springRadius`. */
export function springNear(engine: SimulationEngine, b: BuildingRecord): boolean {
  ensureSpring(engine);
  const dx = Math.abs(b.x - engine.oasis.springX);
  const dy = Math.abs(b.y - engine.oasis.springY);
  return Math.max(dx, dy) <= OASIS_SHADE.springRadius;
}

function relocate(engine: SimulationEngine, step: number, roll: Rng): void {
  const state = engine.oasis;
  const dir = roll.int(4);
  let dx = dir === 0 ? step : dir === 1 ? -step : 0;
  let dy = dir === 2 ? step : dir === 3 ? -step : 0;
  const size = engine.world.size - 1;
  // The spring wanders around the centre it was born at, never away from it for good. A step
  // that would leave the range turns back; one from a far older save may only come closer.
  const centre = Math.floor(engine.world.size / 2);
  const from = Math.max(Math.abs(state.springX - centre), Math.abs(state.springY - centre));
  const to = Math.max(Math.abs(state.springX + dx - centre), Math.abs(state.springY + dy - centre));
  if (to > OASIS_SHADE.springRange && to > from) {
    dx = -dx;
    dy = -dy;
  }
  let x = clamp(state.springX + dx, 0, size);
  let y = clamp(state.springY + dy, 0, size);
  if (blocked(engine, x, y)) {
    const sx = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const sy = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    x = clamp(state.springX + sx, 0, size);
    y = clamp(state.springY + sy, 0, size);
  }
  if (blocked(engine, x, y) || (x === state.springX && y === state.springY)) return;
  state.springX = x;
  state.springY = y;
  engine.networksDirty = true;
  engine.emit({ type: 'springMoved', x, y });
}

function blocked(engine: SimulationEngine, x: number, y: number): boolean {
  const w = engine.world;
  if (!w.inBounds(x, y)) return true;
  const i = w.index(x, y);
  if (w.isWater(i)) return true;
  return (w.buildingId[i] as number) !== 0;
}

/** First open tile on a Chebyshev ring around the preferred point, or the point itself. */
function findOpen(engine: SimulationEngine, x: number, y: number): { x: number; y: number } {
  const size = engine.world.size;
  for (let r = 0; r < size; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = x + dx;
        const ty = y + dy;
        if (!blocked(engine, tx, ty)) return { x: tx, y: ty };
      }
    }
  }
  return { x, y };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
