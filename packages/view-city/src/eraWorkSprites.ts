import type { Graphics } from 'pixi.js';
import { color, shade, type Theme } from '@theme/core';
import type { Point } from './iso';
import { Frame, poly } from './isoFrame';

/**
 * Oasis era works, all 3×3: a stepped recharge basin, a domed bazaar hall and a four-part palace
 * garden. The 1×1 caravan stop shares their materials. Every style draws the same silhouettes; the theme supplies the materials.
 */
export function drawEraWork(g: Graphics, theme: Theme, kind: string): boolean {
  if (kind === 'rechargeBasin') drawRechargeBasin(g, theme);
  else if (kind === 'grandBazaar') drawGrandBazaar(g, theme);
  else if (kind === 'palaceGarden') drawPalaceGarden(g, theme);
  else if (kind === 'caravanStop') drawCaravanStop(g, theme);
  else return false;
  return true;
}

/** A stepped pool sunk into a paved court, with a domed pump kiosk in the back corner. */
function drawRechargeBasin(g: Graphics, theme: Theme): void {
  const f = new Frame(3);
  const stone = color(theme, 'works.stone');
  const roof = color(theme, 'works.roof');
  const water = color(theme, 'qanat.arc');
  f.quad(g, 0.12, 0.12, 2.88, 2.88, shade(roof, 1.04), 0);
  // Terraces step down to the water.
  f.quad(g, 0.42, 0.42, 2.58, 2.58, shade(stone, 0.9), -1);
  f.quad(g, 0.72, 0.72, 2.28, 2.28, shade(stone, 0.76), -2);
  f.quad(g, 1.0, 1.0, 2.0, 2.0, shade(water, 0.8), -3);
  f.quad(g, 1.15, 1.15, 1.85, 1.85, water, -3);
  f.box(g, [0.1, 0.1, 2.9, 0.32], 0, 6, stone, roof);
  f.box(g, [0.1, 0.1, 0.32, 2.9], 0, 6, stone, roof);
  f.trimAt(g, f.p(0.32, 0.32), f.p(2.9, 0.32), 4, 1.4, color(theme, 'works.tile'), 0.9);
  f.box(g, [2.1, 0.18, 2.82, 0.9], 0, 15, stone, roof);
  dome(g, f.p(2.46, 0.54, 15), 11, color(theme, 'works.dome'));
  f.box(g, [0.1, 2.72, 2.9, 2.9], 0, 3, shade(stone, 0.95), roof);
  f.box(g, [2.72, 0.9, 2.9, 2.72], 0, 3, shade(stone, 0.95), roof);
}

/** A long market hall under three domes, arched bays and a striped awning on the street side. */
function drawGrandBazaar(g: Graphics, theme: Theme): void {
  const f = new Frame(3);
  const stone = color(theme, 'works.stone');
  const roof = color(theme, 'works.roof');
  const cloth = color(theme, 'works.cloth');
  const dark = shade(stone, 0.45);
  f.quad(g, 0.1, 0.1, 2.9, 2.9, shade(roof, 0.9), 0);
  f.box(g, [0.2, 0.25, 2.8, 2.35], 0, 18, stone, roof);
  for (let i = 0; i < 4; i++) {
    const u0 = 0.36 + i * 0.62;
    arch(f, g, u0, u0 + 0.42, 2.35, 0, 12, dark);
  }
  for (let i = 0; i < 3; i++) {
    const v0 = 0.45 + i * 0.62;
    arch(f, g, v0, v0 + 0.4, 2.8, 0, 11, shade(dark, 0.9), true);
  }
  for (const u of [0.8, 1.5, 2.2]) dome(g, f.p(u, 1.3, 18), 13, color(theme, 'works.dome'));
  f.post(g, 2.55, 0.5, 34, shade(stone, 0.9), 3);
  // Awning: alternating stripes over the front bays.
  for (let i = 0; i < 8; i++) {
    const u0 = 0.2 + i * 0.325;
    const u1 = u0 + 0.325;
    const fill = i % 2 === 0 ? cloth : shade(roof, 1.08);
    poly(g, [f.p(u0, 2.35, 13), f.p(u1, 2.35, 13), f.p(u1, 2.72, 8), f.p(u0, 2.72, 8)], fill);
  }
}

/** A walled four-part garden: crossed water channels, a tiled pool, a pavilion and cypresses. */
function drawPalaceGarden(g: Graphics, theme: Theme): void {
  const f = new Frame(3);
  const stone = color(theme, 'works.stone');
  const roof = color(theme, 'works.roof');
  const water = color(theme, 'qanat.arc');
  const tile = color(theme, 'works.tile');
  const dark = color(theme, 'tree.leafDark');
  const mid = color(theme, 'tree.leafMid');
  f.quad(g, 0.08, 0.08, 2.92, 2.92, shade(roof, 0.95), 0);
  for (const [u0, v0] of [
    [0.25, 0.25],
    [1.62, 0.25],
    [0.25, 1.62],
    [1.62, 1.62],
  ] as const) {
    f.quad(g, u0, v0, u0 + 1.13, v0 + 1.13, mid, 0.5);
  }
  f.quad(g, 1.4, 0.2, 1.6, 2.8, water, 0.8);
  f.quad(g, 0.2, 1.4, 2.8, 1.6, water, 0.8);
  f.quad(g, 1.22, 1.22, 1.78, 1.78, tile, 1);
  f.quad(g, 1.32, 1.32, 1.68, 1.68, shade(water, 1.12), 1.2);
  f.box(g, [0.05, 0.05, 2.95, 0.2], 0, 7, stone, roof);
  f.box(g, [0.05, 0.05, 0.2, 2.95], 0, 7, stone, roof);
  f.box(g, [0.3, 0.3, 1.0, 1.0], 0, 14, stone, roof);
  dome(g, f.p(0.65, 0.65, 14), 11, color(theme, 'works.dome'));
  for (const [u, v] of [
    [1.25, 0.45],
    [2.6, 0.45],
    [0.45, 2.55],
    [2.6, 2.55],
    [2.0, 1.2],
    [1.2, 2.0],
  ] as const) {
    cypress(g, f.post(g, u, v, 5, shade(dark, 0.6), 2), dark);
  }
  f.box(g, [0.05, 2.8, 2.95, 2.95], 0, 3, shade(stone, 0.95), roof);
  f.box(g, [2.8, 0.2, 2.95, 2.8], 0, 3, shade(stone, 0.95), roof);
}

/** A caravan stop: a striped canopy on four posts over a bench, and a water jar. */
function drawCaravanStop(g: Graphics, theme: Theme): void {
  const f = new Frame(1);
  const stone = color(theme, 'works.stone');
  const roof = color(theme, 'works.roof');
  const cloth = color(theme, 'works.cloth');
  f.quad(g, 0.1, 0.1, 0.9, 0.9, shade(roof, 0.92), 0);
  f.box(g, [0.22, 0.3, 0.78, 0.46], 0, 4, stone, roof);
  for (const [u, v] of [
    [0.15, 0.15],
    [0.85, 0.15],
    [0.15, 0.85],
    [0.85, 0.85],
  ] as const) {
    f.post(g, u, v, 18, shade(stone, 0.7), 1.6);
  }
  for (let i = 0; i < 4; i++) {
    const u0 = 0.1 + i * 0.2;
    const fill = i % 2 === 0 ? cloth : shade(roof, 1.08);
    poly(
      g,
      [f.p(u0, 0.1, 19), f.p(u0 + 0.2, 0.1, 19), f.p(u0 + 0.2, 0.9, 17), f.p(u0, 0.9, 17)],
      fill,
    );
  }
  const jar = f.p(0.68, 0.7, 0);
  g.ellipse(jar.x, jar.y - 4, 3.2, 4).fill(shade(color(theme, 'cistern.wall'), 1));
}

/** A half dome seated on `base`, with a lit crown. */
function dome(g: Graphics, base: Point, r: number, fill: number): void {
  g.ellipse(base.x, base.y, r, r * 0.45).fill(shade(fill, 0.7));
  const half: Point[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (Math.PI * i) / 12;
    half.push({ x: base.x + Math.cos(a) * r, y: base.y + Math.sin(a) * r });
  }
  poly(g, half, fill);
  g.ellipse(base.x - r * 0.3, base.y - r * 0.55, r * 0.28, r * 0.18).fill(shade(fill, 1.3));
  g.rect(base.x - 0.8, base.y - r - 4, 1.6, 4).fill(shade(fill, 0.6));
}

function cypress(g: Graphics, tip: Point, fill: number): void {
  g.ellipse(tip.x, tip.y - 9, 3.6, 10).fill(fill);
  g.ellipse(tip.x - 1, tip.y - 11, 1.6, 6).fill(shade(fill, 1.25));
}

/** An arched opening on the front face (`v`), or on the side face at `u` when `side`. */
function arch(
  f: Frame,
  g: Graphics,
  a0: number,
  a1: number,
  at: number,
  z0: number,
  z1: number,
  fill: number,
  side = false,
): void {
  const p = (t: number, z: number) => (side ? f.p(at, t, z) : f.p(t, at, z));
  const mid = (a0 + a1) / 2;
  const rise = (z1 - z0) * 0.28;
  poly(g, [p(a0, z0), p(a1, z0), p(a1, z1 - rise), p(mid, z1), p(a0, z1 - rise)], fill);
}
