import type { Graphics } from 'pixi.js';
import { color, shade, type Theme } from '@theme/core';
import { TILE_H, TILE_W, type Point } from './iso';
import { Frame, poly } from './isoFrame';

/** Screen offset of a ground offset in grid units. */
function iso(gx: number, gy: number): Point {
  return { x: (gx - gy) * (TILE_W / 2), y: (gx + gy) * (TILE_H / 2) };
}

/**
 * Oasis placeables. Colours come from the theme; the shapes are adobe: a shaft, a jar,
 * a wall, a colonnade and a courtyard. The drone drawings stay so the arcade animation
 * still has a craft to fly.
 */

/** Stone ring around a shaft of water. */
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

/** Spring house: a low hall and a dome. Palm: a trunk and a crown. */
export function drawOasisShade(g: Graphics, theme: Theme, kind: string): void {
  if (kind === 'palm') drawPalm(g, theme);
  else drawSpringHouse(g, theme);
}

function drawSpringHouse(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'qanat.wall');
  const roof = color(theme, 'qanat.roof');
  const water = color(theme, 'qanat.arc');
  f.box(g, [0.1, 0.2, 1.9, 1.75], 0, 12, wall, roof, color(theme, 'caravanserai.window'));
  f.box(g, [0.6, 0.55, 1.4, 1.35], 12, 8, shade(wall, 1.08), water);
}

function drawPalm(g: Graphics, theme: Theme): void {
  const f = new Frame(1);
  const trunk = color(theme, 'tree.trunk');
  const crown = color(theme, 'tree.leafMid');
  f.post(g, 0.5, 0.55, 16, trunk, 2.4);
  f.box(g, [0.22, 0.22, 0.78, 0.78], 14, 6, crown, shade(crown, 1.15));
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
