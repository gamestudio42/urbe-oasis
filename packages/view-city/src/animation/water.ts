import { Infra, Terrain } from '@city/shared';
import type { World } from '@city/simulation';
import { tileHash } from '../palette';

export interface SparkleSpot {
  x: number;
  y: number;
  /** Tile-local position of the glint. */
  u: number;
  v: number;
  /** Phase in seconds and period, so neighbours do not blink together. */
  phase: number;
  period: number;
}

/** Share of water tiles with a glint. */
const SPARKLE_SHARE = 0.33;

/** Water tiles of the area that carry a glint, chosen by a stable hash of the position. */
export function sparkleSpots(
  world: World,
  area: { x0: number; y0: number; x1: number; y1: number },
): SparkleSpot[] {
  const spots: SparkleSpot[] = [];
  for (let y = area.y0; y < area.y1; y++) {
    for (let x = area.x0; x < area.x1; x++) {
      const i = world.index(x, y);
      if (world.terrain[i] !== Terrain.Water || world.hasInfra(i, Infra.Road)) continue;
      if (tileHash(x + 17, y + 31) >= SPARKLE_SHARE) continue;
      spots.push({
        x,
        y,
        u: 0.25 + tileHash(x + 3, y) * 0.5,
        v: 0.25 + tileHash(x, y + 5) * 0.5,
        phase: tileHash(x + 11, y + 7) * 4,
        period: 2.5 + tileHash(x + 5, y + 13) * 2,
      });
    }
  }
  return spots;
}

/** Opacity of a glint at `time` seconds: a short flash once per period. */
export function sparkleAlpha(spot: SparkleSpot, time: number): number {
  const k = ((time + spot.phase) % spot.period) / spot.period;
  return k < 0.18 ? Math.sin((k / 0.18) * Math.PI) * 0.85 : 0;
}
