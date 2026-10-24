import type { Graphics } from 'pixi.js';
import { color, shade, type Theme } from '@theme/core';
import { Frame, poly, type Rect } from './isoFrame';
import type { Point } from './iso';

/** Service landmarks share the city's adobe materials, with equipment sized for map reading. */
function line(g: Graphics, a: Point, b: Point, fill: number, width = 1): void {
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: fill, width });
}

/** A face on the street side of a building, following the isometric plane. */
function front(
  g: Graphics,
  f: Frame,
  u0: number,
  u1: number,
  v: number,
  z0: number,
  z1: number,
  fill: number,
): void {
  poly(g, [f.p(u0, v, z0), f.p(u1, v, z0), f.p(u1, v, z1), f.p(u0, v, z1)], fill);
}

function roof(g: Graphics, f: Frame, r: Rect, z: number, wall: number, top: number): void {
  const [u0, v0, u1, v1] = r;
  f.box(g, [u0, v0, u1, v0 + 0.055], z, 2.2, wall, top);
  f.box(g, [u0, v0, u0 + 0.055, v1], z, 2.2, wall, top);
  f.box(g, [u0, v1 - 0.055, u1, v1], z, 2.2, wall, top);
  f.box(g, [u1 - 0.055, v0, u1, v1], z, 2.2, wall, top);
}

function apron(g: Graphics, f: Frame, theme: Theme): void {
  const paving = color(theme, 'ground.bareLot');
  f.quad(g, 0.07, 0.08, 1.93, 1.94, shade(paving, 0.9), 0.25);
  f.quad(g, 0.1, 1.26, 1.9, 1.94, paving, 0.5);
  for (const u of [0.48, 0.96, 1.44])
    line(g, f.p(u, 1.28, 0.6), f.p(u, 1.93, 0.6), shade(paving, 0.84), 0.6);
  line(g, f.p(0.1, 1.66, 0.6), f.p(1.9, 1.66, 0.6), shade(paving, 0.84), 0.6);
}

/** Two recessed engine bays, a lookout/drying tower and a hose-service apron. */
export function drawAdobeFire(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'fire.wall');
  const top = color(theme, 'fire.roof');
  const dark = shade(color(theme, 'fire.door'), 0.64);
  const wood = color(theme, 'fire.ladder');
  const stone = color(theme, 'ground.bareLot');
  const red = color(theme, 'vehicle.fireBody');
  apron(g, f, theme);

  // Contact shade and buttressed masonry give the large shed a grounded edge.
  f.quad(g, 0.12, 0.24, 1.94, 1.42, shade(stone, 0.67), 0.7);
  f.box(g, [0.15, 0.22, 1.86, 1.28], 0.8, 17, wall, top);
  roof(g, f, [0.15, 0.22, 1.86, 1.28], 17.8, wall, stone);
  front(g, f, 0.2, 1.81, 1.282, 13.5, 15.3, red);

  for (const [u0, u1] of [
    [0.3, 0.88],
    [1.04, 1.62],
  ]) {
    front(g, f, u0! - 0.045, u1! + 0.045, 1.29, 0.8, 13.1, stone);
    front(g, f, u0!, u1!, 1.3, 0.8, 11.9, dark);
    front(g, f, u0! + 0.05, u1! - 0.04, 1.305, 0.8, 9.9, shade(dark, 1.22));
    // Raised timber door and a pale threshold keep each bay readable at native scale.
    front(g, f, u0!, u1!, 1.31, 9.9, 11.9, wood);
    line(g, f.p(u0!, 1.315, 10.9), f.p(u1!, 1.315, 10.9), shade(wood, 1.4), 0.6);
    f.quad(g, u0!, 1.3, u1!, 1.42, shade(stone, 1.04), 0.9);
    for (const u of [u0! + 0.12, u1! - 0.12])
      line(g, f.p(u, 1.44, 0.8), f.p(u, 1.91, 0.8), shade(stone, 0.77), 1.1);
  }
  for (const u of [0.17, 0.93, 1.77])
    f.box(g, [u, 1.27, u + 0.09, 1.39], 0.7, 13, shade(wall, 1.08), stone);

  // The tower is part of the roof mass, not a floating sign above it.
  f.box(g, [0.24, 0.27, 0.78, 0.82], 17.8, 17, shade(wall, 1.08), top);
  front(g, f, 0.32, 0.47, 0.825, 25, 31.8, dark);
  front(g, f, 0.55, 0.7, 0.825, 25, 31.8, dark);
  poly(
    g,
    [f.p(0.785, 0.4, 25), f.p(0.785, 0.64, 25), f.p(0.785, 0.64, 31.8), f.p(0.785, 0.4, 31.8)],
    dark,
  );
  f.box(g, [0.19, 0.22, 0.83, 0.87], 34.8, 2.2, stone, shade(stone, 1.05));
  front(g, f, 0.32, 0.7, 0.88, 35.3, 36.4, red);
  // A bell under the lookout and a restrained service badge on the fascia.
  const bell = f.p(0.4, 0.84, 27.7);
  poly(
    g,
    [
      { x: bell.x - 1.5, y: bell.y },
      { x: bell.x + 1.5, y: bell.y },
      { x: bell.x + 2, y: bell.y + 3 },
      { x: bell.x - 2, y: bell.y + 3 },
    ],
    top,
  );
  const badge = f.p(1.33, 1.295, 16.6);
  poly(
    g,
    [
      { x: badge.x, y: badge.y - 2 },
      { x: badge.x + 1.7, y: badge.y + 0.5 },
      { x: badge.x, y: badge.y + 2.2 },
      { x: badge.x - 1.7, y: badge.y + 0.5 },
    ],
    stone,
  );

  // Flat-roof crew access, timber ladder and rolled hose on a low maintenance rack.
  f.box(g, [1.12, 0.36, 1.64, 0.82], 17.8, 4, shade(wall, 0.95), shade(top, 1.08));
  for (const u of [1.68, 1.78]) line(g, f.p(u, 1.13, 2), f.p(u, 1.13, 21.5), wood, 1.3);
  for (let z = 4; z < 21; z += 3) line(g, f.p(1.68, 1.13, z), f.p(1.78, 1.13, z), wood, 1);
  f.box(g, [1.54, 1.57, 1.83, 1.82], 0.8, 3, wood, shade(wood, 1.25));
  const reel = f.p(1.68, 1.71, 6.1);
  g.ellipse(reel.x, reel.y, 5.6, 3.2).stroke({ color: stone, width: 1.8 });
  g.ellipse(reel.x, reel.y, 3.3, 1.7).stroke({ color: shade(stone, 0.72), width: 1 });
  line(g, { x: reel.x + 5.2, y: reel.y }, f.p(1.87, 1.86, 1), stone, 1.4);
  // Sandstone water barrel for equipment washing; cosmetic, not a water source.
  const barrel = f.p(0.23, 1.72, 2);
  g.rect(barrel.x - 3.2, barrel.y - 5, 6.4, 5).fill(shade(wood, 1.13));
  g.ellipse(barrel.x, barrel.y - 5, 3.2, 1.6).fill(stone);
  g.ellipse(barrel.x, barrel.y - 5, 2.2, 1).fill(color(theme, 'pump.tank'));
}

/** A wheel in the v/z plane, with two rims, projected depth, spokes and lifting paddles. */
function waterWheel(g: Graphics, f: Frame, wood: number, rim: number): void {
  const segments = 24;
  const at = (u: number, angle: number, radius = 1): Point =>
    f.p(u, 0.91 + Math.cos(angle) * 0.46 * radius, 13.9 + Math.sin(angle) * 13.2 * radius);
  const rear = 1.42,
    near = 1.58;
  for (let k = 0; k < segments; k++) {
    const a = (k * Math.PI * 2) / segments,
      b = ((k + 1) * Math.PI * 2) / segments;
    poly(
      g,
      [at(rear, a), at(rear, b), at(near, b), at(near, a)],
      shade(wood, k < 12 ? 1.08 : 0.68),
    );
    poly(g, [at(rear, a), at(rear, b), at(rear, b, 0.83), at(rear, a, 0.83)], shade(rim, 0.7));
  }
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    line(g, f.p(near, 0.91, 13.9), at(near, a, 0.92), shade(wood, 1.22), 1.5);
    poly(
      g,
      [
        at(rear - 0.035, a, 1.04),
        at(near + 0.035, a, 1.04),
        at(near + 0.035, a + 0.13, 0.86),
        at(rear - 0.035, a + 0.13, 0.86),
      ],
      rim,
    );
  }
  for (let k = 0; k < segments; k++) {
    const a = (k * Math.PI * 2) / segments,
      b = ((k + 1) * Math.PI * 2) / segments;
    poly(
      g,
      [at(near, a), at(near, b), at(near, b, 0.83), at(near, a, 0.83)],
      shade(rim, k < 12 ? 1.13 : 0.92),
    );
  }
  const hub = f.p(near, 0.91, 13.9);
  g.ellipse(hub.x, hub.y, 2.1, 2.9).fill(shade(wood, 0.65));
}

/** A masonry pump house, elevated header basin and lifting wheel over a stone race. */
export function drawAdobePump(g: Graphics, theme: Theme, size: number): void {
  // The existing water pump occupies 2×2; all equipment remains inside those lot boundaries.
  const f = new Frame(size);
  const wall = color(theme, 'pump.wall');
  const top = color(theme, 'pump.roof');
  const stone = color(theme, 'ground.bareLot');
  const wood = color(theme, 'pump.frame');
  const water = color(theme, 'pump.tank');
  const lightWater = color(theme, 'pump.tankTop');
  apron(g, f, theme);

  // Open race with thickness at both ends, retaining walls and quiet water highlights.
  f.box(g, [1.22, 0.09, 1.88, 1.91], 0.3, 2, shade(stone, 0.72), shade(water, 0.68));
  f.quad(g, 1.3, 0.1, 1.8, 1.91, water, 2.6);
  f.box(g, [1.2, 0.09, 1.29, 1.91], 0.3, 4.2, stone, shade(stone, 1.06));
  f.box(g, [1.8, 0.09, 1.9, 1.91], 0.3, 4.2, stone, shade(stone, 1.06));
  for (const v of [0.23, 0.43, 1.49, 1.75])
    line(g, f.p(1.36, v, 2.8), f.p(1.7, v + 0.05, 2.8), lightWater, 0.8);

  f.quad(g, 0.13, 0.23, 1.23, 1.6, shade(stone, 0.67), 0.7);
  f.box(g, [0.16, 0.2, 1.13, 1.47], 0.8, 16, wall, top);
  roof(g, f, [0.16, 0.2, 1.13, 1.47], 16.8, wall, stone);
  // Plastered plinth and two ventilation slits break up the visible wall.
  front(g, f, 0.18, 1.12, 1.475, 0.8, 3.2, shade(stone, 0.8));
  front(g, f, 0.31, 0.64, 1.48, 1, 11.5, stone);
  front(g, f, 0.36, 0.6, 1.485, 1, 10.4, shade(wood, 0.62));
  for (const u of [0.8, 0.94]) front(g, f, u, u + 0.07, 1.48, 8.4, 12, shade(wood, 0.72));
  f.box(g, [0.28, 1.47, 0.68, 1.67], 0.6, 1.5, stone, shade(stone, 1.08));
  f.box(g, [0.26, 1.47, 0.7, 1.64], 12.2, 1.3, wood, shade(top, 1.15));

  // Small elevated receiving basin: the wheel and flume visibly feed the building.
  f.box(g, [0.27, 0.34, 0.92, 0.94], 16.8, 7, shade(wall, 1.07), shade(water, 0.7));
  f.quad(g, 0.35, 0.42, 0.84, 0.86, water, 24);
  roof(g, f, [0.27, 0.34, 0.92, 0.94], 23.8, stone, shade(stone, 1.06));
  line(g, f.p(0.4, 0.58, 24.1), f.p(0.72, 0.58, 24.1), lightWater, 0.8);
  f.box(g, [0.9, 0.74, 1.51, 0.91], 23.8, 1.2, wood, shade(wood, 0.65));
  f.quad(g, 0.92, 0.79, 1.5, 0.87, lightWater, 25.1);

  // The shaft crosses from the machine house to the wheel; the far support is behind it.
  f.box(g, [1.37, 0.83, 1.47, 1.02], 3, 10.8, shade(wood, 0.8), top);
  line(g, f.p(1.1, 0.91, 13.9), f.p(1.65, 0.91, 13.9), shade(wood, 0.68), 3);
  waterWheel(g, f, wood, top);
  f.box(g, [1.65, 0.84, 1.77, 1.02], 3, 10.9, wood, shade(top, 1.12));
  line(g, f.p(1.58, 0.91, 13.9), f.p(1.73, 0.91, 13.9), shade(wood, 0.65), 2.6);

  // Delivery pipe with elbow and a hand valve; these are visual fittings, not network tiles.
  line(g, f.p(0.92, 1.48, 6), f.p(0.92, 1.77, 6), water, 3.5);
  line(g, f.p(0.92, 1.77, 6), f.p(0.92, 1.77, 1.5), shade(water, 0.78), 3.5);
  const valve = f.p(0.92, 1.62, 8);
  g.ellipse(valve.x, valve.y, 3, 1.5).stroke({ color: wood, width: 1 });
  line(g, { x: valve.x - 2.7, y: valve.y }, { x: valve.x + 2.7, y: valve.y }, wood, 0.8);
}
