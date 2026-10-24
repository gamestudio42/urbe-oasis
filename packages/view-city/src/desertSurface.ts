import { Infra, Terrain } from '@city/shared';
import type { World } from '@city/simulation';
import { color, shade, tileHash, type Theme } from '@theme/core';
import type { Graphics } from 'pixi.js';
import { tileLocalToScreen, type Point } from './iso';

/** Broad, continuous variation replaces independent tile tinting in the adobe landscape. */
export function desertTone(x: number, y: number): number {
  const gx = Math.floor(x / 7),
    gy = Math.floor(y / 7);
  const smooth = (v: number) => v * v * (3 - 2 * v);
  const u = smooth(x / 7 - gx),
    v = smooth(y / 7 - gy);
  const north = tileHash(gx, gy) * (1 - u) + tileHash(gx + 1, gy) * u;
  const south = tileHash(gx, gy + 1) * (1 - u) + tileHash(gx + 1, gy + 1) * u;
  return 0.965 + (north * (1 - v) + south * v) * 0.07;
}

/** Bounded cosmetic detail. Water margins follow real terrain; none of this supplies services. */
export function drawDesertSurface(
  g: Graphics,
  theme: Theme,
  world: World,
  x: number,
  y: number,
  q: [Point, Point, Point, Point],
): void {
  const i = world.index(x, y);
  if (
    theme.style !== 'adobe' ||
    world.isWater(i) ||
    world.zone[i] !== 0 ||
    world.buildingId[i] !== 0 ||
    (world.infra[i]! & (Infra.Road | Infra.Canal | Infra.Rubble)) !== 0
  )
    return;
  const at = (u: number, v: number) => tileLocalToScreen(q, u, v);
  const water = (tx: number, ty: number) =>
    world.inBounds(tx, ty) && world.isWater(world.index(tx, ty));
  const edges = [water(x, y - 1), water(x + 1, y), water(x, y + 1), water(x - 1, y)];
  const bank = color(theme, 'ground.bareLot');
  const leaf = color(theme, 'tree.leafDark');
  for (let side = 0; side < 4; side++) {
    if (!edges[side]) continue;
    const strip =
      side === 0
        ? [
            [0, 0],
            [1, 0],
            [0.88, 0.17],
            [0.2, 0.24],
          ]
        : side === 1
          ? [
              [1, 0],
              [1, 1],
              [0.79, 0.83],
              [0.86, 0.12],
            ]
          : side === 2
            ? [
                [1, 1],
                [0, 1],
                [0.16, 0.8],
                [0.84, 0.85],
              ]
            : [
                [0, 1],
                [0, 0],
                [0.19, 0.16],
                [0.23, 0.82],
              ];
    g.poly(
      strip.flatMap(([u, v]) => {
        const p = at(u!, v!);
        return [p.x, p.y];
      }),
    ).fill({ color: bank, alpha: 0.5 });
    const p = at(
      side === 1 ? 0.87 : side === 3 ? 0.13 : 0.42,
      side === 0 ? 0.13 : side === 2 ? 0.87 : 0.58,
    );
    g.ellipse(p.x, p.y, 5, 2).fill({ color: leaf, alpha: 0.5 });
    g.moveTo(p.x - 2, p.y)
      .lineTo(p.x - 3, p.y - 4)
      .moveTo(p.x + 1, p.y)
      .lineTo(p.x + 3, p.y - 5)
      .stroke({ color: leaf, width: 0.8, alpha: 0.7 });
  }
  const hash = tileHash(x + 73, y - 29);
  if (edges.some(Boolean) || world.trees[i]! > 0) return;
  if (hash < 0.16 && world.terrain[i] !== Terrain.Rock) {
    for (let k = 0; k < 2; k++) {
      const a = at(0.12, 0.28 + k * 0.24),
        b = at(0.47, 0.18 + k * 0.24),
        c = at(0.87, 0.32 + k * 0.24);
      g.moveTo(a.x, a.y)
        .quadraticCurveTo(b.x, b.y, c.x, c.y)
        .stroke({ color: shade(bank, 1.15), width: 0.75, alpha: 0.24 });
    }
  } else if (hash > 0.96) {
    const p = at(0.35 + (hash - 0.96) * 8, 0.56);
    g.ellipse(p.x + 1, p.y + 1, 3, 1).fill({ color: color(theme, 'ground.skirt'), alpha: 0.15 });
    g.poly([p.x - 2, p.y, p.x, p.y - 2, p.x + 3, p.y, p.x + 1, p.y + 1]).fill(shade(bank, 0.88));
  }
}
