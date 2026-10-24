import type { Graphics } from 'pixi.js';
import { color, shade, type Theme } from '@theme/core';
import { Frame, poly } from './isoFrame';
import { drawAdobeFire, drawAdobePump } from './oasisServiceSprites';

/**
 * Adobe civic and utility silhouettes for Urbe Oasis.
 *
 * `theme.style === 'adobe'` selects this file. The masses are low mud brick: a walled yard,
 * a kiln, clay jars, a sail. They do not reuse the classic watch tower or the neon glass bands.
 */

/** A vertical opening on the front face (constant v). */
function opening(
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

/** Police: a mud-brick compound, a solid tower and a cloth banner. No glass drum. */
function drawAdobePolice(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'police.wall');
  const roof = color(theme, 'police.roof');
  const door = color(theme, 'fire.door');
  const banner = color(theme, 'police.star');
  f.quad(g, 0.28, 0.28, 1.72, 1.72, shade(roof, 0.92), 0);
  f.box(g, [0.1, 0.1, 1.9, 0.28], 0, 11, wall, roof);
  f.box(g, [0.1, 0.1, 0.28, 1.9], 0, 11, wall, roof);
  f.box(g, [0.1, 1.72, 0.72, 1.9], 0, 11, wall, roof);
  f.box(g, [1.22, 1.72, 1.9, 1.9], 0, 11, wall, roof);
  f.box(g, [1.2, 0.16, 1.82, 0.78], 0, 22, wall, shade(roof, 0.85));
  opening(f, g, 0.82, 1.12, 1.9, 0, 8, door);
  f.post(g, 0.42, 0.5, 18, color(theme, 'school.pole'), 1.6);
  const cloth = f.p(0.42, 0.5, 16);
  g.rect(cloth.x, cloth.y, 8, 4).fill(banner);
}

/** School: three rooms around an open court and a small flag. */
function drawAdobeSchool(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'school.wall');
  const roof = color(theme, 'school.roof');
  const slit = color(theme, 'school.window');
  f.box(g, [0.1, 0.1, 1.9, 0.55], 0, 10, wall, roof);
  f.box(g, [0.1, 0.7, 0.7, 1.88], 0, 10, wall, roof);
  f.box(g, [1.2, 0.7, 1.9, 1.88], 0, 10, shade(wall, 0.92), roof);
  opening(f, g, 0.4, 0.7, 0.55, 4, 8, slit);
  opening(f, g, 0.7, 0.7, 1.15, 4, 8, slit);
  f.post(g, 0.95, 1.15, 16, color(theme, 'school.pole'), 1.5);
  const flag = f.p(0.95, 1.15, 14);
  g.rect(flag.x, flag.y, 7, 3.5).fill(color(theme, 'school.flag'));
}

/** Hospital: a long ward, a dome and a cloth cross. */
function drawAdobeHospital(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'hospital.wall');
  const roof = color(theme, 'hospital.roof');
  const cross = color(theme, 'hospital.cross');
  f.box(g, [0.1, 0.35, 1.9, 1.75], 0, 12, wall, roof);
  f.box(g, [0.62, 0.7, 1.38, 1.4], 12, 8, shade(wall, 1.06), shade(roof, 1.08));
  opening(f, g, 0.35, 0.62, 1.75, 0, 8, shade(wall, 0.6));
  const mark = f.p(1.15, 1.75, 8);
  g.rect(mark.x - 5, mark.y - 1.4, 10, 2.8).fill(cross);
  g.rect(mark.x - 1.4, mark.y - 5, 2.8, 10).fill(cross);
}

/** Coal: a brick kiln with one chimney and a glowing mouth. Not a steel power hall. */
function drawAdobeCoal(g: Graphics, theme: Theme, size: number): void {
  const f = new Frame(size);
  const wall = color(theme, 'coal.wall');
  const roof = color(theme, 'coal.roof');
  const glow = color(theme, 'coal.glow');
  const s = size;
  f.box(g, [0.2, 0.35, s - 0.25, s - 0.3], 0, 12, wall, roof);
  f.box(g, [s * 0.55, 0.45, s * 0.78, s * 0.62], 12, 8, shade(wall, 0.8), color(theme, 'coal.stack'));
  f.post(g, s * 0.66, s * 0.28, 16, color(theme, 'coal.stack'), 2.4, 20);
  opening(f, g, s * 0.3, s * 0.48, s - 0.3, 0, 7, glow);
  const mouth = f.p(s * 0.39, s - 0.3, 3);
  g.ellipse(mouth.x, mouth.y, 3, 1.6).fill({ color: glow, alpha: 0.85 });
}

/** Gas: two clay jars and a small flare. */
function drawAdobeGas(g: Graphics, theme: Theme, size: number): void {
  const f = new Frame(size);
  const body = color(theme, 'gas.tankBody');
  const top = color(theme, 'gas.tankTop');
  const s = size;
  f.box(g, [0.15, 0.25, s * 0.48, s - 0.25], 0, 14, body, top);
  f.box(g, [s * 0.52, 0.35, s - 0.15, s - 0.2], 0, 11, shade(body, 0.9), top);
  const a = f.p(s * 0.32, s * 0.45, 14);
  const b = f.p(s * 0.72, s * 0.55, 11);
  g.ellipse(a.x, a.y, 6, 2.4).fill(shade(top, 1.05));
  g.ellipse(b.x, b.y, 5, 2).fill(shade(top, 1.05));
  f.post(g, s * 0.2, s * 0.2, 12, color(theme, 'gas.flare'), 1.4, 14);
}

/** Wind: a timber mast and one lateen sail. Not a three-blade turbine. */
function drawAdobeWind(g: Graphics, theme: Theme): void {
  const f = new Frame(1);
  const mast = color(theme, 'wind.tower');
  const sail = color(theme, 'wind.blade');
  f.box(g, [0.32, 0.32, 0.68, 0.68], 0, 4, shade(mast, 0.85), mast);
  f.post(g, 0.5, 0.5, 26, mast, 2);
  poly(
    g,
    [f.p(0.5, 0.5, 24), f.p(0.5, 0.5, 8), f.p(0.88, 0.72, 14)],
    sail,
  );
  const hub = f.p(0.5, 0.5, 16);
  g.circle(hub.x, hub.y, 2.2).fill(color(theme, 'wind.hub'));
}

/** Well: a stone ring, a beam and a bucket. */
function drawAdobeWell(g: Graphics, theme: Theme): void {
  const f = new Frame(1);
  const stone = color(theme, 'well.wall');
  const wood = color(theme, 'well.pipe');
  f.box(g, [0.18, 0.22, 0.82, 0.78], 0, 6, stone, color(theme, 'well.roof'));
  f.box(g, [0.34, 0.36, 0.66, 0.64], 6, 2, shade(stone, 0.7), color(theme, 'well.glow'));
  f.post(g, 0.28, 0.3, 14, wood, 1.6);
  f.post(g, 0.72, 0.3, 14, wood, 1.6);
  const beam = f.p(0.28, 0.3, 14);
  const beamEnd = f.p(0.72, 0.3, 14);
  f.trim(g, beam, beamEnd, 2, wood, 1);
  g.rect(beam.x + 4, beam.y + 2, 4, 5).fill(color(theme, 'well.base'));
}

/** Dispatches an adobe civic building. Returns false for kinds this style does not own. */
export function drawAdobeCivic(g: Graphics, theme: Theme, kind: string): boolean {
  switch (kind) {
    case 'policeStation':
      drawAdobePolice(g, theme);
      return true;
    case 'fireStation':
      drawAdobeFire(g, theme);
      return true;
    case 'school':
      drawAdobeSchool(g, theme);
      return true;
    case 'hospital':
      drawAdobeHospital(g, theme);
      return true;
    default:
      return false;
  }
}

/** Dispatches an adobe utility building. */
export function drawAdobeUtility(g: Graphics, theme: Theme, kind: string, size: number): boolean {
  switch (kind) {
    case 'coalPlant':
      drawAdobeCoal(g, theme, size);
      return true;
    case 'gasPlant':
      drawAdobeGas(g, theme, size);
      return true;
    case 'windTurbine':
      drawAdobeWind(g, theme);
      return true;
    case 'waterPump':
      drawAdobePump(g, theme, size);
      return true;
    case 'well':
      drawAdobeWell(g, theme);
      return true;
    default:
      return false;
  }
}
