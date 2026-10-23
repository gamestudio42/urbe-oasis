import { color, type Theme } from '@theme/core';
import { TILE_H, TILE_W, type Point } from './iso';

const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;

/** Footprint diamond of n×n tiles whose front (south) vertex is at the origin. */
export function footprint(n: number, inset: number): { b: Point; r: Point; t: Point; l: Point } {
  const s = n - inset * 2;
  const oy = -inset * TILE_H;
  return {
    b: { x: 0, y: oy },
    r: { x: s * HALF_W, y: oy - s * HALF_H },
    t: { x: 0, y: oy - s * TILE_H },
    l: { x: -s * HALF_W, y: oy - s * HALF_H },
  };
}

export function up(p: Point, h: number): Point {
  return { x: p.x, y: p.y - h };
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Top face (back, right, front, left corners) of a box drawn on `footprint(n, inset)`. */
export function topFace(n: number, inset: number, height: number): Point[] {
  const { b, r, t, l } = footprint(n, inset);
  return [up(t, height), up(r, height), up(b, height), up(l, height)];
}

export const INDUSTRIAL_HEIGHTS = [0, 12, 18, 22, 28, 34, 44, 56] as const;
export const INDUSTRIAL_INSET = 0.12;
export const COAL_PLANT_BOX = { inset: 0.08, height: 26 } as const;
export const GAS_PLANT_BOX = { inset: 0.1, height: 20 } as const;

export interface Chimney {
  /** Base on the roof, relative to the building's front vertex. */
  base: Point;
  height: number;
  color: number;
  /** Smoke output: 0 none, 1 heavy. */
  smoke: number;
}

/** Chimneys of a building sprite; shared by the sprite drawing and the smoke emitters. */
export function chimneys(kind: string, level: number, size: number, theme: Theme): Chimney[] {
  switch (kind) {
    case 'industrial': {
      if (level < 3) return [];
      const top = topFace(1, INDUSTRIAL_INSET, INDUSTRIAL_HEIGHTS[level] ?? 12);
      const list: Chimney[] = [
        {
          base: lerp(top[0] as Point, top[2] as Point, 0.4),
          height: 14 + level * 4,
          color: color(theme, 'chimney.industrial'),
          smoke: 0.7,
        },
      ];
      if (level >= 5) {
        list.push({
          base: lerp(top[0] as Point, top[2] as Point, 0.75),
          height: 26,
          color: color(theme, 'chimney.industrialAlt'),
          smoke: 0.5,
        });
      }
      return list;
    }
    case 'coalPlant': {
      // Side by side across the roof, so neither stack hides the other.
      const top = topFace(size, COAL_PLANT_BOX.inset, COAL_PLANT_BOX.height);
      const centre = lerp(top[0] as Point, top[2] as Point, 0.45);
      return [top[3] as Point, top[1] as Point].map((corner) => ({
        base: lerp(centre, corner, 0.4),
        height: 50,
        color: color(theme, 'chimney.coal'),
        smoke: 1,
      }));
    }
    case 'gasPlant': {
      const top = topFace(size, GAS_PLANT_BOX.inset, GAS_PLANT_BOX.height);
      return [
        {
          base: lerp(top[0] as Point, top[2] as Point, 0.7),
          height: 30,
          color: color(theme, 'chimney.gas'),
          smoke: 0.35,
        },
      ];
    }
    default:
      return [];
  }
}
