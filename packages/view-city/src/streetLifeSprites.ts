import type { Graphics } from 'pixi.js';
import { color, shade, type Theme } from '@theme/core';

const ROBES = ['walker.robeA', 'walker.robeB', 'walker.robeC', 'walker.robeD'] as const;

/** A person in a long robe, about 9 px tall at zoom 1; `frame` alternates the stride. */
export function drawWalker(g: Graphics, theme: Theme, robe: number, frame: number): void {
  const cloth = color(theme, ROBES[robe % ROBES.length] as (typeof ROBES)[number]);
  const skin = color(theme, 'walker.head');
  g.ellipse(0, 0, 2.6, 1).fill({ color: color(theme, 'ground.outline'), alpha: 0.18 });
  const stride = frame % 2 === 0 ? 0.8 : -0.8;
  g.moveTo(-0.6, -2.2)
    .lineTo(-0.6 + stride, 0)
    .stroke({ color: shade(cloth, 0.6), width: 0.9 });
  g.moveTo(0.6, -2.2)
    .lineTo(0.6 - stride, 0)
    .stroke({ color: shade(cloth, 0.6), width: 0.9 });
  g.poly([-1.1, -7, 1.1, -7, 1.7, -2, -1.7, -2]).fill(cloth);
  g.poly([0.2, -7, 1.1, -7, 1.7, -2, 0.6, -2]).fill(shade(cloth, 0.8));
  g.circle(0, -8.2, 1.25).fill(skin);
  g.poly([-1.3, -8.6, 1.3, -8.6, 1, -9.7, -1, -9.7]).fill(shade(cloth, 1.15));
}

/** A pack camel facing right, about 16 px long at zoom 1; mirror the sprite to face left. */
export function drawCamel(g: Graphics, theme: Theme, load: number, frame: number): void {
  const body = color(theme, 'camel.body');
  const dark = color(theme, 'camel.shade');
  const pack = color(theme, load % 2 === 0 ? 'camel.load' : 'camel.loadAlt');
  g.ellipse(0, 0, 8, 1.6).fill({ color: color(theme, 'ground.outline'), alpha: 0.18 });
  const swing = frame % 2 === 0 ? 1 : -1;
  for (const [x, phase] of [
    [-5, swing],
    [-3, -swing],
    [3, swing],
    [5, -swing],
  ] as const) {
    g.moveTo(x, -6)
      .lineTo(x + phase * 0.8, 0)
      .stroke({ color: dark, width: 1.1 });
  }
  g.ellipse(0, -7.5, 6.5, 2.8).fill(body);
  g.ellipse(-0.5, -10, 3.4, 2.2).fill(body);
  g.poly([5, -8.5, 6.5, -8.5, 8.6, -13.5, 7.2, -14]).fill(body);
  g.ellipse(8.8, -14, 2, 1.2).fill(body);
  g.circle(9.6, -14.4, 0.35).fill(dark);
  g.poly([-4.5, -9.5, 3.5, -9.5, 3, -6.2, -4, -6.2]).fill(pack);
  g.poly([-4.5, -9.5, 3.5, -9.5, 3.2, -8.2, -4.3, -8.2]).fill(shade(pack, 1.2));
  g.moveTo(-6.4, -8).lineTo(-7.6, -5.5).stroke({ color: dark, width: 0.8 });
}
