import type { Graphics } from 'pixi.js';
import { color, shade, type LotPalette, type Theme } from '@theme/core';
import { INDUSTRIAL_HEIGHTS, chimneys } from './chimneys';
import { Frame, poly, type Rect } from './isoFrame';
import { TILE_H, TILE_W, type Point } from './iso';
import { zoneHeight } from './zoneSprites';

/**
 * Cyberpunk zone lots.
 *
 * The classic drawings answer "house, shop, shed". These answer the same questions with the
 * massing of a neon block: a dark shell, a few large lit openings, a glowing edge and a machine
 * roof. `theme.style === 'cyber'` selects this file. The classic silhouettes stay in
 * `zoneSprites.ts`, and every painted colour still comes from the theme.
 */

const RX = Math.SQRT2 * (TILE_W / 2);
const RY = Math.SQRT2 * (TILE_H / 2);

function lot(palettes: readonly LotPalette[], variant: number, abandoned: LotPalette, dead: boolean): LotPalette {
  if (dead) return abandoned;
  return palettes[variant & 3] ?? (palettes[0] as LotPalette);
}

/** Dark shell. Wall shading stays close to the palette so a lit opening can carry the colour. */
function shell(g: Graphics, f: Frame, r: Rect, z0: number, height: number, wall: number, roof: number): void {
  const [u0, v0, u1, v1] = r;
  const z1 = z0 + height;
  poly(g, [f.p(u0, v1, z0), f.p(u1, v1, z0), f.p(u1, v1, z1), f.p(u0, v1, z1)], shade(wall, 0.9));
  poly(g, [f.p(u1, v1, z0), f.p(u1, v0, z0), f.p(u1, v0, z1), f.p(u1, v1, z1)], wall);
  poly(g, [f.p(u0, v0, z1), f.p(u1, v0, z1), f.p(u1, v1, z1), f.p(u0, v1, z1)], roof);
}

/** One large opening on the front face. Replaces the classic grid of small windows. */
function opening(g: Graphics, f: Frame, u0: number, u1: number, v: number, z0: number, z1: number, fill: number): void {
  poly(g, [f.p(u0, v, z0), f.p(u1, v, z0), f.p(u1, v, z1), f.p(u0, v, z1)], fill);
}

function sideOpening(
  g: Graphics,
  f: Frame,
  u: number,
  v0: number,
  v1: number,
  z0: number,
  z1: number,
  fill: number,
): void {
  poly(g, [f.p(u, v0, z0), f.p(u, v1, z0), f.p(u, v1, z1), f.p(u, v0, z1)], fill);
}

/** Lit edge along the two camera-facing roof lines. */
function edge(g: Graphics, f: Frame, r: Rect, z: number, tint: number): void {
  const [u0, v0, u1, v1] = r;
  f.trimAt(g, f.p(u0, v1), f.p(u1, v1), z, 1.6, tint, 0.95);
  f.trimAt(g, f.p(u1, v1), f.p(u1, v0), z, 1.6, tint, 0.95);
}

function mast(g: Graphics, f: Frame, u: number, v: number, z: number, height: number, theme: Theme): void {
  const tip = f.post(g, u, v, height, color(theme, 'lot.antennaPole'), 1.4, z);
  g.circle(tip.x, tip.y, 1.7).fill(color(theme, 'lot.antennaLight'));
}

/** Equipment box on a flat roof. Stands in for the classic water tank. */
function plant(g: Graphics, f: Frame, u: number, v: number, z: number, theme: Theme): void {
  const body = color(theme, 'lot.rooftopUnit');
  shell(g, f, [u, v, u + 0.18, v + 0.16], z, 6, body, color(theme, 'lot.antennaPole'));
}

/** Glass shaft: an iso cylinder, the one silhouette that is not a box. */
function shaft(
  g: Graphics,
  f: Frame,
  u: number,
  v: number,
  radius: number,
  z0: number,
  height: number,
  wall: number,
  cap: number,
): void {
  const c = f.p(u, v, z0);
  const rx = radius * RX;
  const ry = radius * RY;
  g.rect(c.x - rx, c.y - height, rx * 2, height).fill(wall);
  g.rect(c.x - rx, c.y - height, rx * 0.4, height).fill(shade(wall, 0.86));
  g.ellipse(c.x, c.y - height, rx, ry).fill(cap);
  g.rect(c.x - 1.2, c.y - height + 2, 2.4, height - 4).fill(cap);
}

function stack(g: Graphics, base: Point, height: number, fill: number, cap: number): void {
  const w = 3.2;
  poly(
    g,
    [
      { x: base.x - w, y: base.y },
      { x: base.x, y: base.y + w * 0.45 },
      { x: base.x, y: base.y + w * 0.45 - height },
      { x: base.x - w, y: base.y - height },
    ],
    shade(fill, 0.88),
  );
  poly(
    g,
    [
      { x: base.x, y: base.y + w * 0.45 },
      { x: base.x + w, y: base.y },
      { x: base.x + w, y: base.y - height },
      { x: base.x, y: base.y + w * 0.45 - height },
    ],
    fill,
  );
  g.ellipse(base.x, base.y - height, w, w * 0.42).fill(cap);
}

function drum(g: Graphics, f: Frame, u: number, v: number, radius: number, z: number, height: number, body: number, cap: number): void {
  const c = f.p(u, v, z);
  const rx = radius * RX;
  const ry = radius * RY;
  g.rect(c.x - rx, c.y - height, rx * 2, height).fill(body);
  g.ellipse(c.x, c.y - height, rx, ry).fill(cap);
}

/** One lit opening on a short shed, a row of slots once the wall is tall enough to hold them. */
function glowFace(
  g: Graphics,
  f: Frame,
  u0: number,
  u1: number,
  v: number,
  height: number,
  count: number,
  fill: number,
): void {
  if (height < 26) {
    opening(g, f, u0, u1, v, height * 0.28, height * 0.7, fill);
    return;
  }
  slits(g, f, u0, u1, v, 3, height - 6, count, fill);
}

/** Horizontal glowing slots across a tall industrial wall. */
function slits(
  g: Graphics,
  f: Frame,
  u0: number,
  u1: number,
  v: number,
  z0: number,
  height: number,
  count: number,
  fill: number,
): void {
  const span = Math.max(8, height - 4);
  const band = Math.min(6, Math.max(3, span / (count * 2.2)));
  const step = span / (count + 1);
  for (let i = 0; i < count; i++) {
    const z = z0 + step * (i + 1);
    opening(g, f, u0, u1, v, z, z + band, fill);
  }
}

function finish(g: Graphics, f: Frame, r: Rect, z: number, tint: number, theme: Theme, withMast: boolean, mastU: number, mastV: number): void {
  edge(g, f, r, z, tint);
  if (withMast) mast(g, f, mastU, mastV, z, 14, theme);
}

export function drawCyberResidential(
  g: Graphics,
  theme: Theme,
  level: number,
  variant: number,
  abandoned: boolean,
): void {
  const f = new Frame(1);
  const low = level <= 2;
  const p = lot(low ? theme.housePalettes : theme.towerPalettes, variant, theme.abandoned, abandoned);
  const glass = p.window ?? p.accent;
  const style = variant & 3;
  const lit = !abandoned;

  if (low) {
    const height = level <= 1 ? 20 : 32;
    if (style === 0) {
      const r: Rect = [0.14, 0.14, 0.86, 0.86];
      shell(g, f, r, 0, height, p.wall, p.roof);
      opening(g, f, 0.28, 0.72, 0.86, 2, height * 0.5, glass);
      sideOpening(g, f, 0.86, 0.34, 0.62, 3, height * 0.46, glass);
    } else if (style === 1) {
      const podium = Math.round(height * 0.55);
      shell(g, f, [0.08, 0.08, 0.92, 0.92], 0, podium, p.wall, p.roof);
      shell(g, f, [0.24, 0.24, 0.76, 0.76], podium, height - podium, p.wall, p.roof);
      opening(g, f, 0.22, 0.78, 0.92, 2, podium * 0.72, glass);
    } else if (style === 2) {
      shell(g, f, [0.1, 0.16, 0.68, 0.88], 0, height, p.wall, p.roof);
      shell(g, f, [0.58, 0.22, 0.9, 0.78], 0, height, glass, glass);
    } else {
      shell(g, f, [0.08, 0.08, 0.92, 0.46], 0, height, p.wall, p.roof);
      shell(g, f, [0.08, 0.4, 0.5, 0.92], 0, Math.round(height * 0.72), p.wall, p.roof);
      opening(g, f, 0.22, 0.78, 0.46, 2, height * 0.46, glass);
      sideOpening(g, f, 0.5, 0.52, 0.8, 2, height * 0.4, glass);
    }
    if (lit) {
      const roof: Rect =
        style === 1 ? [0.24, 0.24, 0.76, 0.76] : style === 2 ? [0.1, 0.16, 0.9, 0.88] : style === 3 ? [0.08, 0.08, 0.92, 0.46] : [0.14, 0.14, 0.86, 0.86];
      finish(g, f, roof, height, p.accent, theme, true, style === 1 ? 0.5 : 0.7, style === 1 ? 0.5 : 0.3);
    }
    return;
  }

  const height = zoneHeight('residential', level);
  if (style === 0) {
    const r: Rect = [0.1, 0.1, 0.9, 0.9];
    shell(g, f, r, 0, height, p.wall, p.roof);
    opening(g, f, 0.68, 0.82, 0.9, 6, height - 6, glass);
    sideOpening(g, f, 0.9, 0.28, 0.42, 8, height - 8, glass);
    if (lit) plant(g, f, 0.18, 0.18, height, theme);
  } else if (style === 1) {
    const podium = Math.round(height * 0.34);
    const crown = Math.round(height * 0.22);
    shell(g, f, [0.06, 0.06, 0.94, 0.94], 0, podium, shade(p.wall, 0.92), p.roof);
    shell(g, f, [0.18, 0.18, 0.82, 0.82], podium, height - podium - crown, p.wall, p.roof);
    shell(g, f, [0.3, 0.3, 0.7, 0.7], height - crown, crown, p.wall, p.roof);
    opening(g, f, 0.62, 0.76, 0.82, podium + 4, height - crown - 4, glass);
  } else if (style === 2) {
    shell(g, f, [0.08, 0.08, 0.92, 0.92], 0, 14, shade(p.wall, 0.92), p.roof);
    opening(g, f, 0.2, 0.7, 0.92, 2, 10, glass);
    shaft(g, f, 0.55, 0.48, 0.24, 10, height - 10, p.wall, glass);
  } else {
    shell(g, f, [0.08, 0.08, 0.92, 0.4], 0, height, p.wall, p.roof);
    shell(g, f, [0.08, 0.36, 0.42, 0.92], 0, Math.round(height * 0.78), p.wall, p.roof);
    opening(g, f, 0.7, 0.84, 0.4, 6, height - 8, glass);
    sideOpening(g, f, 0.42, 0.5, 0.7, 6, height * 0.6, glass);
    if (lit) plant(g, f, 0.16, 0.14, height, theme);
  }
  if (lit) {
    if (style === 2) {
      edge(g, f, [0.08, 0.08, 0.92, 0.92], 14, p.accent);
      mast(g, f, 0.55, 0.48, height, 18, theme);
    } else {
      const roof: Rect = style === 1 ? [0.3, 0.3, 0.7, 0.7] : style === 3 ? [0.08, 0.08, 0.92, 0.4] : [0.1, 0.1, 0.9, 0.9];
      finish(g, f, roof, height, p.accent, theme, true, style === 1 ? 0.5 : 0.72, style === 1 ? 0.5 : 0.28);
    }
  }
}

export function drawCyberCommercial(
  g: Graphics,
  theme: Theme,
  level: number,
  variant: number,
  abandoned: boolean,
): void {
  const f = new Frame(1);
  const p = lot(theme.commercialPalettes, variant, theme.abandoned, abandoned);
  const glass = p.window ?? p.accent;
  const style = variant & 3;
  const lit = !abandoned;
  const height = zoneHeight('commercial', level);

  if (level <= 2) {
    if (style === 0) {
      shell(g, f, [0.12, 0.12, 0.88, 0.88], 0, height, p.wall, p.roof);
      opening(g, f, 0.22, 0.78, 0.88, 2, height * 0.46, glass);
      opening(g, f, 0.18, 0.82, 0.88, height * 0.58, height * 0.78, p.accent);
    } else if (style === 1) {
      shell(g, f, [0.12, 0.12, 0.88, 0.88], 0, height, p.wall, p.roof);
      opening(g, f, 0.22, 0.78, 0.88, 2, height * 0.46, glass);
      opening(g, f, 0.18, 0.82, 0.88, height * 0.58, height * 0.78, p.accent);
      sideOpening(g, f, 0.88, 0.28, 0.7, height * 0.58, height * 0.78, p.accent);
    } else if (style === 2) {
      const podium = Math.round(height * 0.62);
      shell(g, f, [0.08, 0.08, 0.92, 0.92], 0, podium, p.wall, p.roof);
      shell(g, f, [0.2, 0.2, 0.8, 0.8], podium, height - podium, p.wall, p.roof);
      opening(g, f, 0.18, 0.82, 0.92, 2, podium * 0.7, glass);
      opening(g, f, 0.28, 0.72, 0.8, podium + 2, height - 3, p.accent);
    } else {
      shell(g, f, [0.1, 0.14, 0.86, 0.86], 0, height, p.wall, p.roof);
      opening(g, f, 0.22, 0.7, 0.86, 2, height * 0.42, glass);
      shell(g, f, [0.18, 0.62, 0.82, 0.9], height * 0.5, Math.max(6, height * 0.22), p.accent, p.accent);
    }
    if (lit) {
      const roof: Rect = style === 2 ? [0.2, 0.2, 0.8, 0.8] : [0.12, 0.12, 0.88, 0.88];
      finish(g, f, roof, height, p.accent, theme, level === 2, 0.3, 0.28);
    }
    return;
  }

  if (style === 0) {
    const r: Rect = [0.1, 0.1, 0.9, 0.9];
    shell(g, f, r, 0, height, p.wall, p.roof);
    opening(g, f, 0.7, 0.84, 0.9, 8, height * 0.55, glass);
    opening(g, f, 0.18, 0.62, 0.9, height * 0.62, height * 0.88, p.accent);
    opening(g, f, 0.24, 0.56, 0.9, height * 0.68, height * 0.82, glass);
    if (lit) plant(g, f, 0.16, 0.16, height, theme);
  } else if (style === 1) {
    const podium = Math.round(height * 0.28);
    shell(g, f, [0.08, 0.08, 0.92, 0.92], 0, podium, shade(p.wall, 0.92), p.roof);
    shell(g, f, [0.2, 0.2, 0.8, 0.8], podium, height - podium, p.wall, p.roof);
    opening(g, f, 0.32, 0.68, 0.8, height * 0.55, height * 0.86, p.accent);
    opening(g, f, 0.36, 0.64, 0.8, height * 0.6, height * 0.8, glass);
  } else if (style === 2) {
    shell(g, f, [0.08, 0.08, 0.92, 0.92], 0, 16, shade(p.wall, 0.92), p.roof);
    opening(g, f, 0.18, 0.72, 0.92, 2, 12, glass);
    shaft(g, f, 0.52, 0.46, 0.22, 12, height - 12, p.wall, glass);
  } else {
    shell(g, f, [0.1, 0.1, 0.9, 0.9], 0, height, p.wall, p.roof);
    opening(g, f, 0.16, 0.72, 0.9, height * 0.58, height * 0.9, p.accent);
    opening(g, f, 0.22, 0.66, 0.9, height * 0.64, height * 0.84, glass);
    sideOpening(g, f, 0.9, 0.24, 0.42, height * 0.62, height * 0.84, p.accent);
  }
  if (lit) {
    if (style === 2) {
      edge(g, f, [0.08, 0.08, 0.92, 0.92], 16, p.accent);
      mast(g, f, 0.52, 0.46, height, 18, theme);
    } else {
      const roof: Rect = style === 1 ? [0.2, 0.2, 0.8, 0.8] : [0.1, 0.1, 0.9, 0.9];
      finish(g, f, roof, height, p.accent, theme, true, style === 1 ? 0.5 : 0.74, style === 1 ? 0.5 : 0.26);
    }
  }
}

export function drawCyberIndustrial(
  g: Graphics,
  theme: Theme,
  level: number,
  variant: number,
  abandoned: boolean,
): void {
  const f = new Frame(1);
  const p = lot(theme.industrialPalettes, variant, theme.abandoned, abandoned);
  const style = variant & 3;
  const height = INDUSTRIAL_HEIGHTS[level] ?? 12;
  const glow = abandoned ? (p.window ?? p.accent) : color(theme, 'fire.glow');
  const core = abandoned ? p.accent : color(theme, 'coal.glow');
  // Palette roofs include bare metal and rust. The cyber shed keeps a dark cap so the amber
  // slots, not the roof plane, carry the light.
  const roof = color(theme, 'coal.roof');

  if (style === 0) {
    shell(g, f, [0.1, 0.1, 0.9, 0.9], 0, height, p.wall, roof);
    glowFace(g, f, 0.22, 0.78, 0.9, height, 2, glow);
  } else if (style === 1) {
    shell(g, f, [0.1, 0.16, 0.9, 0.9], 0, height, p.wall, roof);
    glowFace(g, f, 0.24, 0.7, 0.9, height, 2, glow);
    drum(g, f, 0.32, 0.34, 0.12, height, 8, shade(p.wall, 0.9), roof);
    drum(g, f, 0.62, 0.42, 0.1, height, 6, p.wall, core);
  } else if (style === 2) {
    shell(g, f, [0.08, 0.2, 0.78, 0.92], 0, height, p.wall, roof);
    shell(g, f, [0.62, 0.12, 0.92, 0.55], 0, height + 10, p.wall, roof);
    opening(g, f, 0.68, 0.86, 0.55, 4, height + 4, glow);
    opening(g, f, 0.72, 0.82, 0.55, 8, height * 0.7, core);
  } else {
    shell(g, f, [0.06, 0.4, 0.94, 0.94], 0, Math.max(6, height * 0.35), shade(p.wall, 0.9), roof);
    shell(g, f, [0.14, 0.1, 0.86, 0.62], 0, height, p.wall, roof);
    glowFace(g, f, 0.26, 0.74, 0.62, height, 3, glow);
  }

  if (!abandoned) {
    const roof: Rect =
      style === 2 ? [0.62, 0.12, 0.92, 0.55] : style === 3 ? [0.14, 0.1, 0.86, 0.62] : [0.1, 0.16, 0.9, 0.9];
    edge(g, f, roof, style === 2 ? height + 10 : height, glow);
  }

  for (const chimney of chimneys('industrial', level, 1, theme)) {
    stack(g, chimney.base, chimney.height, abandoned ? roof : chimney.color, color(theme, 'lot.chimneyFlue'));
  }
}
