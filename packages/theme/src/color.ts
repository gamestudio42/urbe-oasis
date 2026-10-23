/** Colour arithmetic shared by every theme. Pure integer maths on `0xRRGGBB`. */

/** Multiplies every channel by `factor`, clamped to 0..255. */
export function shade(color: number, factor: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((color >> 16) & 0xff) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((color >> 8) & 0xff) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((color & 0xff) * factor)));
  return (r << 16) | (g << 8) | b;
}

/** Linear blend: `t = 0` returns `a`, `t = 1` returns `b`. */
export function mix(a: number, b: number, t: number): number {
  const r = ((a >> 16) & 0xff) * (1 - t) + ((b >> 16) & 0xff) * t;
  const g = ((a >> 8) & 0xff) * (1 - t) + ((b >> 8) & 0xff) * t;
  const bl = (a & 0xff) * (1 - t) + (b & 0xff) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

/** Small deterministic per-tile hash for visual variation. */
export function tileHash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** `#rrggbb` for CSS and canvas consumers. */
export function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
