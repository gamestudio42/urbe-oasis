import type { Graphics } from 'pixi.js';
import { color, shade, type Theme } from '@theme/core';
import { Frame, poly } from './isoFrame';
import { drawAdobeFire, drawAdobePump } from './oasisServiceSprites';

/**
 * Adobe civic and utility silhouettes for Urbe Oasis.
 *
 * Flat roofs, parapets, stairs and a few dark arches. `theme.style === 'adobe'` selects this
 * file. The masses stay mud brick: a yard, a kiln, clay jars, a sail, a round well. No glass
 * grid and no glowing strip.
 */

/** Lip on the two visible eaves. */
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

/** A run of steps between flat roofs. */
function steps(
  f: Frame,
  g: Graphics,
  u: number,
  v: number,
  z: number,
  fill: number,
  count = 4,
): void {
  for (let i = 0; i < count; i++) {
    f.quad(g, u, v + i * 0.1, u + 0.16, v + 0.1 + i * 0.1, shade(fill, 0.88), z + i * 2.2);
  }
}

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

/** A dark arch on the front face. The crown is a single extra point, not a curve. */
function arch(
  f: Frame,
  g: Graphics,
  u0: number,
  u1: number,
  v: number,
  z0: number,
  z1: number,
  fill: number,
): void {
  const mid = (u0 + u1) / 2;
  const rise = (z1 - z0) * 0.28;
  poly(
    g,
    [f.p(u0, v, z0), f.p(u1, v, z0), f.p(u1, v, z1 - rise), f.p(mid, v, z1), f.p(u0, v, z1 - rise)],
    fill,
  );
}

/** Two rails and four rungs, the ladder seen on the yard walls. */
function ladder(
  f: Frame,
  g: Graphics,
  u: number,
  v: number,
  z0: number,
  height: number,
  wood: number,
): void {
  f.post(g, u, v, height, wood, 1.3, z0);
  f.post(g, u + 0.07, v + 0.02, height, wood, 1.3, z0);
  const a = f.p(u, v, 0);
  const b = f.p(u + 0.07, v + 0.02, 0);
  for (let i = 1; i <= 4; i++) {
    const y = z0 + (height * i) / 5;
    g.moveTo(a.x, a.y - y)
      .lineTo(b.x, b.y - y)
      .stroke({ width: 1.1, color: wood });
  }
}

/** Clay jar in screen space, so the belly reads as round rather than as another box. */
function jar(g: Graphics, cx: number, cy: number, scale: number, body: number, lid: number): void {
  g.ellipse(cx, cy, 6 * scale, 2.2 * scale).fill(shade(body, 0.72));
  g.ellipse(cx, cy - 6 * scale, 10 * scale, 6.5 * scale).fill(body);
  g.ellipse(cx, cy - 11 * scale, 5.5 * scale, 2.8 * scale).fill(shade(body, 1.08));
  g.ellipse(cx, cy - 14 * scale, 4.2 * scale, 1.8 * scale).fill(lid);
}

/** Police: a walled yard, a square tower and a stair. No banner pole. */
function drawAdobePolice(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'police.wall');
  const roof = color(theme, 'police.roof');
  const door = color(theme, 'fire.door');
  f.quad(g, 0.32, 0.32, 1.68, 1.65, shade(roof, 0.86), 1);
  f.box(g, [0.1, 0.1, 1.9, 0.32], 0, 11, wall, roof);
  parapet(f, g, 0.1, 0.1, 1.9, 0.32, 11, wall);
  f.box(g, [0.1, 0.1, 0.32, 1.9], 0, 11, wall, roof);
  f.box(g, [0.1, 1.68, 0.78, 1.9], 0, 11, wall, roof);
  f.box(g, [1.18, 1.68, 1.9, 1.9], 0, 11, wall, roof);
  f.box(g, [1.15, 0.16, 1.82, 0.78], 0, 22, wall, shade(roof, 0.9));
  f.box(g, [1.32, 0.28, 1.62, 0.55], 22, 5, shade(wall, 1.04), roof);
  arch(f, g, 0.82, 1.12, 1.9, 0, 9, door);
  opening(f, g, 1.32, 1.46, 0.78, 10, 16, shade(door, 0.7));
  opening(f, g, 0.4, 0.55, 0.32, 4, 8, shade(door, 0.75));
  steps(f, g, 0.55, 0.45, 0, shade(wall, 0.82), 4);
  ladder(f, g, 1.55, 0.72, 0, 18, color(theme, 'pole.post'));
}

/** School: three rooms around a court, with the door on the street and a stair inside. */
function drawAdobeSchool(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'school.wall');
  const roof = color(theme, 'school.roof');
  const slit = shade(color(theme, 'school.window'), 0.45);
  f.quad(g, 0.55, 0.55, 1.35, 1.35, shade(roof, 0.84), 1);
  f.box(g, [0.1, 0.1, 1.9, 0.5], 0, 10, wall, roof);
  parapet(f, g, 0.1, 0.1, 1.9, 0.5, 10, wall);
  f.box(g, [0.1, 0.45, 0.55, 1.88], 0, 11, wall, roof);
  f.box(g, [1.4, 0.45, 1.9, 1.88], 0, 10, shade(wall, 0.94), roof);
  arch(f, g, 0.16, 0.42, 1.88, 0, 8, shade(wall, 0.48));
  opening(f, g, 1.52, 1.66, 1.88, 4, 8, slit);
  opening(f, g, 0.7, 0.86, 0.5, 3, 7, slit);
  steps(f, g, 0.85, 0.7, 0, shade(wall, 0.82), 4);
  f.box(g, [0.18, 0.16, 0.42, 0.38], 10, 5, shade(wall, 1.04), roof);
  ladder(f, g, 1.55, 0.42, 0, 14, color(theme, 'school.pole'));
}

/** Hospital: a ward, a lower annex, a roof room and a cross painted on the wall. */
function drawAdobeHospital(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'hospital.wall');
  const roof = color(theme, 'hospital.roof');
  const cross = color(theme, 'hospital.cross');
  f.box(g, [0.1, 0.22, 1.32, 1.72], 0, 12, wall, roof);
  parapet(f, g, 0.1, 0.22, 1.32, 1.72, 12, wall);
  f.box(g, [1.22, 0.55, 1.9, 1.55], 0, 8, shade(wall, 0.94), roof);
  parapet(f, g, 1.22, 0.55, 1.9, 1.55, 8, wall);
  f.box(g, [0.28, 0.32, 0.68, 0.68], 12, 6, shade(wall, 1.05), shade(roof, 1.06));
  arch(f, g, 0.32, 0.62, 1.72, 0, 8, shade(wall, 0.48));
  opening(f, g, 0.9, 1.02, 1.72, 3, 10, cross);
  opening(f, g, 0.78, 1.14, 1.72, 5.4, 7.4, cross);
  ladder(f, g, 1.55, 1.42, 0, 12, color(theme, 'pole.post'));
}

/** Coal: a brick kiln with one chimney and a glowing mouth. Not a steel power hall. */
function drawAdobeCoal(g: Graphics, theme: Theme, size: number): void {
  const f = new Frame(size);
  const wall = color(theme, 'coal.wall');
  const roof = color(theme, 'coal.roof');
  const glow = color(theme, 'coal.glow');
  const s = size;
  f.box(g, [0.2, 0.35, s - 0.25, s - 0.3], 0, 12, wall, roof);
  parapet(f, g, 0.2, 0.35, s - 0.25, s - 0.3, 12, wall);
  f.box(g, [s * 0.52, 0.42, s * 0.82, s * 0.7], 12, 7, shade(wall, 0.82), color(theme, 'coal.stack'));
  f.post(g, s * 0.66, s * 0.28, 22, color(theme, 'coal.stack'), 2.6, 19);
  arch(f, g, s * 0.32, s * 0.55, s - 0.3, 0, 8, glow);
  steps(f, g, s * 0.62, s * 0.78, 0, shade(wall, 0.75), 4);
  ladder(f, g, s * 0.84, s * 0.55, 0, 16, color(theme, 'pole.post'));
}

/** Gas: two clay jars on a pad, and a small flare. */
function drawAdobeGas(g: Graphics, theme: Theme, size: number): void {
  const f = new Frame(size);
  const body = color(theme, 'gas.tankBody');
  const top = color(theme, 'gas.tankTop');
  const s = size;
  f.box(g, [0.14, 0.22, s - 0.14, s - 0.16], 0, 3, shade(body, 0.78), top);
  const left = f.p(s * 0.38, s * 0.58, 3);
  const right = f.p(s * 0.68, s * 0.42, 3);
  jar(g, left.x, left.y, 1.15, body, top);
  jar(g, right.x, right.y, 0.82, shade(body, 0.92), top);
  f.post(g, s * 0.2, s * 0.28, 12, color(theme, 'gas.tankRim'), 1.5);
  const flame = f.p(s * 0.2, s * 0.28, 14);
  g.ellipse(flame.x, flame.y - 3, 2.4, 4).fill(color(theme, 'gas.flare'));
}

/** Wind: a timber mast and one lateen sail. Not a three-blade turbine. */
function drawAdobeWind(g: Graphics, theme: Theme): void {
  const f = new Frame(1);
  const mast = color(theme, 'wind.tower');
  const sail = color(theme, 'wind.blade');
  f.box(g, [0.28, 0.32, 0.72, 0.72], 0, 5, shade(mast, 0.7), color(theme, 'wind.hub'));
  f.post(g, 0.5, 0.52, 36, mast, 2.2);
  poly(g, [f.p(0.5, 0.5, 34), f.p(0.5, 0.5, 12), f.p(0.94, 0.16, 22)], sail);
  poly(g, [f.p(0.5, 0.5, 30), f.p(0.5, 0.5, 16), f.p(0.18, 0.22, 20)], shade(sail, 0.86));
  const hub = f.p(0.5, 0.5, 22);
  g.circle(hub.x, hub.y, 2.4).fill(color(theme, 'wind.hub'));
}

/** Well: a round stone ring, two posts, a beam and a bucket. */
function drawAdobeWell(g: Graphics, theme: Theme): void {
  const f = new Frame(1);
  const stone = color(theme, 'well.wall');
  const wood = color(theme, 'well.pipe');
  const water = color(theme, 'well.glow');
  f.quad(g, 0.16, 0.28, 0.84, 0.82, shade(stone, 0.78), 0);
  const ring = f.p(0.5, 0.58, 3);
  g.ellipse(ring.x, ring.y, 14, 6).fill(shade(stone, 0.92));
  g.ellipse(ring.x, ring.y, 9, 3.6).fill(shade(stone, 0.55));
  g.ellipse(ring.x, ring.y, 6, 2.2).fill(water);
  f.post(g, 0.3, 0.4, 16, wood, 1.8);
  f.post(g, 0.7, 0.4, 16, wood, 1.8);
  f.box(g, [0.26, 0.34, 0.74, 0.46], 14, 2, wood, shade(wood, 1.12));
  const beam = f.p(0.5, 0.4, 15);
  g.rect(beam.x - 0.6, beam.y, 1.2, 8).fill(shade(wood, 0.75));
  g.rect(beam.x - 2.2, beam.y + 7, 4.4, 3.5).fill(color(theme, 'well.base'));
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
