import type { Graphics } from 'pixi.js';
import { shade, type LotPalette, type Theme } from '@theme/core';
import { Frame, poly } from './isoFrame';

/**
 * Adobe zone lots for the oasis ruleset.
 *
 * Every roof is flat. Houses vary by court, roof box or two heights. Shops and yards
 * vary by stalls, a court or a kiln. `theme.style === 'adobe'` selects this file.
 */

function lot(
  palettes: readonly LotPalette[],
  variant: number,
  abandoned: LotPalette,
  dead: boolean,
): LotPalette {
  if (dead) return abandoned;
  return palettes[variant & 3] ?? (palettes[0] as LotPalette);
}

/** Adobe massing: a squat box, not the classic storeys and not a neon tower. */
function adobeHeight(level: number): number {
  return 10 + Math.max(0, level) * 4;
}

/** One vertical slit. Adobe lots do not grow a glass grid. */
function slit(
  f: Frame,
  g: Graphics,
  u0: number,
  u1: number,
  v: number,
  z0: number,
  z1: number,
  fill: number,
): void {
  poly(g, [f.p(u0, v, z0), f.p(u1, v, z0), f.p(u1, v, z1), f.p(u0, v, z1)], fill);
}

/** Lip along the two visible eaves, so a flat roof reads as a parapet and not a lid. */
function parapet(
  f: Frame,
  g: Graphics,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  z: number,
  wall: number,
): void {
  const lip = shade(wall, 0.9);
  f.box(g, [u0, v1 - 0.08, u1, v1], z, 3, wall, lip);
  f.box(g, [u1 - 0.08, v0, u1, v1 - 0.08], z, 3, wall, lip);
}

/** A flat block with the parapet sitting on the roof. */
function block(
  f: Frame,
  g: Graphics,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  z: number,
  height: number,
  wall: number,
  roof: number,
): void {
  f.box(g, [u0, v0, u1, v1], z, height, wall, roof);
  parapet(f, g, u0, v0, u1, v1, z + height, wall);
}

/** Door and one small window on the front wall. */
function openings(f: Frame, g: Graphics, v: number, height: number, door: number, window: number): void {
  slit(f, g, 0.38, 0.56, v, 0, Math.min(8, height * 0.4), shade(door, 0.45));
  slit(f, g, 0.66, 0.78, v, height * 0.42, Math.min(height * 0.7, height - 2), window);
}

function house(g: Graphics, palette: LotPalette, level: number, variant: number): void {
  const f = new Frame(1);
  const height = adobeHeight(level);
  const wall = palette.wall;
  const roof = palette.roof;
  const door = palette.accent;
  const window = palette.window ?? shade(wall, 0.45);
  const kind = variant & 3;
  if (kind === 1) {
    f.quad(g, 0.28, 0.22, 0.78, 0.62, shade(roof, 0.82), 1);
    block(f, g, 0.08, 0.08, 0.34, 0.7, 0, height, wall, roof);
    block(f, g, 0.66, 0.08, 0.92, 0.7, 0, height - 2, shade(wall, 0.94), roof);
    block(f, g, 0.08, 0.58, 0.92, 0.92, 0, height, wall, roof);
  } else if (kind === 2) {
    block(f, g, 0.08, 0.08, 0.92, 0.92, 0, height, wall, roof);
    f.box(g, [0.16, 0.16, 0.42, 0.42], height, 6, shade(wall, 1.04), shade(roof, 0.94));
  } else if (kind === 3) {
    block(f, g, 0.08, 0.08, 0.92, 0.5, 0, height, shade(wall, 0.96), roof);
    block(f, g, 0.08, 0.42, 0.92, 0.92, 0, height + 6, wall, shade(roof, 1.04));
  } else {
    block(f, g, 0.08, 0.08, 0.92, 0.92, 0, height, wall, roof);
  }
  openings(f, g, 0.92, height, door, window);
}

export function drawAdobeResidential(
  g: Graphics,
  theme: Theme,
  level: number,
  variant: number,
  abandoned: boolean,
): void {
  const palette = lot(theme.housePalettes, variant, theme.abandoned, abandoned);
  house(g, palette, level, variant);
}

/** Shop door: a dark arch on the street face. */
function shopDoor(f: Frame, g: Graphics, u0: number, u1: number, v: number, fill: number): void {
  const mid = (u0 + u1) / 2;
  poly(g, [f.p(u0, v, 0), f.p(u1, v, 0), f.p(u1, v, 6), f.p(mid, v, 8), f.p(u0, v, 6)], fill);
}

export function drawAdobeCommercial(
  g: Graphics,
  theme: Theme,
  level: number,
  variant: number,
  abandoned: boolean,
): void {
  const palette = lot(theme.commercialPalettes, variant, theme.abandoned, abandoned);
  const f = new Frame(1);
  const height = adobeHeight(level);
  const wall = palette.wall;
  const roof = palette.roof;
  const door = shade(wall, 0.42);
  const window = palette.window ?? shade(wall, 0.5);
  const kind = variant & 3;
  if (kind === 1) {
    block(f, g, 0.06, 0.16, 0.46, 0.9, 0, height, wall, roof);
    block(f, g, 0.54, 0.16, 0.94, 0.86, 0, height - 2, shade(wall, 0.94), roof);
    shopDoor(f, g, 0.14, 0.34, 0.9, door);
    shopDoor(f, g, 0.62, 0.82, 0.86, door);
  } else if (kind === 2) {
    block(f, g, 0.08, 0.12, 0.92, 0.9, 0, height, wall, roof);
    f.box(g, [0.16, 0.2, 0.4, 0.42], height, 6, shade(wall, 1.04), shade(roof, 0.96));
    shopDoor(f, g, 0.38, 0.58, 0.9, door);
    slit(f, g, 0.66, 0.78, 0.9, height * 0.4, height * 0.68, window);
    for (let i = 0; i < 3; i++) {
      f.quad(g, 0.7, 0.42 + i * 0.1, 0.86, 0.5 + i * 0.1, shade(wall, 0.86), 2 + i * 2);
    }
  } else if (kind === 3) {
    f.quad(g, 0.28, 0.28, 0.78, 0.7, shade(roof, 0.84), 1);
    block(f, g, 0.08, 0.1, 0.92, 0.36, 0, height, wall, roof);
    block(f, g, 0.08, 0.3, 0.32, 0.9, 0, height - 1, shade(wall, 0.95), roof);
    shopDoor(f, g, 0.42, 0.62, 0.36, door);
  } else {
    block(f, g, 0.08, 0.14, 0.92, 0.88, 0, height, wall, roof);
    f.box(g, [0.14, 0.72, 0.86, 0.96], height * 0.48, 2, shade(roof, 1.05), roof);
    shopDoor(f, g, 0.34, 0.56, 0.88, door);
    slit(f, g, 0.64, 0.76, 0.88, height * 0.45, height * 0.7, window);
  }
}

export function drawAdobeIndustrial(
  g: Graphics,
  theme: Theme,
  level: number,
  variant: number,
  abandoned: boolean,
): void {
  const palette = lot(theme.industrialPalettes, variant, theme.abandoned, abandoned);
  const f = new Frame(1);
  const height = Math.max(8, adobeHeight(level) - 4);
  const wall = palette.wall;
  const roof = palette.roof;
  const mouth = shade(wall, 0.38);
  const kind = variant & 3;
  if (kind === 1) {
    block(f, g, 0.06, 0.28, 0.94, 0.9, 0, height, wall, roof);
    block(f, g, 0.18, 0.1, 0.62, 0.4, 0, height + 6, shade(wall, 0.9), shade(roof, 0.92));
    f.post(g, 0.38, 0.18, height + 16, shade(wall, 0.62), 2.2);
    shopDoor(f, g, 0.66, 0.84, 0.9, mouth);
  } else if (kind === 2) {
    block(f, g, 0.06, 0.12, 0.48, 0.88, 0, height, wall, roof);
    block(f, g, 0.52, 0.2, 0.94, 0.78, 0, height - 3, shade(wall, 0.92), roof);
    f.post(g, 0.28, 0.22, height + 8, shade(wall, 0.65), 2);
    shopDoor(f, g, 0.16, 0.34, 0.88, mouth);
  } else if (kind === 3) {
    block(f, g, 0.08, 0.16, 0.92, 0.86, 0, height, wall, roof);
    f.post(g, 0.74, 0.28, height + 12, shade(wall, 0.62), 2.4);
    for (let i = 0; i < 3; i++) {
      f.quad(g, 0.16, 0.4 + i * 0.1, 0.32, 0.48 + i * 0.1, shade(wall, 0.84), 2 + i * 2.2);
    }
    shopDoor(f, g, 0.46, 0.64, 0.86, mouth);
  } else {
    block(f, g, 0.06, 0.14, 0.94, 0.88, 0, height, wall, roof);
    f.box(g, [0.16, 0.2, 0.4, 0.42], height, 5, shade(wall, 0.88), shade(roof, 0.94));
    f.post(g, 0.72, 0.26, height + 12, shade(wall, 0.62), 2.2);
    shopDoor(f, g, 0.42, 0.62, 0.88, mouth);
  }
}
