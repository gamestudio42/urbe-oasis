import type { Graphics } from 'pixi.js';
import { color, shade, type Theme } from '@theme/core';
import { TILE_H } from './iso';
import { Frame, poly } from './isoFrame';

/**
 * Power plants and water infrastructure.
 *
 * The coal plant, gas plant, pump and well were the last placeables still drawn as a box with an
 * appurtenance bolted on. Each now reads as an industrial site: a boiler house with a turbine hail
 * and coal heap, a gas plant with spherical storage, a pump house with an elevated tank on legs and
 * a well head with a hand pump.
 */

/** Coal plant (3×3): boiler house, turbine hall, coal tower, conveyor and two chimneys. */
export function drawCoalPlant(g: Graphics, theme: Theme, size: number): void {
  const f = new Frame(size);
  const wall = color(theme, 'coal.wall');
  const roof = color(theme, 'coal.roof');
  const glass = color(theme, 'coal.window');
  const stack = color(theme, 'chimney.coal');
  const flue = color(theme, 'lot.chimneyFlue');
  const coal = shade(wall, 0.42);

  // Coal stockpile in the yard, drawn first so the buildings sit in front of it.
  f.quad(g, 0.1, 1.5, 1.05, 2.9, coal);
  f.quad(g, 0.24, 1.64, 0.92, 2.76, shade(coal, 0.78));
  f.quad(g, 0.36, 1.76, 0.8, 2.64, shade(coal, 0.6));

  // Boiler house: the tall block at the back, with the two stacks on its roof.
  f.box(g, [0.1, 0.1, 1.62, 1.16], 0, 30, wall, roof, { color: glass, rows: 3 });
  const stackBase = 30;
  for (const [u, v] of [
    [0.48, 0.36],
    [1.12, 0.36],
  ] as const) {
    const base = f.p(u, v, stackBase);
    // Tapered stack: wider at the base, with a lit rim at the top.
    poly(
      g,
      [
        { x: base.x - 5, y: base.y + 2 },
        { x: base.x + 5, y: base.y + 2 },
        { x: base.x + 3.4, y: base.y - 54 },
        { x: base.x - 3.4, y: base.y - 54 },
      ],
      shade(stack, 0.78),
    );
    poly(
      g,
      [
        { x: base.x, y: base.y + 2 },
        { x: base.x + 5, y: base.y + 2 },
        { x: base.x + 3.4, y: base.y - 54 },
        { x: base.x, y: base.y - 54 },
      ],
      stack,
    );
    g.ellipse(base.x, base.y - 54, 4, 1.8).fill(flue);
    g.rect(base.x - 4.4, base.y - 50, 8.8, 2.2).fill(shade(stack, 1.25));
  }

  // Turbine hall: a lower, wider block in front of the boiler house, with a sawtooth roof.
  f.box(g, [1.32, 0.1, 2.9, 1.62], 0, 17, shade(wall, 1.06), shade(roof, 1.08), {
    color: glass,
    rows: 1,
  });
  // Sawtooth roof lights: the profile that says "machine hall".
  for (let i = 0; i < 3; i++) {
    const u = 1.52 + i * 0.42;
    const a = f.p(u, 0.28, 17);
    const b = f.p(u + 0.3, 0.28, 17);
    const c = f.p(u + 0.3, 0.28, 23);
    poly(g, [a, b, c], shade(glass, 0.92));
    poly(g, [b, f.p(u + 0.3, 1.44, 17), f.p(u + 0.3, 1.44, 23)], shade(glass, 0.8));
  }

  // Coal tower: the tall silo that makes the site read as a power station.
  const tower = f.p(2.3, 0.42, 0);
  g.rect(tower.x - 11, tower.y - 46, 22, 46).fill(shade(wall, 0.9));
  g.rect(tower.x - 4, tower.y - 46, 15, 46).fill(wall);
  g.ellipse(tower.x, tower.y - 46, 11, 5).fill(shade(roof, 1.15));
  g.ellipse(tower.x, tower.y - 46, 7, 3).fill(shade(roof, 0.8));
  // Bands around the silo.
  for (const z of [16, 30]) {
    g.rect(tower.x - 11, tower.y - z, 22, 2).fill(shade(wall, 0.7));
  }

  // Conveyor bridge from the coal heap up to the tower.
  const from = f.p(0.9, 2.1, 2);
  const to = f.p(1.98, 0.6, 40);
  g.moveTo(from.x, from.y)
    .lineTo(to.x, to.y)
    .stroke({ width: 5, color: shade(roof, 0.75) });
  g.moveTo(from.x, from.y - 2)
    .lineTo(to.x, to.y - 2)
    .stroke({ width: 1.6, color: shade(coal, 1.4) });

  // Switchyard in the front corner: a fenced pad with insulators and a busbar.
  f.quad(g, 0.14, 1.66, 0.98, 2.86, shade(roof, 0.62));
  for (const u of [0.28, 0.5, 0.72, 0.92]) {
    const p = f.post(g, u, 2.6, 9, shade(roof, 0.8), 1.4);
    g.ellipse(p.x, p.y, 2.6, 1.2).fill(shade(glass, 0.9));
  }
  f.line(g, f.p(0.24, 2.6), f.p(0.96, 2.6), 1.6, shade(glass, 0.8), 7);
  void size;
}

/** Gas plant (2×2): process unit, spherical storage, pipe rack and a flare boom. */
export function drawGasPlant(g: Graphics, theme: Theme, size: number): void {
  const f = new Frame(size);
  const wall = color(theme, 'gas.wall');
  const roof = color(theme, 'gas.roof');
  const glass = color(theme, 'gas.window');
  const tank = color(theme, 'gas.tankBody');
  const tankTop = color(theme, 'gas.tankTop');
  const rim = color(theme, 'gas.tankRim');

  // Process unit: a stepped block, the tallest part of the site.
  f.box(g, [0.1, 0.12, 1.05, 1.28], 0, 22, wall, roof, { color: glass, rows: 2 });
  f.box(g, [0.22, 0.24, 0.78, 0.7], 22, 8, shade(wall, 1.08), shade(roof, 1.1));
  // Pipe rack running along the front of the unit.
  for (const z of [6, 11]) {
    f.line(g, f.p(0.12, 1.36), f.p(1.02, 1.36), 2.2, shade(rim, 0.9), z);
  }
  for (const u of [0.18, 0.6, 0.98]) f.post(g, u, 1.36, 15, shade(roof, 0.72), 1.6);

  // Spherical storage on skirt legs: the silhouette that says "gas", not "warehouse".
  for (const [u, v] of [
    [1.38, 0.46],
    [1.5, 1.24],
  ] as const) {
    const c = f.p(u, v, 16);
    for (const d of [-6, 0, 6]) {
      g.rect(c.x + d - 1, c.y + 3, 2, 15).fill(shade(rim, 0.72));
    }
    g.circle(c.x, c.y, 14).fill(shade(tank, 0.74));
    g.circle(c.x, c.y - 2, 12).fill(tank);
    g.ellipse(c.x - 3.5, c.y - 8, 5.5, 3.4).fill(tankTop);
    g.ellipse(c.x, c.y + 7, 14, 3.2).fill({ color: rim, alpha: 0.55 });
    // Ladder up the side of the sphere.
    g.moveTo(c.x + 9, c.y + 4)
      .lineTo(c.x + 9, c.y - 12)
      .stroke({ width: 1.2, color: shade(rim, 1.2) });
  }

  // Flare boom behind the unit, with the flame on top.
  const flare = f.post(g, 1.74, 0.16, 52, shade(roof, 0.7), 2.4);
  g.moveTo(flare.x, flare.y + 4)
    .lineTo(flare.x - 6, flare.y)
    .stroke({ width: 1.4, color: shade(rim, 0.9) });
  g.circle(flare.x, flare.y, 5).fill({ color: color(theme, 'fx.flameOuter'), alpha: 0.45 });
  g.circle(flare.x, flare.y, 2).fill(color(theme, 'fx.flameInner'));
  void size;
}

/**
 * Wind turbine (1×1): a tapered tower with a nacelle and three blades.
 *
 * Building sprites are anchored on the south corner of the footprint. The mast stands on the
 * centre of that diamond, half a tile up-screen from the corner.
 */
export function drawWindTurbine(g: Graphics, theme: Theme): void {
  const tower = color(theme, 'wind.tower');
  const blade = color(theme, 'wind.blade');
  const hubColor = color(theme, 'wind.hub');
  const foot = color(theme, 'ground.bareLot');
  const ground = -TILE_H / 2;

  // Concrete pad.
  g.ellipse(0, ground, 17, 8).fill(foot);
  // Tapered tower, drawn as a trapezoid so it does not read as a lamppost.
  poly(
    g,
    [
      { x: -7, y: ground },
      { x: 7, y: ground },
      { x: 3, y: ground - 74 },
      { x: -3, y: ground - 74 },
    ],
    tower,
  );
  poly(
    g,
    [
      { x: 0, y: ground },
      { x: 7, y: ground },
      { x: 3, y: ground - 74 },
      { x: 0, y: ground - 74 },
    ],
    shade(tower, 0.8),
  );
  // Service door at the base.
  g.rect(-3, ground - 11, 6, 11).fill(shade(tower, 0.68));

  // Nacelle, hub and the three blades. The nacelle is centred on the mast.
  const hub = { x: 0, y: ground - 78 };
  g.roundRect(hub.x - 12, hub.y - 5, 24, 10, 4).fill(shade(tower, 1.1));
  g.circle(hub.x, hub.y, 5.2).fill(hubColor);
  g.circle(hub.x - 1, hub.y - 1, 3).fill(shade(hubColor, 1.2));
  for (const [dx, dy] of [
    [0, -34],
    [29, 17],
    [-29, 17],
  ] as const) {
    // Blade root is wide and the tip is narrow, so the blade reads as a blade.
    const root = 5.5;
    const tip = 1.6;
    const px = -dy;
    const py = dx;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    poly(
      g,
      [
        { x: hub.x + ux * root + (px / len) * root, y: hub.y + uy * root + (py / len) * root },
        { x: hub.x + ux * root - (px / len) * root, y: hub.y + uy * root - (py / len) * root },
        { x: hub.x + dx - (px / len) * tip, y: hub.y + dy - (py / len) * tip },
        { x: hub.x + dx + (px / len) * tip, y: hub.y + dy + (py / len) * tip },
      ],
      blade,
    );
  }
}

/** Water pump (2×2): pumphouse, rising main and an elevated tank on a braced steel frame. */
export function drawWaterPump(g: Graphics, theme: Theme, size: number): void {
  const f = new Frame(size);
  const wall = color(theme, 'pump.wall');
  const roof = color(theme, 'pump.roof');
  const glass = color(theme, 'pump.window');
  const tank = color(theme, 'pump.tank');
  const tankTop = color(theme, 'pump.tankTop');
  const pipe = color(theme, 'well.pipe');
  const steel = color(theme, 'lot.antennaPole');

  // Pumphouse: a low block with a doorway and a vent band.
  f.box(g, [0.1, 0.12, 1.0, 1.88], 0, 16, wall, roof, { color: glass, rows: 1 });
  f.quad(g, 0.26, 1.88, 0.62, 1.88, shade(roof, 0.62), 9);

  // Rising main from the pumphouse up to the tank, with a flange band.
  const riser = f.p(1.0, 1.24, 0);
  g.rect(riser.x - 2.4, riser.y - 40, 4.8, 40).fill(pipe);
  g.rect(riser.x - 3.4, riser.y - 22, 6.8, 2.4).fill(shade(pipe, 0.75));

  // Elevated tank: a ribbed drum on a braced four-leg frame.
  const centre = f.p(1.5, 1.26, 0);
  const legTop = centre.y - 40;
  for (const dx of [-13, -5, 5, 13]) {
    g.rect(centre.x + dx - 1.6, legTop, 3.2, -legTop).fill(shade(steel, 0.86));
  }
  // Cross bracing: the diagonals are what make the frame read as a structure.
  g.moveTo(centre.x - 13, legTop)
    .lineTo(centre.x + 13, centre.y - 4)
    .stroke({ width: 1.6, color: shade(steel, 0.9) });
  g.moveTo(centre.x + 13, legTop)
    .lineTo(centre.x - 13, centre.y - 4)
    .stroke({ width: 1.6, color: shade(steel, 0.9) });
  g.rect(centre.x - 14, centre.y - 6, 28, 2.4).fill(shade(steel, 0.95));

  // Tank drum with a domed top, a shadow side and a hoop band.
  g.rect(centre.x - 17, centre.y - 66, 34, 26).fill(shade(tank, 0.74));
  g.rect(centre.x - 11, centre.y - 66, 22, 26).fill(tank);
  g.rect(centre.x - 17, centre.y - 56, 34, 2.6).fill(shade(tank, 1.22));
  g.rect(centre.x - 17, centre.y - 46, 34, 2.2).fill(shade(tank, 0.88));
  g.ellipse(centre.x, centre.y - 66, 17, 6.5).fill(tankTop);
  g.ellipse(centre.x - 3, centre.y - 67.5, 9, 3).fill(shade(tankTop, 1.18));
  // Roof hatch and a small ladder.
  g.rect(centre.x - 3, centre.y - 72, 6, 5).fill(shade(steel, 0.9));
  g.moveTo(centre.x + 12, centre.y - 4)
    .lineTo(centre.x + 12, centre.y - 40)
    .stroke({ width: 1.3, color: shade(steel, 1.05) });
  void size;
}

/** Well (1×1): a capped borehole with a hand pump, a bucket and a spill tray. */
export function drawWell(g: Graphics, theme: Theme, size: number): void {
  const f = new Frame(size);
  const wall = color(theme, 'well.wall');
  const roof = color(theme, 'well.roof');
  const pipe = color(theme, 'well.pipe');
  const pipeTop = color(theme, 'well.pipeTop');
  const base = color(theme, 'well.base');

  // Stone collar around the borehole.
  f.box(g, [0.22, 0.22, 0.78, 0.78], 0, 8, wall, roof);
  f.quad(g, 0.3, 0.3, 0.7, 0.7, shade(base, 0.85), 8);

  // Casing and well head.
  const head = f.p(0.5, 0.5, 8);
  g.rect(head.x - 4.5, head.y - 24, 9, 24).fill(pipe);
  g.rect(head.x - 6, head.y - 16, 12, 3).fill(shade(pipe, 0.78));
  g.ellipse(head.x, head.y - 24, 4.5, 2.4).fill(pipeTop);
  g.ellipse(head.x, head.y - 24, 2.6, 1.3).fill(shade(pipeTop, 0.7));

  // Hand pump: handle, spout and the water it throws.
  g.moveTo(head.x - 1, head.y - 20)
    .lineTo(head.x + 13, head.y - 25)
    .stroke({ width: 2.8, color: base });
  g.rect(head.x + 9, head.y - 23, 6, 3.2).fill(shade(base, 1.12));
  g.moveTo(head.x + 12, head.y - 20)
    .lineTo(head.x + 14, head.y - 15)
    .stroke({ width: 2, color: base });
  g.ellipse(head.x + 14.5, head.y - 12, 2, 1).fill({ color: pipeTop, alpha: 0.7 });

  // Bucket resting on the collar.
  g.rect(head.x - 12, head.y - 4, 6, 6).fill(shade(base, 1.15));
  g.ellipse(head.x - 9, head.y - 4, 3, 1.3).fill(shade(base, 0.8));
  void size;
}

/** Dispatches the utility buildings; the caller knows the kind. */
export function drawUtility(g: Graphics, theme: Theme, kind: string, size: number): boolean {
  switch (kind) {
    case 'coalPlant':
      drawCoalPlant(g, theme, size);
      return true;
    case 'gasPlant':
      drawGasPlant(g, theme, size);
      return true;
    case 'windTurbine':
      drawWindTurbine(g, theme);
      return true;
    case 'waterPump':
      drawWaterPump(g, theme, size);
      return true;
    case 'well':
      drawWell(g, theme, size);
      return true;
    default:
      return false;
  }
}
