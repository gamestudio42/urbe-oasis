export const TILE_W = 64;
export const TILE_H = 32;
export const HEIGHT_STEP = 8;

export interface Point {
  x: number;
  y: number;
}

/** Minimal read access needed for projection and picking. */
export interface HeightSource {
  readonly size: number;
  corners(x: number, y: number): [number, number, number, number];
}

export function vertexToScreen(vx: number, vy: number, height: number): Point {
  return {
    x: ((vx - vy) * TILE_W) / 2,
    y: ((vx + vy) * TILE_H) / 2 - height * HEIGHT_STEP,
  };
}

/** Inverse projection assuming the point lies on the plane at `height`. */
export function screenToGrid(sx: number, sy: number, height: number): Point {
  const a = sx / (TILE_W / 2);
  const b = (sy + height * HEIGHT_STEP) / (TILE_H / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Screen polygon of a tile: north, east, south, west corners. */
export function tileQuad(source: HeightSource, x: number, y: number): [Point, Point, Point, Point] {
  const [n, e, s, w] = source.corners(x, y);
  return [
    vertexToScreen(x, y, n),
    vertexToScreen(x + 1, y, e),
    vertexToScreen(x + 1, y + 1, s),
    vertexToScreen(x, y + 1, w),
  ];
}

/** Bilinear mapping from tile-local (u, v) in [0, 1]² to screen space, following slopes. */
export function tileLocalToScreen(quad: [Point, Point, Point, Point], u: number, v: number): Point {
  const [n, e, s, w] = quad;
  // u runs north->east (along +x), v runs north->west (along +y).
  const topX = n.x + (e.x - n.x) * u;
  const topY = n.y + (e.y - n.y) * u;
  const botX = w.x + (s.x - w.x) * u;
  const botY = w.y + (s.y - w.y) * u;
  return { x: topX + (botX - topX) * v, y: topY + (botY - topY) * v };
}

export function pointInPolygon(p: Point, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as Point;
    const b = poly[j] as Point;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

/**
 * Finds the front-most tile whose (possibly sloped) quad contains the screen point.
 * Tries the inverse projection at every candidate height.
 */
export function pickTile(
  source: HeightSource,
  sx: number,
  sy: number,
  maxHeight: number,
): Point | null {
  let best: Point | null = null;
  let bestDepth = -Infinity;
  const tested = new Set<number>();
  for (let h = 0; h <= maxHeight; h++) {
    const g = screenToGrid(sx, sy, h);
    const cx = Math.floor(g.x);
    const cy = Math.floor(g.y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= source.size || y >= source.size) continue;
        const key = y * source.size + x;
        if (tested.has(key)) continue;
        tested.add(key);
        if (!pointInPolygon({ x: sx, y: sy }, tileQuad(source, x, y))) continue;
        const depth = x + y;
        if (depth > bestDepth) {
          bestDepth = depth;
          best = { x, y };
        }
      }
    }
  }
  return best;
}

/** Screen-space centre of a tile (used by tests and camera focus). */
export function tileCenter(source: HeightSource, x: number, y: number): Point {
  return tileLocalToScreen(tileQuad(source, x, y), 0.5, 0.5);
}
