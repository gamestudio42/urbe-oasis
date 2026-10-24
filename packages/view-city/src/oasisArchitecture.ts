import type { Graphics } from 'pixi.js';
import { color, shade, tileHash, type LotPalette, type Theme } from '@theme/core';
import { Frame, poly, type Rect } from './isoFrame';
import {
  drawAdobeResidential as baseResidential,
  drawAdobeCommercial as baseCommercial,
  drawAdobeIndustrial as baseIndustrial,
} from './oasisZoneSprites';

/** Eight cached silhouettes from existing save data, without consuming engine RNG. */
export function adobeVariant(variant: number, x?: number, y?: number): number {
  return (
    (variant & 3) | (x !== undefined && y !== undefined && tileHash(x + 43, y - 17) >= 0.5 ? 4 : 0)
  );
}

const f = new Frame(1);

/** The same visible opening drives workshop smoke; open yards have no chimney. */
export function adobeIndustrialVent(level: number, variant: number) {
  const h = 6 + Math.max(0, level) * 4;
  switch (variant & 7) {
    case 0:
      return f.p(0.72, 0.26, h + 12);
    case 1:
      return f.p(0.38, 0.18, h + 16);
    case 2:
      return f.p(0.28, 0.22, h + 8);
    case 3:
      return f.p(0.74, 0.28, h + 12);
    case 4:
      return f.p(0.765, 0.35, h + 9);
    case 6:
      return f.p(0.27, 0.325, h + 5);
    default:
      return undefined;
  }
}
function palette(theme: Theme, list: readonly LotPalette[], variant: number, dead: boolean) {
  return dead ? theme.abandoned : list[variant & 3]!;
}

/** Recessed flat roof and low parapet. Heights use screen pixels. */
function room(g: Graphics, p: LotPalette, r: Rect, height: number, z = 0): void {
  const [u0, v0, u1, v1] = r;
  f.box(g, r, z, height, p.wall, p.roof);
  f.quad(g, u0 + 0.04, v0 + 0.04, u1 - 0.04, v1 - 0.04, shade(p.roof, 0.88), z + height + 0.1);
  f.box(g, [u0, v1 - 0.045, u1, v1], z + height, 1.5, p.wall, p.roof);
  f.box(g, [u1 - 0.045, v0, u1, v1 - 0.045], z + height, 1.5, p.wall, p.roof);
}

function arch(
  g: Graphics,
  u: number,
  v: number,
  width: number,
  height: number,
  fill: number,
  z = 0,
): void {
  poly(
    g,
    [
      f.p(u, v, z),
      f.p(u + width, v, z),
      f.p(u + width, v, z + height * 0.7),
      f.p(u + width * 0.5, v, z + height),
      f.p(u, v, z + height * 0.7),
    ],
    fill,
  );
}

/** Fabric edge and support posts remain readable at ordinary game zoom. */
function canopy(g: Graphics, theme: Theme, r: Rect, z: number, cloth: number, dead: boolean): void {
  const [u0, v0, u1, v1] = r;
  const wood = dead ? shade(theme.abandoned.wall, 0.65) : color(theme, 'tree.trunk');
  for (const u of [u0, u1]) f.post(g, u, v1, z, wood, 0.8);
  if (dead) {
    f.line(g, f.p(u0, v0, z), f.p(u1, v1, z), 0.8, wood);
    return;
  }
  for (let k = 0; k < 4; k++) {
    const a = u0 + ((u1 - u0) * k) / 4,
      b = u0 + ((u1 - u0) * (k + 1)) / 4;
    poly(
      g,
      [f.p(a, v0, z + 1.4), f.p(b, v0, z + 1.4), f.p(b, v1, z), f.p(a, v1, z)],
      shade(cloth, k % 2 ? 0.77 : 1.08),
    );
  }
  f.line(g, f.p(u0, v1, z), f.p(u1, v1, z), 1.2, shade(cloth, 0.65));
}

function pergola(g: Graphics, p: LotPalette, r: Rect, roof: number, dead: boolean): void {
  const [u0, v0, u1, v1] = r;
  const timber = shade(p.accent, 0.62);
  for (const u of [u0, u1]) for (const v of [v0, v1]) f.post(g, u, v, 5, timber, 0.7, roof);
  for (let k = 0; k < 5; k++) {
    if (dead && k % 2 === 1) continue;
    const v = v0 + ((v1 - v0) * k) / 4;
    f.line(g, f.p(u0, v, roof + 5), f.p(u1, v, roof + 5), 1.1, timber);
    if (!dead)
      f.line(g, f.p(u0, v + 0.03, roof + 0.2), f.p(u1, v + 0.03, roof + 0.2), 1, timber, 0, 0.25);
  }
}

function rug(g: Graphics, p: LotPalette, r: Rect, z: number): void {
  const [u0, v0, u1, v1] = r;
  f.quad(g, u0, v0, u1, v1, p.accent, z);
  f.quad(g, u0 + 0.025, v0 + 0.025, u1 - 0.025, v1 - 0.025, p.roof, z + 0.1);
  f.quad(g, u0 + 0.05, v0 + 0.05, u1 - 0.05, v1 - 0.05, p.accent, z + 0.2);
}

function jars(g: Graphics, p: LotPalette, u: number, v: number, z = 0): void {
  for (let k = 0; k < 3; k++) {
    const c = f.p(u + k * 0.085, v, z);
    g.ellipse(c.x, c.y - 1.5, 1.4, 2).fill(shade(p.wall, 0.8 + k * 0.12));
    g.ellipse(c.x, c.y - 3, 0.8, 0.4).fill(shade(p.wall, 0.4));
  }
}

function stairs(g: Graphics, p: LotPalette, u: number, v: number, height: number): void {
  for (let k = 5; k >= 0; k--) {
    const a = v + k * 0.075;
    f.box(g, [u, a, u + 0.18, a + 0.075], 0, ((6 - k) * height) / 6, shade(p.wall, 0.88), p.roof);
  }
}

/** Keep the original masses, add roof life, and open four new courtyard footprints. */
export function drawAdobeResidential(
  g: Graphics,
  theme: Theme,
  level: number,
  variant: number,
  dead: boolean,
): void {
  const p = palette(theme, theme.housePalettes, variant, dead);
  const h = 10 + Math.max(0, level) * 4;
  const dark = shade(p.wall, 0.4);
  if (variant < 4) {
    baseResidential(g, theme, level, variant, dead);
    const roof = variant === 3 ? h + 6 : h;
    if (!dead) rug(g, p, [0.44, 0.6, 0.76, 0.83], roof + 0.2);
    if (variant % 2 === 0) pergola(g, p, [0.16, 0.57, 0.42, 0.81], roof, dead);
    if (!dead && variant % 2 === 1) jars(g, p, 0.17, 0.82, roof);
    return;
  }
  f.quad(g, 0.08, 0.08, 0.92, 0.92, shade(p.roof, 0.9));
  switch (variant & 3) {
    case 0: // L-shaped court with a shaded veranda and low street wall.
      room(g, p, [0.08, 0.08, 0.89, 0.37], h);
      room(g, p, [0.08, 0.37, 0.37, 0.88], h - 3);
      arch(g, 0.54, 0.37, 0.17, 7, dark);
      if (!dead) rug(g, p, [0.48, 0.48, 0.78, 0.77], 0.2);
      canopy(g, theme, [0.4, 0.4, 0.88, 0.73], 7, p.roof, dead);
      f.box(g, [0.4, 0.88, 0.92, 0.94], 0, 3, p.wall, p.roof);
      break;
    case 1: // Terrace reached by exterior stairs.
      room(g, p, [0.08, 0.08, 0.7, 0.89], h - 4);
      room(g, p, [0.08, 0.08, 0.7, 0.42], 8, h - 4);
      arch(g, 0.29, 0.89, 0.18, 7, dark);
      stairs(g, p, 0.74, 0.4, h - 4);
      pergola(g, p, [0.16, 0.52, 0.6, 0.8], h - 4, dead);
      break;
    case 2: // Squat windcatcher above a deep porch.
      room(g, p, [0.12, 0.12, 0.87, 0.7], h - 2);
      room(g, p, [0.2, 0.19, 0.4, 0.39], 8, h - 2);
      arch(g, 0.25, 0.39, 0.1, 4, dark, h + 1);
      arch(g, 0.4, 0.7, 0.18, 7, dark);
      canopy(g, theme, [0.18, 0.7, 0.81, 0.93], 8, p.accent, dead);
      break;
    case 3: // Staggered pair with separate entrances.
      room(g, p, [0.08, 0.08, 0.48, 0.67], h + 3);
      room(g, p, [0.52, 0.26, 0.92, 0.91], h - 4);
      arch(g, 0.19, 0.67, 0.17, 7, dark);
      arch(g, 0.63, 0.91, 0.17, 7, dark);
      pergola(g, p, [0.57, 0.38, 0.84, 0.7], h - 4, dead);
      if (!dead) rug(g, p, [0.12, 0.73, 0.42, 0.92], 0.2);
      break;
  }
}

export function drawAdobeCommercial(
  g: Graphics,
  theme: Theme,
  level: number,
  variant: number,
  dead: boolean,
): void {
  const p = palette(theme, theme.commercialPalettes, variant, dead);
  const h = 10 + Math.max(0, level) * 4;
  const cloth = dead ? p.roof : color(theme, 'caravanserai.trim');
  const dark = shade(p.wall, 0.38);
  if (variant < 4) {
    baseCommercial(g, theme, level, variant, dead);
    const face = variant === 3 ? 0.36 : variant === 0 ? 0.88 : 0.9;
    canopy(
      g,
      theme,
      [0.36, face, 0.85, Math.min(0.98, face + 0.2)],
      Math.min(h - 1, 10),
      cloth,
      dead,
    );
    if (!dead) jars(g, p, 0.42, Math.min(0.98, face + 0.15));
    return;
  }
  f.quad(g, 0.06, 0.06, 0.94, 0.94, p.roof);
  switch (variant & 3) {
    case 0: // Souq: two separate fabric-covered stalls.
      room(g, p, [0.08, 0.08, 0.9, 0.35], h - 4);
      arch(g, 0.39, 0.35, 0.2, 7, dark);
      for (const u of [0.1, 0.55]) {
        f.box(g, [u, 0.69, u + 0.32, 0.85], 0, 3, p.wall, p.roof);
        if (!dead) jars(g, p, u + 0.04, 0.8, 3);
        canopy(g, theme, [u, 0.46, u + 0.34, 0.9], 9, u < 0.5 ? cloth : p.accent, dead);
      }
      break;
    case 1: // Tall rear store and low courtyard arcade.
      room(g, p, [0.08, 0.08, 0.9, 0.38], h + 3);
      for (let k = 0; k < 3; k++) arch(g, 0.16 + k * 0.25, 0.38, 0.14, 7, dark);
      room(g, p, [0.08, 0.38, 0.3, 0.91], h - 5);
      canopy(g, theme, [0.34, 0.65, 0.91, 0.93], 9, cloth, dead);
      break;
    case 2: // Arched gallery with an upper terrace.
      room(g, p, [0.1, 0.1, 0.9, 0.88], h + 3);
      for (let k = 0; k < 3; k++) {
        arch(g, 0.16 + k * 0.25, 0.88, 0.16, 8, dark);
        arch(g, 0.19 + k * 0.25, 0.88, 0.1, 4, dark, h - 4);
      }
      pergola(g, p, [0.2, 0.25, 0.79, 0.64], h + 3, dead);
      break;
    case 3: // Trading hall behind an open loading forecourt.
      room(g, p, [0.08, 0.08, 0.92, 0.59], h);
      arch(g, 0.2, 0.59, 0.2, 8, dark);
      arch(g, 0.6, 0.59, 0.2, 8, dark);
      if (!dead) {
        rug(g, p, [0.12, 0.67, 0.42, 0.91], 0.2);
        jars(g, p, 0.61, 0.85);
      }
      canopy(g, theme, [0.5, 0.6, 0.9, 0.92], 9, cloth, dead);
      break;
  }
}

export function drawAdobeIndustrial(
  g: Graphics,
  theme: Theme,
  level: number,
  variant: number,
  dead: boolean,
): void {
  const p = palette(theme, theme.industrialPalettes, variant, dead);
  const h = 6 + Math.max(0, level) * 4;
  const dark = shade(p.wall, 0.38);
  if (variant < 4) {
    baseIndustrial(g, theme, level, variant, dead);
    if (!dead) jars(g, p, 0.12, 0.96);
    return;
  }
  f.quad(g, 0.06, 0.06, 0.94, 0.94, shade(p.roof, 0.87));
  switch (variant & 3) {
    case 0: // Pottery: stepped kiln and drying jars.
      room(g, p, [0.08, 0.08, 0.55, 0.7], h);
      room(g, p, [0.64, 0.2, 0.89, 0.5], h + 5);
      f.box(g, [0.68, 0.25, 0.85, 0.45], h + 5, 4, p.wall, p.roof);
      f.quad(g, 0.715, 0.29, 0.815, 0.41, dark, h + 9.1);
      arch(g, 0.7, 0.5, 0.13, 5, dark);
      arch(g, 0.2, 0.7, 0.2, 7, dark);
      if (!dead) {
        jars(g, p, 0.16, 0.87);
        jars(g, p, 0.58, 0.8);
      }
      break;
    case 1: // Timber: narrow shed, open drying rack and stacks.
      room(g, p, [0.08, 0.08, 0.92, 0.42], h);
      arch(g, 0.4, 0.42, 0.22, 7, dark);
      if (!dead)
        for (let k = 0; k < 4; k++)
          f.box(
            g,
            [0.12, 0.57 + k * 0.08, 0.67, 0.62 + k * 0.08],
            0,
            2 + (k % 2),
            p.accent,
            shade(p.roof, 0.8),
          );
      pergola(g, p, [0.1, 0.49, 0.85, 0.89], 0, dead);
      break;
    case 2: // Textile hall with roof vents and a drying cloth.
      room(g, p, [0.08, 0.08, 0.7, 0.74], h + 2);
      for (const u of [0.2, 0.45]) {
        room(g, p, [u, 0.22, u + 0.14, 0.43], 3, h + 2);
        f.quad(g, u + 0.035, 0.27, u + 0.105, 0.38, dark, h + 5.1);
      }
      arch(g, 0.24, 0.74, 0.28, 7, dark);
      canopy(g, theme, [0.74, 0.28, 0.94, 0.85], 8, p.accent, dead);
      break;
    case 3: // Mason's yard with irregular blocks in front of a tall store.
      room(g, p, [0.08, 0.08, 0.44, 0.88], h + 3);
      arch(g, 0.18, 0.88, 0.16, 7, dark);
      for (let k = 0; k < 3; k++)
        f.box(
          g,
          [0.54, 0.18 + k * 0.25, 0.88 - k * 0.04, 0.35 + k * 0.25],
          0,
          (dead ? 2 : 4) + k,
          shade(p.roof, 0.82),
          p.roof,
        );
      break;
  }
}
