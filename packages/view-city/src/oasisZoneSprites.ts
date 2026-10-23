import type { Graphics } from 'pixi.js';
import { shade, type LotPalette, type Theme } from '@theme/core';
import { Frame, poly } from './isoFrame';

/**
 * Adobe zone lots for the oasis ruleset.
 *
 * Low flat roofs, a door and a coloured band. `theme.style === 'adobe'` selects this file.
 * Heights stay short on purpose: an oasis city does not grow spires.
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

function house(g: Graphics, palette: LotPalette, level: number, door: number): void {
  const f = new Frame(1);
  const height = adobeHeight(level);
  const wall = palette.wall;
  const roof = palette.roof;
  f.box(g, [0.08, 0.08, 0.92, 0.92], 0, height, wall, roof);
  slit(f, g, 0.4, 0.58, 0.92, 0, Math.min(8, height * 0.4), shade(wall, 0.55));
  slit(f, g, 0.22, 0.36, 0.92, height * 0.45, height * 0.72, palette.window ?? door);
  const lintel = f.p(0.4, 0.92, Math.min(8, height * 0.4));
  const lintelEnd = f.p(0.58, 0.92, Math.min(8, height * 0.4));
  f.trim(g, lintel, lintelEnd, 1.4, door, 0.9);
}

export function drawAdobeResidential(
  g: Graphics,
  theme: Theme,
  level: number,
  variant: number,
  abandoned: boolean,
): void {
  const palette = lot(theme.housePalettes, variant, theme.abandoned, abandoned);
  house(g, palette, level, palette.accent);
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
  f.box(g, [0.06, 0.1, 0.94, 0.9], 0, height, palette.wall, palette.roof);
  slit(f, g, 0.3, 0.48, 0.9, height * 0.35, height * 0.62, palette.window ?? palette.accent);
  const awning = f.p(0.12, 0.9, height * 0.42);
  const awningEnd = f.p(0.88, 0.9, height * 0.42);
  f.trim(g, awning, awningEnd, 2.2, palette.accent, 0.95);
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
  f.box(g, [0.04, 0.08, 0.96, 0.88], 0, height, palette.wall, palette.roof);
  f.post(g, 0.78, 0.28, height + 10, shade(palette.wall, 0.7), 2);
  f.trimAt(g, f.p(0.2, 0.2), f.p(0.7, 0.2), height + 1, 1.2, palette.accent, 0.8);
}
