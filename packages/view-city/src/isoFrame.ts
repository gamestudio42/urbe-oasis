import type { Graphics } from 'pixi.js';
import { shade } from '@theme/core';
import { TILE_H, TILE_W, type Point } from './iso';

/**
 * Shared isometric drawing frame for multi-tile buildings.
 *
 * Every hand-drawn building works in footprint units: `u` runs along +x from the north corner, `v`
 * along +y, both in tiles, and `z` is a height in pixels. Keeping one frame here means a new set
 * of sprites does not start by copying the same projection maths.
 */

/** Ground rectangle in footprint units: `[u0, v0, u1, v1]`. */
export type Rect = [number, number, number, number];

const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;

export function poly(g: Graphics, points: Point[], fill: number, alpha = 1): void {
  g.poly(points.flatMap((p) => [p.x, p.y])).fill({ color: fill, alpha });
}

export class Frame {
  constructor(readonly n: number) {}

  p(u: number, v: number, z = 0): Point {
    return { x: (u - v) * HALF_W, y: (u + v - 2 * this.n) * HALF_H - z };
  }

  quad(g: Graphics, u0: number, v0: number, u1: number, v1: number, fill: number, z = 0): void {
    poly(g, [this.p(u0, v0, z), this.p(u1, v0, z), this.p(u1, v1, z), this.p(u0, v1, z)], fill);
  }

  /** Line between two ground points, lifted by `z`. */
  line(g: Graphics, a: Point, b: Point, width: number, fill: number, z = 0, alpha = 1): void {
    g.moveTo(a.x, a.y - z)
      .lineTo(b.x, b.y - z)
      .stroke({ width, color: fill, alpha });
  }

  /** Box on the rectangle, drawing the two visible walls and the roof. */
  box(
    g: Graphics,
    r: Rect,
    z0: number,
    height: number,
    wall: number,
    roof: number,
    windows?: { color: number; rows: number } | number,
  ): Point[] {
    const [u0, v0, u1, v1] = r;
    const z1 = z0 + height;
    const p = (u: number, v: number, z: number) => this.p(u, v, z);
    poly(g, [p(u0, v1, z0), p(u1, v1, z0), p(u1, v1, z1), p(u0, v1, z1)], shade(wall, 0.74));
    poly(g, [p(u1, v1, z0), p(u1, v0, z0), p(u1, v0, z1), p(u1, v1, z1)], shade(wall, 0.94));
    const top = [p(u0, v0, z1), p(u1, v0, z1), p(u1, v1, z1), p(u0, v1, z1)];
    poly(g, top, roof);
    if (typeof windows === 'number') {
      this.windowRows(g, r, z0, height, { color: windows, rows: Math.max(1, Math.round(height / 10)) });
    } else if (windows) {
      this.windowRows(g, r, z0, height, windows);
    }
    return top;
  }

  private windowRows(
    g: Graphics,
    r: Rect,
    z0: number,
    height: number,
    windows: { color: number; rows: number },
  ): void {
    const [u0, v0, u1, v1] = r;
    const rowH = height / windows.rows;
    const colsFront = Math.max(2, Math.round((u1 - u0) * 5));
    const colsSide = Math.max(2, Math.round((v1 - v0) * 5));
    for (let row = 0; row < windows.rows; row++) {
      const za = z0 + row * rowH + rowH * 0.32;
      const zb = z0 + row * rowH + rowH * 0.74;
      for (let c = 0; c < colsFront; c++) {
        const ta = (c + 0.22) / colsFront;
        const tb = (c + 0.72) / colsFront;
        poly(
          g,
          [
            this.p(u0 + (u1 - u0) * ta, v1, za),
            this.p(u0 + (u1 - u0) * tb, v1, za),
            this.p(u0 + (u1 - u0) * tb, v1, zb),
            this.p(u0 + (u1 - u0) * ta, v1, zb),
          ],
          shade(windows.color, 0.86),
        );
      }
      for (let c = 0; c < colsSide; c++) {
        const ta = (c + 0.22) / colsSide;
        const tb = (c + 0.72) / colsSide;
        poly(
          g,
          [
            this.p(u1, v1 - (v1 - v0) * ta, za),
            this.p(u1, v1 - (v1 - v0) * tb, za),
            this.p(u1, v1 - (v1 - v0) * tb, zb),
            this.p(u1, v1 - (v1 - v0) * ta, zb),
          ],
          windows.color,
        );
      }
    }
  }

  /** Thin vertical post standing on (u, v), returning its tip. */
  post(g: Graphics, u: number, v: number, height: number, fill: number, width = 1.6, z0 = 0): Point {
    const base = this.p(u, v, z0);
    g.rect(base.x - width / 2, base.y - height, width, height).fill(fill);
    return { x: base.x, y: base.y - height };
  }

  /** Glowing strip along the screen line a→b: the signature detail of neon architecture. */
  trim(g: Graphics, a: Point, b: Point, width: number, fill: number, alpha = 0.9): void {
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width, color: fill, alpha });
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: width * 2.6, color: fill, alpha: alpha * 0.18 });
  }

  /** Lit strip between two ground points at height `z`. */
  trimAt(g: Graphics, a: Point, b: Point, z: number, width: number, fill: number, alpha = 0.9): void {
    this.trim(g, { x: a.x, y: a.y - z }, { x: b.x, y: b.y - z }, width, fill, alpha);
  }
}
