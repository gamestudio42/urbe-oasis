import type { Area } from '@city/shared';

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function normalizeArea(area: Area): Rect {
  return {
    x0: Math.min(area.x0, area.x1),
    y0: Math.min(area.y0, area.y1),
    x1: Math.max(area.x0, area.x1),
    y1: Math.max(area.y0, area.y1),
  };
}

/** Tiles of a rectangle in row-major order, as `[x, y]` pairs (may be out of bounds). */
export function rectTiles(area: Area): Array<[number, number]> {
  const r = normalizeArea(area);
  const out: Array<[number, number]> = [];
  for (let y = r.y0; y <= r.y1; y++) {
    for (let x = r.x0; x <= r.x1; x++) out.push([x, y]);
  }
  return out;
}

/**
 * L-shaped path from the drag start `(x0, y0)` to the drag end `(x1, y1)`. The longer axis is
 * walked first, so a mostly horizontal drag produces a horizontal run followed by a vertical one.
 */
export function lPath(area: Area): Array<[number, number]> {
  const { x0, y0, x1, y1 } = area;
  const out: Array<[number, number]> = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = Math.sign(x1 - x0);
  const sy = Math.sign(y1 - y0);
  if (dx >= dy) {
    for (let k = 0; k <= dx; k++) out.push([x0 + k * sx, y0]);
    for (let k = 1; k <= dy; k++) out.push([x1, y0 + k * sy]);
  } else {
    for (let k = 0; k <= dy; k++) out.push([x0, y0 + k * sy]);
    for (let k = 1; k <= dx; k++) out.push([x0 + k * sx, y1]);
  }
  return out;
}

export function areaSize(area: Area): number {
  const r = normalizeArea(area);
  return (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
}
