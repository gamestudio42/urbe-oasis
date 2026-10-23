import type { Graphics } from 'pixi.js';
import { color, shade, type LotPalette, type Theme } from '@theme/core';
import { INDUSTRIAL_HEIGHTS, INDUSTRIAL_INSET, chimneys, lerp, up } from './chimneys';
import { TILE_H, TILE_W, type Point } from './iso';

/** Zone lots: `variant` 0..3 from `tileVariant` picks a palette and a silhouette. */

const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;

interface BoxColors {
  wall: number;
  roof: number;
  window?: number;
}

export type Palette = LotPalette;

function poly(g: Graphics, points: Point[], fill: number, alpha = 1): void {
  g.poly(points.flatMap((p) => [p.x, p.y])).fill({ color: fill, alpha });
}

/** Tile UV: `u` along +x, `v` along +y; the front (south) vertex is the origin. */
function atUV(u: number, v: number): Point {
  return { x: (u - v) * HALF_W, y: (u + v - 2) * HALF_H };
}

function uvCorners(
  u0: number,
  v0: number,
  u1: number,
  v1: number,
): {
  t: Point;
  r: Point;
  b: Point;
  l: Point;
} {
  return {
    t: atUV(u0, v0),
    r: atUV(u1, v0),
    b: atUV(u1, v1),
    l: atUV(u0, v1),
  };
}

function windows(
  g: Graphics,
  from: Point,
  to: Point,
  z0: number,
  height: number,
  floors: number,
  fill: number,
): void {
  const columns = Math.max(2, Math.round(Math.hypot(to.x - from.x, to.y - from.y) / 9));
  const floorH = height / floors;
  for (let f = 0; f < floors; f++) {
    const za = z0 + f * floorH + floorH * 0.3;
    const zb = z0 + f * floorH + floorH * 0.75;
    for (let c = 0; c < columns; c++) {
      const a = lerp(from, to, (c + 0.25) / columns);
      const e = lerp(from, to, (c + 0.7) / columns);
      poly(g, [up(a, za), up(e, za), up(e, zb), up(a, zb)], fill);
    }
  }
}

/** Box on a tile UV rectangle. `z0` lifts it off the ground (rooftop volumes). */
function boxUV(
  g: Graphics,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  height: number,
  colors: BoxColors,
  floors = 0,
  z0 = 0,
): Point[] {
  const { t, r, b, l } = uvCorners(u0, v0, u1, v1);
  poly(g, [up(l, z0), up(b, z0), up(b, z0 + height), up(l, z0 + height)], shade(colors.wall, 0.78));
  poly(g, [up(b, z0), up(r, z0), up(r, z0 + height), up(b, z0 + height)], shade(colors.wall, 0.95));
  const top = [up(t, z0 + height), up(r, z0 + height), up(b, z0 + height), up(l, z0 + height)];
  poly(g, top, colors.roof);
  if (floors > 0 && colors.window !== undefined) {
    windows(g, l, b, z0, height, floors, shade(colors.window, 0.85));
    windows(g, b, r, z0, height, floors, colors.window);
  }
  g.poly([...top, top[0] as Point].flatMap((p) => [p.x, p.y])).stroke({
    width: 1,
    color: shade(colors.roof, 0.7),
    alpha: 0.6,
  });
  return top;
}

function onTop(top: Point[], u: number, v: number): Point {
  const [t, , b, l] = top as [Point, Point, Point, Point];
  return {
    x: l.x + u * (t.x - l.x) + v * (b.x - l.x),
    y: l.y + u * (t.y - l.y) + v * (b.y - l.y),
  };
}

/** Gable with the ridge running left–right. */
function pitchedRoof(g: Graphics, top: Point[], rise: number, fill: number): void {
  const [t, r, b, l] = top as [Point, Point, Point, Point];
  const ridgeA = up(lerp(t, l, 0.5), rise);
  const ridgeB = up(lerp(r, b, 0.5), rise);
  poly(g, [l, b, ridgeB, ridgeA], shade(fill, 0.85));
  poly(g, [t, r, ridgeB, ridgeA], shade(fill, 1.1));
}

/** Gable with the ridge running front–back. */
function pitchedRoofSide(g: Graphics, top: Point[], rise: number, fill: number): void {
  const [t, r, b, l] = top as [Point, Point, Point, Point];
  const ridgeA = up(lerp(t, r, 0.5), rise);
  const ridgeB = up(lerp(l, b, 0.5), rise);
  poly(g, [t, l, ridgeB, ridgeA], shade(fill, 0.85));
  poly(g, [r, b, ridgeB, ridgeA], shade(fill, 1.1));
}

function hipRoof(g: Graphics, top: Point[], rise: number, fill: number): void {
  const [t, r, b, l] = top as [Point, Point, Point, Point];
  const peak = up(lerp(lerp(t, r, 0.5), lerp(l, b, 0.5), 0.5), rise);
  poly(g, [t, r, peak], shade(fill, 1.12));
  poly(g, [r, b, peak], shade(fill, 0.95));
  poly(g, [b, l, peak], shade(fill, 0.72));
  poly(g, [l, t, peak], shade(fill, 0.88));
}

function chimney(g: Graphics, base: Point, height: number, fill: number, flue: number): void {
  poly(
    g,
    [
      { x: base.x - 4, y: base.y },
      { x: base.x, y: base.y + 2 },
      { x: base.x, y: base.y + 2 - height },
      { x: base.x - 4, y: base.y - height },
    ],
    shade(fill, 0.8),
  );
  poly(
    g,
    [
      { x: base.x, y: base.y + 2 },
      { x: base.x + 4, y: base.y },
      { x: base.x + 4, y: base.y - height },
      { x: base.x, y: base.y + 2 - height },
    ],
    fill,
  );
  g.ellipse(base.x, base.y - height, 4, 2).fill(flue);
}

function miniBox(g: Graphics, p: Point, size: number, height: number, fill: number): void {
  const b = { x: p.x, y: p.y + size / 2 };
  const r = { x: p.x + size, y: p.y };
  const t = { x: p.x, y: p.y - size / 2 };
  const l = { x: p.x - size, y: p.y };
  poly(g, [l, b, up(b, height), up(l, height)], shade(fill, 0.75));
  poly(g, [b, r, up(r, height), up(b, height)], shade(fill, 0.92));
  poly(g, [up(t, height), up(r, height), up(b, height), up(l, height)], shade(fill, 1.1));
}

function waterTank(g: Graphics, p: Point, theme: Theme): void {
  const leg = color(theme, 'lot.tankLeg');
  const body = color(theme, 'lot.tankBody');
  const rim = color(theme, 'lot.tankRim');
  g.rect(p.x - 4, p.y - 6, 1.5, 6).fill(leg);
  g.rect(p.x + 2.5, p.y - 6, 1.5, 6).fill(leg);
  g.rect(p.x - 5, p.y - 14, 10, 8).fill(body);
  g.ellipse(p.x, p.y - 6, 5, 2.5).fill(rim);
  g.poly([p.x - 5.5, p.y - 14, p.x, p.y - 19, p.x + 5.5, p.y - 14]).fill(
    color(theme, 'lot.tankRoof'),
  );
}

function antenna(g: Graphics, p: Point, height: number, theme: Theme): void {
  const pole = color(theme, 'lot.antennaPole');
  g.rect(p.x - 0.75, p.y - height, 1.5, height).fill(pole);
  g.circle(p.x, p.y - height, 1.8).fill(color(theme, 'lot.antennaLight'));
}

/**
 * Lit rim along the two camera-facing edges of a roof: the cheap trick that turns any block into
 * a neon tower without a new palette entry. The glow is a wider, fainter stroke under the line.
 */
function litRim(g: Graphics, top: Point[], width: number, fill: number): void {
  const [, r, b, l] = top as [Point, Point, Point, Point];
  for (const [a, c] of [
    [l, b],
    [b, r],
  ] as const) {
    g.moveTo(a.x, a.y).lineTo(c.x, c.y).stroke({ width: width * 3, color: fill, alpha: 0.16 });
    g.moveTo(a.x, a.y).lineTo(c.x, c.y).stroke({ width, color: fill, alpha: 0.95 });
  }
}

/** Antenna mast with a warning beacon, planted on a roof point. */
function spireMast(g: Graphics, p: Point, height: number, theme: Theme): void {
  const pole = color(theme, 'lot.antennaPole');
  const light = color(theme, 'lot.antennaLight');
  g.rect(p.x - 1, p.y - height, 2, height).fill(pole);
  g.moveTo(p.x - 6, p.y - height * 0.35)
    .lineTo(p.x, p.y - height * 0.45)
    .lineTo(p.x + 6, p.y - height * 0.35)
    .stroke({ width: 1, color: pole, alpha: 0.85 });
  g.circle(p.x, p.y - height, 4).fill({ color: light, alpha: 0.18 });
  g.circle(p.x, p.y - height, 1.9).fill(light);
}

function tank(g: Graphics, p: Point, radius: number, height: number, fill: number): void {
  g.ellipse(p.x, p.y, radius, radius * 0.45).fill(shade(fill, 0.7));
  g.rect(p.x - radius, p.y - height, radius * 2, height).fill(fill);
  g.ellipse(p.x, p.y - height, radius, radius * 0.45).fill(shade(fill, 1.15));
}

function sawtooth(
  g: Graphics,
  top: Point[],
  teeth: number,
  rise: number,
  fill: number,
  glass: number,
): void {
  for (let k = 0; k < teeth; k++) {
    const v0 = k / teeth;
    const v1 = (k + 1) / teeth;
    const a0 = onTop(top, 0, v0);
    const b0 = onTop(top, 1, v0);
    const a1 = onTop(top, 0, v1);
    const b1 = onTop(top, 1, v1);
    poly(g, [a0, b0, up(b1, rise), up(a1, rise)], shade(fill, 1.05));
    poly(g, [a1, b1, up(b1, rise), up(a1, rise)], glass);
  }
}

function awning(
  g: Graphics,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  z: number,
  drop: number,
  dark: number,
  light: number,
  stripes = 4,
): void {
  const { b, r, l } = uvCorners(u0, v0, u1, v1);
  const out = { x: (b.x - l.x) * 0.22, y: (b.y - l.y) * 0.22 };
  for (let k = 0; k < stripes; k++) {
    const a = lerp(b, r, k / stripes);
    const e = lerp(b, r, (k + 1) / stripes);
    poly(
      g,
      [
        up(a, z),
        up(e, z),
        { x: e.x + out.x, y: e.y + out.y - drop },
        { x: a.x + out.x, y: a.y + out.y - drop },
      ],
      k % 2 === 0 ? dark : light,
    );
  }
}

function parapet(g: Graphics, top: Point[], rise: number, fill: number): void {
  const [t, r, b, l] = top as [Point, Point, Point, Point];
  poly(g, [l, b, up(b, rise), up(l, rise)], shade(fill, 0.7));
  poly(g, [b, r, up(r, rise), up(b, rise)], shade(fill, 0.9));
  poly(g, [up(t, rise), up(r, rise), up(b, rise), up(l, rise)], shade(fill, 1.08));
}

/** Thin ledges on the camera-facing faces, every other floor. */
function balconyRows(
  g: Graphics,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  height: number,
  floors: number,
  z0: number,
  fill: number,
): void {
  const floorH = height / Math.max(1, floors);
  const depth = 0.055;
  const ledge: BoxColors = { wall: fill, roof: shade(fill, 1.08) };
  for (let floor = 1; floor < floors; floor += 2) {
    const z = z0 + floor * floorH + 1;
    boxUV(g, u0 + 0.1, v1 - depth, u1 - 0.1, Math.min(0.99, v1 + 0.012), 2, ledge, 0, z);
    boxUV(g, u1 - depth, v0 + 0.1, Math.min(0.99, u1 + 0.012), v1 - 0.1, 2, ledge, 0, z);
  }
}

function door(g: Graphics, from: Point, to: Point, t: number, z1: number, fill: number): void {
  const a = lerp(from, to, t);
  const e = lerp(from, to, t + 0.14);
  poly(g, [a, e, up(e, z1), up(a, z1)], fill);
}

function hangingSign(g: Graphics, p: Point, fill: number, post: number): void {
  g.rect(p.x - 0.7, p.y - 12, 1.4, 5).fill(post);
  g.rect(p.x + 0.7, p.y - 13, 10, 8).fill(fill);
}

function billboard(g: Graphics, p: Point, fill: number, post: number): void {
  g.rect(p.x - 1, p.y - 14, 2, 14).fill(post);
  g.rect(p.x + 1, p.y - 16, 14, 9).fill(fill);
  g.rect(p.x + 2.5, p.y - 14.5, 11, 6).fill(shade(fill, 1.15));
}

function muted(theme: Theme, p: LotPalette, abandoned: boolean): LotPalette {
  if (!abandoned) return p;
  return theme.abandoned;
}

function styleOf(variant: number): number {
  return variant & 3;
}

/** Sprite height in pixels per zone level, shared by the drawing code and its tests. */
export const ZONE_HEIGHTS: Record<'residential' | 'commercial', readonly number[]> = {
  residential: [0, 0, 0, 40, 68, 104, 148, 196],
  commercial: [0, 16, 28, 50, 84, 128, 174, 226],
};

/** Floors drawn on the facade per level; windows follow the height ladder. */
const ZONE_FLOORS: Record<'residential' | 'commercial', readonly number[]> = {
  residential: [0, 0, 0, 4, 7, 11, 16, 21],
  commercial: [0, 1, 2, 4, 7, 11, 16, 21],
};

export type ZonedKind = keyof typeof ZONE_HEIGHTS;

export function zoneHeight(kind: ZonedKind, level: number): number {
  const table = ZONE_HEIGHTS[kind];
  return table[level] ?? (kind === 'residential' ? 40 : 16);
}

export function zoneFloors(kind: ZonedKind, level: number): number {
  const table = ZONE_FLOORS[kind];
  return table[level] ?? (kind === 'residential' ? 4 : 1);
}

export function drawResidential(
  g: Graphics,
  theme: Theme,
  level: number,
  variant: number,
  abandoned: boolean,
): void {
  const style = styleOf(variant);
  const row = level <= 2 ? theme.housePalettes : theme.towerPalettes;
  const p = muted(theme, row[style] ?? (row[0] as LotPalette), abandoned);
  const colors: BoxColors = { wall: p.wall, roof: p.roof, window: p.window };

  if (level <= 2) {
    const h = level <= 1 ? 12 : 22;
    const floors = level <= 1 ? 1 : 2;
    const rise = level <= 1 ? 9 : 10;
    if (style === 0) {
      const top = boxUV(g, 0.22, 0.22, 0.78, 0.78, h, colors, floors);
      pitchedRoof(g, top, rise, p.roof);
    } else if (style === 1) {
      const top = boxUV(g, 0.16, 0.18, 0.84, 0.82, h, colors, floors);
      hipRoof(g, top, rise, p.roof);
      chimney(
        g,
        up(onTop(top, 0.72, 0.36), rise * 0.4),
        9,
        p.accent,
        color(theme, 'lot.chimneyFlue'),
      );
    } else if (style === 2) {
      const top = boxUV(g, 0.18, 0.1, 0.82, 0.64, h, colors, floors);
      pitchedRoofSide(g, top, rise, p.roof);
      const porch = uvCorners(0.28, 0.64, 0.72, 0.94);
      boxUV(g, 0.28, 0.64, 0.72, 0.94, 7, {
        wall: shade(p.wall, 0.9),
        roof: shade(p.roof, 0.85),
      });
      door(g, porch.b, porch.r, 0.36, 7, shade(p.accent, 0.7));
    } else {
      // Wing on the camera-facing front-right so the L reads in iso.
      const main = boxUV(g, 0.1, 0.12, 0.68, 0.78, h, colors, floors);
      pitchedRoof(g, main, rise, p.roof);
      const wing = boxUV(g, 0.5, 0.48, 0.9, 0.88, h * 0.78, colors, Math.max(1, floors - 1));
      pitchedRoofSide(g, wing, rise * 0.7, p.roof);
    }
    return;
  }

  const h = zoneHeight('residential', level);
  const f = zoneFloors('residential', level);
  const tower: BoxColors = { wall: p.wall, roof: p.roof, window: p.window };
  const spire = level >= 6;

  if (style === 0) {
    const top = boxUV(g, 0.08, 0.08, 0.92, 0.92, h, tower, f);
    balconyRows(g, 0.08, 0.08, 0.92, 0.92, h, f, 0, shade(p.accent, 0.9));
    parapet(g, top, 4, p.roof);
    if (abandoned) return;
    if (spire) {
      // Setback crown and a lit rim: the silhouette of a vertical neon tower.
      const crown = boxUV(g, 0.18, 0.18, 0.82, 0.82, h * 0.16, tower, Math.round(f * 0.2), h);
      litRim(g, top, 2, p.accent);
      spireMast(g, onTop(crown, 0.5, 0.5), 34, theme);
      return;
    }
    waterTank(g, onTop(top, 0.55, 0.4), theme);
    if (level >= 5) antenna(g, onTop(top, 0.28, 0.68), 16, theme);
    return;
  }
  if (style === 1) {
    const mid = h * 0.42;
    const cap = h * 0.28;
    boxUV(g, 0.06, 0.06, 0.94, 0.94, mid, tower, Math.max(2, Math.round(f * 0.42)));
    boxUV(
      g,
      0.18,
      0.18,
      0.82,
      0.82,
      h - mid - cap,
      tower,
      Math.max(2, Math.round(f * 0.3)),
      mid,
    );
    const top = boxUV(g, 0.3, 0.3, 0.7, 0.7, cap, tower, Math.max(1, Math.round(f * 0.28)), h - cap);
    parapet(g, top, 3, p.roof);
    if (!abandoned) miniBox(g, onTop(top, 0.5, 0.45), 6, 5, shade(p.wall, 0.7));
    if (spire && !abandoned) {
      litRim(g, top, 1.8, p.accent);
      spireMast(g, onTop(top, 0.5, 0.5), 40, theme);
    }
    return;
  }
  if (style === 2) {
    const podium = 12;
    boxUV(
      g,
      0.04,
      0.04,
      0.96,
      0.96,
      podium,
      { wall: shade(p.wall, 0.72), roof: shade(p.roof, 0.85), window: p.window },
      1,
    );
    const top = boxUV(g, 0.24, 0.12, 0.92, 0.76, h - podium, tower, f, podium);
    parapet(g, top, 3, p.roof);
    if (!abandoned) antenna(g, onTop(top, 0.7, 0.3), 14, theme);
    if (spire && !abandoned) {
      litRim(g, top, 1.8, p.accent);
      spireMast(g, onTop(top, 0.3, 0.6), 36, theme);
    }
    return;
  }
  const bar = boxUV(g, 0.08, 0.08, 0.92, 0.38, h, tower, f);
  const wing = boxUV(g, 0.08, 0.38, 0.4, 0.92, h * 0.82, tower, Math.max(2, f - 2));
  parapet(g, bar, 3, p.roof);
  if (abandoned) return;
  if (spire) {
    litRim(g, bar, 2, p.accent);
    spireMast(g, onTop(bar, 0.5, 0.24), 38, theme);
    return;
  }
  waterTank(g, onTop(bar, 0.72, 0.45), theme);
  if (level >= 5) antenna(g, onTop(wing, 0.45, 0.55), 16, theme);
}

export function drawCommercial(
  g: Graphics,
  theme: Theme,
  level: number,
  variant: number,
  abandoned: boolean,
): void {
  const style = styleOf(variant);
  const p = muted(theme, theme.commercialPalettes[style] ?? (theme.commercialPalettes[0] as LotPalette), abandoned);
  const stripe = abandoned ? theme.abandoned.accent : p.accent;
  const cream = abandoned
    ? shade(color(theme, 'lot.commercialCream'), 0.72)
    : color(theme, 'lot.commercialCream');
  const awningDark = abandoned
    ? color(theme, 'lot.awningAbandoned')
    : color(theme, 'lot.awningDark');

  if (level <= 2) {
    const h = level <= 1 ? 16 : 28;
    const floors = level <= 1 ? 1 : 2;
    const u0 = 0.16;
    const v0 = 0.16;
    const u1 = 0.84;
    const v1 = 0.84;
    if (style === 2) {
      const top = boxUV(
        g,
        u0,
        v0,
        u1,
        v1,
        h,
        { wall: p.wall, roof: p.roof, window: p.window },
        floors,
      );
      parapet(g, top, 3, p.roof);
      const { b, r } = uvCorners(u0, v0, u1, v1);
      door(g, b, r, 0.4, 8, shade(p.accent, 0.55));
      return;
    }
    if (style === 3) {
      boxUV(g, u0, v0, u1, v1, 8, { wall: shade(p.wall, 0.72), roof: p.roof, window: p.window }, 1);
      boxUV(
        g,
        u0 + 0.03,
        v0 + 0.03,
        u1 - 0.03,
        v1 - 0.03,
        h,
        { wall: p.wall, roof: p.roof, window: p.window },
        floors,
      );
      awning(g, u0, v0, u1, v1, 10, 7, stripe, awningDark);
      return;
    }
    boxUV(g, u0, v0, u1, v1, h, { wall: p.wall, roof: p.roof, window: p.window }, floors);
    awning(g, u0, v0, u1, v1, 10, 7, stripe, cream);
    if (style === 1 && !abandoned) {
      const { l, b } = uvCorners(u0, v0, u1, v1);
      hangingSign(g, up(lerp(l, b, 0.22), 12), p.accent, color(theme, 'lot.signPost'));
    }
    return;
  }

  const h = zoneHeight('commercial', level);
  const f = zoneFloors('commercial', level);
  const colors: BoxColors = { wall: p.wall, roof: p.roof, window: p.window };
  const rooftop = color(theme, 'lot.rooftopUnit');
  const spire = level >= 6;

  if (style === 0) {
    const top = boxUV(g, 0.1, 0.1, 0.9, 0.9, h, colors, f);
    if (abandoned) return;
    if (spire) {
      const crown = boxUV(g, 0.2, 0.2, 0.8, 0.8, h * 0.18, colors, Math.round(f * 0.18), h);
      litRim(g, top, 2, p.accent);
      spireMast(g, onTop(crown, 0.45, 0.55), 44, theme);
      return;
    }
    if (level === 3) {
      miniBox(g, onTop(top, 0.35, 0.35), 5, 4, rooftop);
      miniBox(g, onTop(top, 0.7, 0.55), 5, 4, rooftop);
    } else {
      miniBox(g, onTop(top, 0.5, 0.5), 9, 8, shade(p.roof, 0.9));
      antenna(g, onTop(top, 0.5, 0.5), level >= 5 ? 30 : 18, theme);
    }
    return;
  }
  if (style === 1) {
    boxUV(g, 0.1, 0.1, 0.9, 0.9, h * 0.78, colors, Math.max(2, f - 2));
    const top = boxUV(g, 0.2, 0.2, 0.8, 0.8, h * 0.22, colors, 2, h * 0.78);
    if (!abandoned) antenna(g, onTop(top, 0.55, 0.45), level >= 5 ? 22 : 14, theme);
    if (spire && !abandoned) litRim(g, top, 1.8, p.accent);
    return;
  }
  if (style === 2) {
    const back = boxUV(g, 0.1, 0.08, 0.9, 0.58, h, colors, f);
    boxUV(g, 0.1, 0.58, 0.5, 0.9, h * 0.78, colors, Math.max(2, f - 2));
    if (!abandoned) miniBox(g, onTop(back, 0.75, 0.35), 6, 5, shade(p.roof, 0.85));
    if (spire && !abandoned) spireMast(g, onTop(back, 0.72, 0.3), 40, theme);
    return;
  }
  const top = boxUV(g, 0.1, 0.1, 0.9, 0.9, h, colors, f);
  if (abandoned) return;
  billboard(g, onTop(top, 0.2, 0.55), p.accent, color(theme, 'lot.billboardPost'));
  antenna(g, onTop(top, 0.75, 0.3), level >= 5 ? 24 : 16, theme);
  if (spire) litRim(g, top, 1.8, p.accent);
}

export function drawIndustrial(
  g: Graphics,
  theme: Theme,
  level: number,
  variant: number,
  abandoned: boolean,
): void {
  const style = styleOf(variant);
  const p = muted(
    theme,
    theme.industrialPalettes[style] ?? (theme.industrialPalettes[0] as LotPalette),
    abandoned,
  );
  const colors: BoxColors = { wall: p.wall, roof: p.roof, window: p.window };
  const h = INDUSTRIAL_HEIGHTS[level] ?? 12;
  const glass = color(theme, 'lot.sawtoothGlass');
  const roofCap = color(theme, 'lot.industrialRoofCap');
  const windowFill = color(theme, 'lot.industrialWindow');
  const flue = color(theme, 'lot.chimneyFlue');

  if (level <= 2) {
    if (style === 0) {
      const top = boxUV(
        g,
        INDUSTRIAL_INSET,
        INDUSTRIAL_INSET,
        1 - INDUSTRIAL_INSET,
        1 - INDUSTRIAL_INSET,
        h,
        colors,
      );
      sawtooth(g, top, 3, 6, p.roof, glass);
    } else if (style === 1) {
      const top = boxUV(g, 0.16, 0.16, 0.84, 0.84, h, colors);
      tank(g, onTop(top, 0.32, 0.4), 5, 8, shade(p.wall, 0.85));
      tank(g, onTop(top, 0.68, 0.58), 4, 6, shade(p.wall, 0.7));
    } else if (style === 2) {
      const shed = boxUV(g, 0.1, 0.08, 0.9, 0.6, h, colors);
      sawtooth(g, shed, 2, 5, p.roof, glass);
      boxUV(
        g,
        0.16,
        0.6,
        0.58,
        0.9,
        14,
        { wall: shade(p.wall, 1.06), roof: p.roof, window: p.window },
        1,
      );
    } else {
      boxUV(g, 0.08, 0.56, 0.92, 0.92, 5, { wall: shade(p.wall, 0.78), roof: roofCap });
      const top = boxUV(g, 0.12, 0.1, 0.88, 0.58, h, colors);
      sawtooth(g, top, 2, 5, p.roof, glass);
    }
    return;
  }

  // Main volume stays on chimneys() so smoke sits on the roof; extras sit in front.
  const top = boxUV(
    g,
    INDUSTRIAL_INSET,
    INDUSTRIAL_INSET,
    1 - INDUSTRIAL_INSET,
    1 - INDUSTRIAL_INSET,
    h,
    { wall: p.wall, roof: p.roof, window: windowFill },
    1,
  );
  if (style === 1) {
    boxUV(g, 0.18, 0.78, 0.58, 0.98, h * 0.45, { wall: shade(p.wall, 0.9), roof: p.roof });
  } else if (style === 2) {
    boxUV(
      g,
      0.08,
      0.68,
      0.4,
      0.96,
      h + 8,
      { wall: shade(p.wall, 1.08), roof: p.roof, window: p.window },
      1,
    );
  } else if (style === 3 && !abandoned) {
    tank(g, onTop(top, 0.25, 0.35), 5, 7, shade(p.wall, 0.8));
    tank(g, onTop(top, 0.72, 0.58), 4, 6, shade(p.wall, 0.7));
  }
  for (const c of chimneys('industrial', level, 1, theme)) {
    chimney(g, c.base, c.height, abandoned ? theme.abandoned.roof : c.color, flue);
  }
}
