import { Infra } from '@city/shared';
import type { World } from '@city/simulation';
import { HEIGHT_STEP } from './iso';

/** Cosmetic lift of a bridge deck above the water, in pixels. */
export const BRIDGE_DECK = HEIGHT_STEP;
/** Half-width inset of the wooden span (tile UV). */
export const BRIDGE_INSET = 0.28;
/** Half-width inset of a land road (tile UV). */
export const ROAD_INSET = 0.22;

export function isLandRoad(world: World, x: number, y: number): boolean {
  if (!world.inBounds(x, y)) return false;
  const i = world.index(x, y);
  return world.hasInfra(i, Infra.Road) && !world.isWater(i);
}

export function isBridgeTile(world: World, x: number, y: number): boolean {
  if (!world.inBounds(x, y)) return false;
  const i = world.index(x, y);
  return world.hasInfra(i, Infra.Road) && world.isWater(i);
}

/**
 * Screen-pixel lift of the driving surface at tile-local `(u, v)`. Land stays at 0; a span is
 * raised except on the short ramps that meet a land road.
 */
export function roadSurfaceLift(world: World, x: number, y: number, u: number, v: number): number {
  if (!isBridgeTile(world, x, y)) return 0;
  const inset = BRIDGE_INSET;
  let h = BRIDGE_DECK;
  if (isLandRoad(world, x, y - 1) && v < inset) h = Math.min(h, (BRIDGE_DECK * v) / inset);
  if (isLandRoad(world, x, y + 1) && v > 1 - inset)
    h = Math.min(h, (BRIDGE_DECK * (1 - v)) / inset);
  if (isLandRoad(world, x - 1, y) && u < inset) h = Math.min(h, (BRIDGE_DECK * u) / inset);
  if (isLandRoad(world, x + 1, y) && u > 1 - inset)
    h = Math.min(h, (BRIDGE_DECK * (1 - u)) / inset);
  return h;
}
