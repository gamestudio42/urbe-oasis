import type { Graphics } from 'pixi.js';
import { color, shade, type Theme } from '@theme/core';
import { TILE_H, TILE_W, type Point } from './iso';
import { Frame, poly } from './isoFrame';

/** Screen offset of a ground offset in grid units. */
function iso(gx: number, gy: number): Point {
  return { x: (gx - gy) * (TILE_W / 2), y: (gx + gy) * (TILE_H / 2) };
}

/**
 * Oasis placeables. Colours come from the theme; the shapes are adobe: an open canal,
 * a jar, a wall, a colonnade and a courtyard. The drone drawings stay so the arcade
 * animation still has a craft to fly. Cyber drawings below keep their own silhouettes.
 */

/** An open court with a water channel, steps down to it and a shaft house. */
export function drawAdobeQanat(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'qanat.wall');
  const roof = color(theme, 'qanat.roof');
  const water = color(theme, 'qanat.arc');
  f.quad(g, 0.12, 0.16, 1.88, 1.82, shade(roof, 1.12), 0);
  f.quad(g, 0.48, 0.4, 1.38, 1.72, shade(water, 0.7), 1);
  f.quad(g, 0.6, 0.5, 1.22, 1.6, water, 2);
  f.box(g, [0.1, 0.12, 1.9, 0.36], 0, 9, wall, roof);
  f.box(g, [0.1, 0.12, 0.34, 1.72], 0, 8, wall, roof);
  f.box(g, [1.6, 0.12, 1.9, 1.72], 0, 8, wall, roof);
  f.box(g, [1.18, 0.18, 1.72, 0.62], 0, 16, shade(wall, 1.06), shade(roof, 1.08));
  opening(f, g, 1.32, 1.5, 0.62, 4, 10, shade(wall, 0.45));
  for (let i = 0; i < 4; i++) {
    f.quad(g, 0.38, 0.82 + i * 0.14, 0.6, 0.94 + i * 0.14, shade(wall, 0.92), 6 - i * 1.3);
  }
}

/** A clay jar on a plinth. The belly is the store; there is no charge light. */
export function drawAdobeCistern(g: Graphics, theme: Theme): void {
  const f = new Frame(1);
  const wall = color(theme, 'cistern.wall');
  const roof = color(theme, 'cistern.roof');
  f.box(g, [0.22, 0.32, 0.78, 0.78], 0, 3, shade(wall, 0.8), roof);
  const belly = f.p(0.5, 0.56, 3);
  jar(g, belly.x, belly.y, 1.2, wall, roof);
}

/** A mud wall with buttresses, a green coping and a crenellated top. */
export function drawAdobeWindbreak(g: Graphics, theme: Theme): void {
  const f = new Frame(1);
  const wall = color(theme, 'windbreak.wall');
  const roof = color(theme, 'windbreak.roof');
  f.box(g, [0.1, 0.36, 0.9, 0.64], 0, 14, wall, roof);
  f.box(g, [0.1, 0.34, 0.9, 0.66], 14, 2, color(theme, 'windbreak.led'), shade(roof, 1.05));
  f.box(g, [0.12, 0.3, 0.28, 0.7], 0, 16, shade(wall, 0.85), roof);
  f.box(g, [0.72, 0.3, 0.88, 0.7], 0, 16, shade(wall, 0.85), roof);
  for (const u of [0.22, 0.5, 0.76]) f.post(g, u, 0.42, 5, wall, 1.7, 16);
  opening(f, g, 0.4, 0.58, 0.64, 0, 7, shade(wall, 0.45));
}

/** A covered walk: three piers, a lintel and two arches. */
export function drawAdobeArcade(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'arcade.tower');
  const roof = color(theme, 'arcade.deck');
  const dark = shade(wall, 0.45);
  f.box(g, [0.1, 0.32, 0.34, 0.78], 0, 16, wall, roof);
  f.box(g, [0.84, 0.32, 1.1, 0.78], 0, 16, wall, roof);
  f.box(g, [1.62, 0.32, 1.88, 0.78], 0, 16, wall, roof);
  f.box(g, [0.1, 0.38, 1.88, 0.68], 14, 4, shade(wall, 1.06), color(theme, 'arcade.pad'));
  arch(f, g, 0.34, 0.84, 0.78, 0, 11, dark);
  arch(f, g, 1.1, 1.62, 0.78, 0, 11, shade(dark, 0.9));
}

/** A caravanserai: courtyard walls, a gated gap and a corner tower. */
export function drawAdobeCaravanserai(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'caravanserai.wall');
  const roof = color(theme, 'caravanserai.roof');
  const door = color(theme, 'fire.door');
  f.quad(g, 0.35, 0.35, 1.6, 1.55, shade(roof, 0.82), 1);
  f.box(g, [0.1, 0.12, 1.88, 0.38], 0, 11, wall, roof);
  f.box(g, [0.1, 0.12, 0.36, 1.88], 0, 11, wall, roof);
  f.box(g, [0.1, 1.62, 0.7, 1.9], 0, 11, wall, roof);
  f.box(g, [1.2, 1.62, 1.9, 1.9], 0, 11, wall, roof);
  f.box(g, [1.45, 0.2, 1.88, 0.7], 0, 22, shade(wall, 1.04), shade(roof, 0.95));
  f.box(g, [1.55, 0.32, 1.78, 0.55], 22, 4, wall, roof);
  opening(f, g, 0.22, 0.38, 1.9, 3, 7, shade(wall, 0.48));
  opening(f, g, 1.38, 1.55, 1.9, 3, 7, shade(wall, 0.48));
  f.post(g, 0.72, 1.86, 13, shade(wall, 0.82), 1.8);
  f.post(g, 1.16, 1.86, 13, shade(wall, 0.82), 1.8);
  arch(f, g, 0.78, 1.12, 1.9, 0, 9, door);
  for (let i = 0; i < 3; i++) {
    f.quad(g, 0.85, 1.15 + i * 0.14, 1.05, 1.28 + i * 0.14, shade(wall, 0.88), 1 + i * 2);
  }
}

/** Stone ring around a shaft of water. The cyber drawing keeps the bar. */
export function drawSubstation(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'qanat.wall');
  const roof = color(theme, 'qanat.roof');
  const water = color(theme, 'qanat.arc');
  f.box(g, [0.15, 0.15, 1.85, 1.85], 0, 6, wall, roof);
  f.box(g, [0.55, 0.55, 1.45, 1.45], 0, 2, shade(wall, 0.45), water);
  f.trimAt(g, f.p(0.3, 0.3), f.p(1.7, 0.3), 7, 1.4, color(theme, 'qanat.busbar'), 0.8);
}

/** A clay jar on a low plinth. */
export function drawBattery(g: Graphics, theme: Theme): void {
  const f = new Frame(1);
  const wall = color(theme, 'cistern.wall');
  const roof = color(theme, 'cistern.roof');
  f.box(g, [0.22, 0.22, 0.78, 0.78], 0, 8, wall, shade(wall, 0.8));
  f.box(g, [0.32, 0.32, 0.68, 0.68], 8, 10, shade(wall, 1.05), roof);
  f.trimAt(g, f.p(0.32, 0.5), f.p(0.68, 0.5), 14, 1.2, color(theme, 'cistern.charge'), 0.9);
}

/** A short wall with posts, the windbreak. */
export function drawFirewall(g: Graphics, theme: Theme): void {
  const f = new Frame(1);
  const wall = color(theme, 'windbreak.wall');
  const roof = color(theme, 'windbreak.roof');
  f.box(g, [0.12, 0.38, 0.88, 0.62], 0, 14, wall, roof);
  f.post(g, 0.18, 0.4, 20, shade(wall, 0.7), 2);
  f.post(g, 0.82, 0.4, 20, shade(wall, 0.7), 2);
  f.trimAt(g, f.p(0.18, 0.4), f.p(0.82, 0.4), 18, 1.3, color(theme, 'windbreak.led'), 0.85);
}

/** A covered walk: two piers and a lintel. */
export function drawDronePort(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'arcade.tower');
  const roof = color(theme, 'arcade.deck');
  f.box(g, [0.12, 0.35, 0.38, 0.7], 0, 16, wall, roof);
  f.box(g, [1.62, 0.35, 1.88, 0.7], 0, 16, wall, roof);
  f.box(g, [0.12, 0.4, 1.88, 0.65], 14, 4, shade(wall, 1.1), color(theme, 'arcade.pad'));
  f.trimAt(g, f.p(0.2, 0.4), f.p(1.8, 0.4), 18, 1.4, color(theme, 'arcade.beacon'), 0.8);
}

/** A courtyard with a low gate. */
export function drawCorpHQ(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'caravanserai.wall');
  const roof = color(theme, 'caravanserai.roof');
  f.box(g, [0.08, 0.08, 1.92, 1.92], 0, 10, wall, roof, color(theme, 'caravanserai.window'));
  f.box(g, [0.7, 1.55, 1.3, 1.94], 0, 8, shade(wall, 0.7), color(theme, 'caravanserai.sign'));
  f.trimAt(g, f.p(0.15, 0.15), f.p(1.85, 0.15), 11, 1.5, color(theme, 'caravanserai.trim'), 0.85);
}

/** Spring house: a flat courtyard and a square tower. Palm: a tall trunk and a fan crown. */
export function drawOasisShade(g: Graphics, theme: Theme, kind: string): void {
  if (kind === 'palm') drawPalm(g, theme);
  else drawSpringHouse(g, theme);
}

function drawPalm(g: Graphics, theme: Theme): void {
  const f = new Frame(1);
  const trunk = color(theme, 'tree.trunk');
  const dark = color(theme, 'tree.leafDark');
  const mid = color(theme, 'tree.leafMid');
  const light = color(theme, 'tree.leafLight');
  f.post(g, 0.5, 0.62, 16, shade(trunk, 0.72), 3.4);
  f.post(g, 0.5, 0.58, 46, trunk, 2.2);
  const tip = f.p(0.5, 0.52, 48);
  const rays: readonly [number, number, number, number][] = [
    [-26, -6, dark, 7],
    [24, -8, dark, 7],
    [-8, -18, mid, 6],
    [10, -16, light, 6],
    [0, -20, light, 5],
    [-30, 6, mid, 6],
    [28, 4, mid, 6],
    [-16, 14, dark, 5],
    [18, 16, dark, 5],
    [0, 18, mid, 4],
  ];
  for (const [dx, dy, fill, width] of rays) {
    frond(g, tip, { x: tip.x + dx, y: tip.y + dy }, fill, width);
  }
}

function frond(g: Graphics, tip: Point, end: Point, fill: number, width: number): void {
  const dx = end.x - tip.x;
  const dy = end.y - tip.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * width;
  const py = (dx / len) * width;
  poly(g, [tip, { x: end.x + px, y: end.y + py }, { x: end.x - px * 0.25, y: end.y - py * 0.25 }], fill);
}

function jar(g: Graphics, cx: number, cy: number, scale: number, body: number, lid: number): void {
  g.ellipse(cx, cy, 6 * scale, 2.2 * scale).fill(shade(body, 0.72));
  g.ellipse(cx, cy - 6 * scale, 10 * scale, 6.5 * scale).fill(body);
  g.ellipse(cx, cy - 11 * scale, 5.5 * scale, 2.8 * scale).fill(shade(body, 1.08));
  g.ellipse(cx, cy - 14 * scale, 4.2 * scale, 1.8 * scale).fill(lid);
}

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

function drawSpringHouse(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = theme.housePalettes[0]?.wall ?? color(theme, 'qanat.wall');
  const roof = theme.housePalettes[0]?.roof ?? color(theme, 'qanat.roof');
  const water = color(theme, 'qanat.arc');
  f.quad(g, 0.2, 0.22, 1.75, 1.7, shade(roof, 0.88), 0);
  f.box(g, [0.12, 0.12, 1.72, 0.46], 0, 10, wall, roof);
  f.box(g, [0.12, 0.38, 0.46, 1.78], 0, 11, wall, roof);
  f.box(g, [0.4, 1.52, 0.95, 1.82], 0, 10, shade(wall, 0.96), roof);
  f.box(g, [1.28, 1.52, 1.82, 1.82], 0, 10, shade(wall, 0.96), roof);
  f.box(g, [1.22, 0.52, 1.78, 1.18], 0, 36, shade(wall, 1.04), shade(roof, 1.05));
  f.box(g, [1.34, 0.64, 1.64, 0.96], 36, 5, wall, shade(roof, 0.95));
  const basin = f.p(0.85, 0.95, 2);
  g.ellipse(basin.x, basin.y, 11, 4.5).fill(shade(water, 0.8));
  g.ellipse(basin.x, basin.y, 6, 2.4).fill(water);
  arch(f, g, 0.52, 0.82, 1.82, 0, 8, shade(wall, 0.48));
  opening(f, g, 1.36, 1.48, 1.18, 16, 26, water);
  opening(f, g, 1.56, 1.68, 1.18, 16, 26, shade(water, 0.85));
  for (let i = 0; i < 3; i++) {
    f.quad(g, 0.95, 1.15 + i * 0.1, 1.14, 1.24 + i * 0.1, shade(wall, 0.9), 1 + i * 2);
  }
}

// ---------------------------------------------------------------------------------------------
// Drones.

/** Body length of a drone in tiles, used to size its shadow and its hit area. */
export const DRONE_SIZE = 0.62;

/**
 * Flying drones are half the previous flight scale: small craft above the street, not the size
 * of the pad they leave.
 */
export const DRONE_FLIGHT_SCALE = 0.925;

/**
 * Quadcopter seen from above, centred on `origin` and lifted by `z` pixels. `spin` is the rotor
 * angle in radians; `glow` scales the thruster light, so a parked drone can be dimmer.
 */
export function drawDrone(
  g: Graphics,
  theme: Theme,
  origin: Point,
  spin: number,
  scale = 1,
  z = 0,
  glow = 1,
): void {
  const body = color(theme, 'arcade.droneBody');
  const trim = color(theme, 'arcade.droneTrim');
  const light = color(theme, 'arcade.droneGlow');
  const s = scale;
  const at = (a: number, c: number, lift = 0): Point => {
    const o = iso(a * s, c * s);
    return { x: origin.x + o.x, y: origin.y + o.y - z - lift };
  };
  const rotors = [
    [0.28, 0.28],
    [0.28, -0.28],
    [-0.28, 0.28],
    [-0.28, -0.28],
  ] as const;

  // Arms from the chassis to each rotor.
  for (const [ax, ay] of [
    [1, 1],
    [1, -1],
  ] as const) {
    const a = at(-0.26 * ax, -0.26 * ay);
    const b = at(0.26 * ax, 0.26 * ay);
    g.moveTo(a.x, a.y)
      .lineTo(b.x, b.y)
      .stroke({ width: 2.2 * s, color: trim });
  }
  // Rotor discs with a hint of spin.
  for (const [rx, ry] of rotors) {
    const c = at(rx, ry, 2);
    const rx2 = 7 * s;
    const ry2 = 3.4 * s;
    g.ellipse(c.x, c.y, rx2, ry2).fill({ color: trim, alpha: 0.55 });
    const ca = Math.cos(spin) * rx2;
    const sa = Math.sin(spin) * ry2;
    g.moveTo(c.x - ca, c.y - sa)
      .lineTo(c.x + ca, c.y + sa)
      .stroke({ width: 1, color: shade(trim, 1.5), alpha: 0.5 });
  }
  // Chassis and canopy.
  poly(g, [at(0.22, 0), at(0, 0.13), at(-0.22, 0), at(0, -0.13)], trim);
  poly(g, [at(0.15, 0, 2.5), at(0, 0.09, 2.5), at(-0.15, 0, 2.5), at(0, -0.09, 2.5)], body);
  // Sensor eye and thruster lights.
  const eye = at(0.16, 0, 3);
  g.circle(eye.x, eye.y, 1.6 * s).fill(light);
  for (const [lx, ly] of rotors) {
    const c = at(lx, ly, 1.5);
    g.circle(c.x, c.y, 2.4 * s).fill({ color: light, alpha: 0.28 * glow });
    g.circle(c.x, c.y, 1.1 * s).fill({ color: light, alpha: 0.95 });
  }
}

/** Flat silhouette of a drone, for its shadow on the street. */
export function drawDroneShadow(g: Graphics, theme: Theme, origin: Point, scale = 1): void {
  const shadow = color(theme, 'plane.shadow');
  const s = scale;
  for (const [rx, ry] of [
    [0.24, 0.24],
    [0.24, -0.24],
    [-0.24, 0.24],
    [-0.24, -0.24],
  ] as const) {
    const c = iso(rx * s, ry * s);
    g.ellipse(origin.x + c.x, origin.y + c.y, 7 * s, 3.4 * s).fill({
      color: shadow,
      alpha: 0.5,
    });
  }
  g.ellipse(origin.x, origin.y, 6 * s, 3 * s).fill({ color: shadow, alpha: 0.6 });
}
