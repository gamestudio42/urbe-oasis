import type { Graphics } from 'pixi.js';
import { color, shade, type Theme } from '@theme/core';
import type { Point } from './iso';

/** Cosmetic date palm. Wild trees do not supply the simulation's shade network. */
export function drawDesertPalm(g: Graphics, theme: Theme, base: Point, scale: number): void {
  const x = base.x;
  const y = base.y;
  const crown = y - 26 * scale;
  const trunk = color(theme, 'tree.trunk');
  g.ellipse(x + 7 * scale, y + 1, 13 * scale, 3 * scale).fill({ color: trunk, alpha: 0.14 });
  g.poly([x - 2 * scale, y, x + 1.5 * scale, y, x + 3 * scale, crown, x, crown]).fill(trunk);
  for (let k = 1; k < 5; k++) {
    const h = y - k * 5 * scale;
    g.moveTo(x, h)
      .lineTo(x + 2 * scale, h - scale)
      .stroke({ color: shade(trunk, 1.35), width: scale });
  }
  for (const [dx, dy, tint] of [
    [-17, 9, 'tree.leafDark'],
    [17, 10, 'tree.leafDark'],
    [-15, -3, 'tree.leafMid'],
    [15, -3, 'tree.leafMid'],
    [-7, -10, 'tree.leafLight'],
    [8, -10, 'tree.leafLight'],
  ] as const) {
    const endX = x + dx * scale;
    const endY = crown + dy * scale;
    g.poly([
      x + scale,
      crown,
      x + dx * scale * 0.6,
      crown + dy * scale * 0.3 - 4 * scale,
      endX,
      endY,
      x + dx * scale * 0.5,
      crown + dy * scale * 0.45,
    ]).fill(color(theme, tint));
  }
}

/** A spring landmark, not a water-network source or a change to terrain collision. */
export function drawSpringLandmark(g: Graphics, theme: Theme, occupied: boolean): void {
  const water = color(theme, 'overlay.waterOn');
  const rim = color(theme, 'ground.bareLot');
  if (!occupied) {
    g.ellipse(0, 1, 22, 10).fill(color(theme, 'tree.leafDark'));
    g.ellipse(0, 0, 18, 8).fill(shade(rim, 0.85));
    g.ellipse(0, -1, 14, 6).fill(shade(water, 0.8));
    g.ellipse(-2, -2, 9, 3).fill(water);
    g.moveTo(-8, -3)
      .lineTo(2, -3)
      .stroke({ color: shade(water, 1.5), width: 1.2 });
  }
  g.moveTo(0, -10).lineTo(0, -32).stroke({ color: rim, alpha: 0.85, width: 1.5 });
  g.circle(0, -39, 10)
    .fill(color(theme, 'ground.undergroundLand'))
    .stroke({ color: rim, width: 1.5 });
  g.poly([0, -46, 5, -38, 0, -33, -5, -38]).fill(water);
}
