import type { Graphics } from 'pixi.js';
import { color, shade, type Theme } from '@theme/core';
import { HEADINGS, drawBoat } from './hubSprites';
import { TILE_H, type Point } from './iso';
import { Frame, poly, type Rect } from './isoFrame';

/**
 * Cyberpunk variants of the civic and utility buildings, the marina and the power poles.
 *
 * The classic silhouettes answer "what is this place?". These answer "what is this place, in a
 * city that runs on neon?" — armoured dark shells, glowing conduits, holographic signage and
 * antenna masts, the same visual language as the drone port and the qanat.
 *
 * The theme picks which set runs: `theme.style` selects the architecture, the colour tokens
 * select the palette. A new skin brings its own style and its own tokens; it never forks this
 * file.
 */

/** Quad on the vertical plane facing the front (`v` constant). */
function frontFace(
  g: Graphics,
  f: Frame,
  u0: number,
  u1: number,
  v: number,
  z0: number,
  z1: number,
  fill: number,
  alpha = 1,
): void {
  poly(g, [f.p(u0, v, z0), f.p(u1, v, z0), f.p(u1, v, z1), f.p(u0, v, z1)], fill, alpha);
}

/** Quad on the vertical plane facing the right (`u` constant). */
function rightFace(
  g: Graphics,
  f: Frame,
  u: number,
  v0: number,
  v1: number,
  z0: number,
  z1: number,
  fill: number,
  alpha = 1,
): void {
  poly(g, [f.p(u, v0, z0), f.p(u, v1, z0), f.p(u, v1, z1), f.p(u, v0, z1)], fill, alpha);
}

/** A status lamp with a soft halo, the way the drone port marks its corners. */
function lamp(g: Graphics, x: number, y: number, tint: number, radius = 2): void {
  g.circle(x, y, radius * 2.2).fill({ color: tint, alpha: 0.22 });
  g.circle(x, y, radius).fill(tint);
}

/**
 * Power pole for a cyber city. The sprite origin is the ground point and the cable clamps
 * 20px above it, which is where `poleTop` ties the wire.
 */
export function drawCyberPole(g: Graphics, theme: Theme): void {
  const mast = color(theme, 'pole.post');
  const steel = color(theme, 'pole.arm');
  const glow = color(theme, 'infra.pipe');

  g.rect(-3.2, -1.6, 6.4, 2).fill(shade(mast, 0.75));
  g.rect(-1.15, -24, 2.3, 24).fill(mast);
  g.rect(-0.35, -24, 0.7, 24).fill(shade(mast, 1.35));
  g.rect(-5.2, -21.2, 10.4, 2.2).fill(steel);
  g.rect(-5.2, -20.5, 10.4, 0.7).fill(glow);
  lamp(g, -4.4, -20, glow, 1.05);
  lamp(g, 4.4, -20, glow, 1.05);
  lamp(g, 0, -24.5, glow, 1.15);
}

/** Police: an armoured precinct with a magenta rim, a holo badge and a scanner pylon. */
export function drawCyberPoliceStation(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'police.wall');
  const roof = color(theme, 'police.roof');
  const glass = color(theme, 'police.window');
  const glow = color(theme, 'police.glow');
  const alarm = color(theme, 'police.beacon');
  const mast = color(theme, 'lot.antennaPole');

  // Armoured shell: one dark mass with a chamfered roof line.
  f.box(g, [0.1, 0.1, 1.9, 1.9], 0, 18, wall, roof, { color: glass, rows: 2 });

  // Magenta rim light tracing the roof edge: the signature trim of the genre.
  f.trimAt(g, f.p(0.1, 1.9), f.p(1.9, 1.9), 18, 1.7, glow, 0.95);
  f.trimAt(g, f.p(1.9, 1.9), f.p(1.9, 0.1), 18, 1.7, glow, 0.95);

  // Entrance visor: a slab jutting forward, lit from underneath.
  poly(
    g,
    [
      f.p(0.42, 1.9, 13),
      f.p(1.18, 1.9, 13),
      f.p(1.18, 2.02, 12),
      f.p(0.42, 2.02, 12),
    ],
    shade(roof, 1.45),
  );
  f.trimAt(g, f.p(0.44, 2.02), f.p(1.16, 2.02), 12, 1.4, glow, 0.9);

  // Armoured bay: a recessed slot with a lit interior and a lintel strip.
  frontFace(g, f, 0.5, 1.1, 1.902, 0.5, 10, shade(roof, 0.45));
  frontFace(g, f, 0.54, 1.06, 1.904, 1, 9, glow, 0.32);
  f.trimAt(g, f.p(0.5, 1.902), f.p(1.1, 1.902), 10.6, 1.2, glow, 0.85);

  // Holographic badge floating on the front wall.
  const badge = f.p(0.8, 1.9, 15);
  g.poly([
    badge.x - 5,
    badge.y - 6,
    badge.x + 5,
    badge.y - 6,
    badge.x + 5,
    badge.y,
    badge.x,
    badge.y + 6,
    badge.x - 5,
    badge.y,
  ]).fill({ color: glow, alpha: 0.28 });
  g.poly([
    badge.x - 3.4,
    badge.y - 4,
    badge.x + 3.4,
    badge.y - 4,
    badge.x + 3.4,
    badge.y,
    badge.x,
    badge.y + 4,
    badge.x - 3.4,
    badge.y,
  ]).fill({ color: glow, alpha: 0.75 });

  // Scanner pylon on the roof: a mast, a dish and a sweeping cone.
  f.box(g, [1.34, 0.24, 1.76, 0.66], 18, 22, shade(wall, 1.06), roof, { color: glass, rows: 1 });
  const dish = f.p(1.55, 0.45, 40);
  g.rect(dish.x - 1, dish.y - 8, 2, 8).fill(mast);
  g.ellipse(dish.x, dish.y - 9, 7.5, 3.6).fill(shade(mast, 0.65));
  g.ellipse(dish.x, dish.y - 10.5, 5, 2.4).fill(shade(glass, 0.8));
  poly(
    g,
    [
      { x: dish.x - 5, y: dish.y - 10 },
      { x: dish.x + 5, y: dish.y - 10 },
      { x: dish.x, y: dish.y - 17 },
    ],
    glow,
    0.28,
  );
  lamp(g, dish.x, dish.y - 2, alarm, 1.8);

  // Antenna cluster on the roof edge.
  for (const [u, v] of [
    [0.34, 0.34],
    [0.52, 0.28],
  ] as const) {
    const tip = f.post(g, u, v, 16, mast, 1.1, 18);
    lamp(g, tip.x, tip.y, glow, 1.3);
  }
}

/** Fire: a responder bay with lit shutters, a charge tower and a rescue-drone cradle. */
export function drawCyberFireStation(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'fire.wall');
  const roof = color(theme, 'fire.roof');
  const glass = color(theme, 'fire.window');
  const door = color(theme, 'fire.door');
  const glow = color(theme, 'fire.glow');
  const ladder = color(theme, 'fire.ladder');
  const mast = color(theme, 'lot.antennaPole');

  // Low, wide chassis: a bunker rather than a garage.
  f.box(g, [0.08, 0.42, 1.92, 1.9], 0, 15, wall, roof, { color: glass, rows: 1 });
  f.trimAt(g, f.p(0.08, 1.9), f.p(1.92, 1.9), 15, 1.7, glow, 0.95);
  f.trimAt(g, f.p(1.92, 1.9), f.p(1.92, 0.42), 15, 1.7, glow, 0.95);

  // Responder shutters: two tall slots recessed into the front face.
  for (const [u0, u1] of [
    [0.26, 0.86],
    [1.04, 1.64],
  ] as const) {
    frontFace(g, f, u0, u1, 1.902, 0.4, 11, shade(roof, 0.42));
    // Roll-up slats, the last one lit.
    for (let k = 0; k < 4; k++) {
      const z = 1.4 + k * 2.4;
      frontFace(g, f, u0 + 0.03, u1 - 0.03, 1.904, z, z + 1.6, shade(door, 0.55 + k * 0.08));
    }
    frontFace(g, f, u0 + 0.03, u1 - 0.03, 1.905, 8.2, 10.4, door, 0.5);
    const lintel = f.p((u0 + u1) / 2, 1.902, 12.6);
    lamp(g, lintel.x, lintel.y, glow, 1.7);
  }

  // Charge tower: a slim pylon with hazard bands and a warning beacon.
  f.box(g, [1.3, 0.12, 1.84, 0.66], 15, 30, shade(wall, 1.05), roof, { color: glass, rows: 2 });
  for (let k = 0; k < 3; k++) {
    const z = 18 + k * 8;
    rightFace(g, f, 1.845, 0.2, 0.6, z, z + 2.4, glow, 0.75);
  }
  const top = f.p(1.57, 0.39, 45);
  lamp(g, top.x, top.y, door, 2);
  const mastTip = f.post(g, 1.42, 0.2, 14, mast, 1.1, 45);
  lamp(g, mastTip.x, mastTip.y, glow, 1.3);

  // Rescue drone cradle on the roof, echoing the drone port.
  const cradle = f.p(0.72, 0.92, 15);
  g.ellipse(cradle.x, cradle.y, 9, 4.4).fill({ color: glow, alpha: 0.16 });
  g.ellipse(cradle.x, cradle.y, 7, 3.4).fill(shade(roof, 0.8));
  g.ellipse(cradle.x, cradle.y, 5, 2.4).stroke({ width: 1.2, color: glow, alpha: 0.85 });
  for (const [dx, dy] of [
    [-6, -2],
    [6, -2],
    [-6, 2],
    [6, 2],
  ] as const) {
    lamp(g, cradle.x + dx, cradle.y + dy, glow, 1.1);
  }

  // Hose reel and ladder on the side wall.
  const reel = f.p(1.92, 1.3, 8);
  g.circle(reel.x, reel.y, 4).fill(shade(ladder, 0.7));
  g.circle(reel.x, reel.y, 2).fill(ladder);
  g.moveTo(reel.x, reel.y + 4)
    .lineTo(reel.x, reel.y + 13)
    .stroke({ width: 1.2, color: ladder, alpha: 0.9 });
}

/** School: a classroom block wrapped around a violet data spire and a holo courtyard. */
export function drawCyberSchool(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'school.wall');
  const roof = color(theme, 'school.roof');
  const glass = color(theme, 'school.window');
  const pole = color(theme, 'school.pole');
  const banner = color(theme, 'school.banner');
  const glow = color(theme, 'school.glow');

  // Classroom block: a slab with lit window bands.
  f.box(g, [0.1, 0.12, 1.9, 0.92], 0, 20, wall, roof, { color: glass, rows: 3 });
  f.trimAt(g, f.p(0.1, 0.92), f.p(1.9, 0.92), 20, 1.6, glow, 0.9);
  f.trimAt(g, f.p(1.9, 0.92), f.p(1.9, 0.12), 20, 1.6, glow, 0.9);

  // Data spire: a tapered mast rising from the roof, banded with violet light.
  const spire = f.p(0.46, 0.44, 20);
  poly(
    g,
    [
      { x: spire.x - 7, y: spire.y },
      { x: spire.x + 7, y: spire.y },
      { x: spire.x + 3, y: spire.y - 34 },
      { x: spire.x - 3, y: spire.y - 34 },
    ],
    shade(wall, 1.08),
  );
  for (let k = 0; k < 4; k++) {
    const z = 6 + k * 8;
    rightFace(g, f, 0.46 + (0.24 * (20 - z)) / 20, 0.38, 0.5, z, z + 2, glow, 0.8);
  }
  lamp(g, spire.x, spire.y - 35, banner, 1.8);

  // Gym: a low block under an illuminated barrel vault.
  f.box(g, [0.14, 1.04, 1.14, 1.9], 0, 12, shade(wall, 1.06), shade(roof, 1.1), {
    color: glass,
    rows: 1,
  });
  const vault = 12;
  const u0 = 0.14;
  const u1 = 1.14;
  const segs = 7;
  for (let i = 0; i < segs; i++) {
    const a = u0 + ((u1 - u0) * i) / segs;
    const b = u0 + ((u1 - u0) * (i + 1)) / segs;
    const lift = (t: number) => Math.sin(t * Math.PI) * 8;
    const ta = i / segs;
    const tb = (i + 1) / segs;
    poly(
      g,
      [
        f.p(a, 1.9, vault),
        f.p(b, 1.9, vault),
        f.p(b, 1.9, vault + lift(tb)),
        f.p(a, 1.9, vault + lift(ta)),
      ],
      shade(roof, 1.24),
    );
    // The lit rib that makes the vault read as an illuminated arch.
    poly(
      g,
      [
        f.p(a, 1.9, vault + lift(ta)),
        f.p(b, 1.9, vault + lift(tb)),
        f.p(b, 1.9, vault + lift(tb) - 1.4),
        f.p(a, 1.9, vault + lift(ta) - 1.4),
      ],
      glow,
      0.85,
    );
  }
  for (let i = 0; i < segs; i++) {
    const a = u0 + ((u1 - u0) * i) / segs;
    const b = u0 + ((u1 - u0) * (i + 1)) / segs;
    const lift = (t: number) => Math.sin(t * Math.PI) * 8;
    const ta = i / segs;
    const tb = (i + 1) / segs;
    poly(
      g,
      [
        f.p(a, 1.04, vault + lift(ta)),
        f.p(b, 1.04, vault + lift(tb)),
        f.p(b, 1.9, vault + lift(tb)),
        f.p(a, 1.9, vault + lift(ta)),
      ],
      shade(roof, 1.16),
    );
  }

  // Courtyard: a paved pad with a glowing grid instead of a lawn.
  f.quad(g, 1.26, 1.02, 1.9, 1.9, shade(roof, 0.6));
  for (let k = 0; k < 3; k++) {
    const v = 1.16 + k * 0.24;
    f.line(g, f.p(1.3, v), f.p(1.86, v), 1, glow, 0.4, 0.5);
  }
  for (let k = 0; k < 3; k++) {
    const u = 1.38 + k * 0.18;
    f.line(g, f.p(u, 1.06), f.p(u, 1.86), 1, glow, 0.4, 0.5);
  }

  // Banner mast: a lit pylon carrying a holographic banner.
  const mastTip = f.post(g, 1.56, 1.48, 26, pole, 1.3);
  lamp(g, mastTip.x, mastTip.y, banner, 1.5);
  poly(
    g,
    [
      { x: mastTip.x, y: mastTip.y },
      { x: mastTip.x + 14, y: mastTip.y + 3 },
      { x: mastTip.x + 14, y: mastTip.y + 12 },
      { x: mastTip.x, y: mastTip.y + 8 },
    ],
    banner,
    0.85,
  );
}

/** Hospital: a ward block with a green holo cross, a scanner arch and a lit helipad. */
export function drawCyberHospital(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'hospital.wall');
  const roof = color(theme, 'hospital.roof');
  const glass = color(theme, 'hospital.window');
  const cross = color(theme, 'hospital.cross');
  const mark = color(theme, 'hospital.padMark');
  const glow = color(theme, 'hospital.glow');

  // Ward block: a tall slab with a continuous lit window spine.
  f.box(g, [0.12, 0.18, 1.16, 1.9], 0, 36, wall, roof, { color: glass, rows: 6 });
  frontFace(g, f, 0.24, 0.42, 1.902, 2, 34, glow, 0.5);
  f.trimAt(g, f.p(0.12, 1.9), f.p(1.16, 1.9), 36, 1.8, glow, 0.95);

  // Service core on the roof.
  f.box(g, [0.28, 0.32, 0.72, 0.68], 36, 8, shade(wall, 1.05), shade(roof, 1.06));
  f.box(g, [0.2, 0.26, 0.48, 0.6], 44, 9, shade(wall, 0.95), shade(roof, 0.95));
  const vent = f.p(0.34, 0.43, 53);
  g.rect(vent.x - 4, vent.y - 8, 8, 8).fill(shade(roof, 0.8));
  g.rect(vent.x - 3, vent.y - 7, 6, 1.4).fill(glow, 0.8);

  // Holo cross on the front wall, with a halo behind it.
  const c = f.p(0.66, 1.9, 27);
  g.rect(c.x - 9, c.y - 3.4, 18, 6.8).fill({ color: cross, alpha: 0.25 });
  g.rect(c.x - 3.4, c.y - 9, 6.8, 18).fill({ color: cross, alpha: 0.25 });
  g.rect(c.x - 7, c.y - 2.2, 14, 4.4).fill(cross);
  g.rect(c.x - 2.2, c.y - 7, 4.4, 14).fill(cross);
  g.rect(c.x - 7, c.y - 2.2, 14, 1.1).fill(shade(cross, 1.35));
  g.rect(c.x - 2.2, c.y - 7, 1.1, 14).fill(shade(cross, 1.35));

  // Helipad sits on the middle of the ward roof, clear of the service core behind it.
  const pad = f.p(0.64, 1.04, 36);
  g.ellipse(pad.x, pad.y, 15, 7.5).fill(shade(roof, 0.72));
  g.ellipse(pad.x, pad.y, 12.5, 6.2).fill(shade(roof, 0.86));
  g.ellipse(pad.x, pad.y, 10.5, 5.2).fill({ color: glow, alpha: 0.22 });
  g.rect(pad.x - 4.2, pad.y - 3.4, 1.8, 6.8).fill(mark);
  g.rect(pad.x + 2.4, pad.y - 3.4, 1.8, 6.8).fill(mark);
  g.rect(pad.x - 4.2, pad.y - 0.8, 8.4, 1.6).fill(mark);
  g.ellipse(pad.x, pad.y, 10.5, 5.2).stroke({ width: 1.2, color: glow, alpha: 0.9 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    lamp(g, pad.x + Math.cos(a) * 13.5, pad.y + Math.sin(a) * 6.6, glow, 1.2);
  }

  // Scanner arch over the ambulance bay: two pylons and a lit crossbar.
  f.box(g, [1.2, 0.9, 1.9, 1.9], 0, 13, shade(wall, 0.96), shade(roof, 0.95), {
    color: glass,
    rows: 1,
  });
  for (const u of [1.32, 1.78]) {
    f.post(g, u, 1.9, 9, shade(roof, 0.7), 2);
  }
  f.trimAt(g, f.p(1.32, 1.9), f.p(1.78, 1.9), 9, 1.6, glow, 0.9);
}

/** Coal plant: a fusion stack site — dark plant, amber glow, lit silo and switchyard. */
export function drawCyberCoalPlant(g: Graphics, theme: Theme): void {
  const f = new Frame(3);
  const wall = color(theme, 'coal.wall');
  const roof = color(theme, 'coal.roof');
  const glass = color(theme, 'coal.window');
  const stack = color(theme, 'coal.stack');
  const silo = color(theme, 'coal.silo');
  const glow = color(theme, 'coal.glow');
  const flue = color(theme, 'lot.chimneyFlue');

  // Reactor yard: a dark pad with a glowing containment ring.
  f.quad(g, 0.08, 0.08, 2.92, 2.92, shade(color(theme, 'ground.skirt'), 0.85));
  f.trimAt(g, f.p(0.16, 0.16), f.p(2.84, 0.16), 0, 2, glow, 0.35);

  // Containment pile, still coal black.
  f.quad(g, 0.1, 1.5, 1.05, 2.9, shade(wall, 0.42));
  f.quad(g, 0.24, 1.64, 0.92, 2.76, shade(wall, 0.32));
  f.quad(g, 0.36, 1.76, 0.8, 2.64, shade(wall, 0.24));

  // Reactor block with glowing window bands.
  f.box(g, [0.1, 0.1, 1.62, 1.16], 0, 30, wall, roof, { color: glass, rows: 3 });
  f.trimAt(g, f.p(0.1, 1.16), f.p(1.62, 1.16), 30, 1.8, glow, 0.9);
  for (let k = 0; k < 3; k++) {
    frontFace(g, f, 0.18, 1.54, 1.162, 4 + k * 9, 7 + k * 9, glow, 0.55);
  }

  // Cooling stacks: tapered, with a hot glowing rim.
  for (const [u, v] of [
    [0.48, 0.36],
    [1.12, 0.36],
  ] as const) {
    const base = f.p(u, v, 30);
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
    // Hot rim light where the plume leaves the stack.
    g.ellipse(base.x, base.y - 54, 4.6, 2.1).stroke({ width: 1.2, color: glow, alpha: 0.85 });
    g.rect(base.x - 4.4, base.y - 50, 8.8, 2.2).fill(shade(stack, 1.25));
    g.rect(base.x - 4.4, base.y - 50, 8.8, 0.8).fill(glow, 0.7);
  }

  // Turbine hall with a lit sawtooth roof.
  f.box(g, [1.32, 0.1, 2.9, 1.62], 0, 17, shade(wall, 1.06), shade(roof, 1.08), {
    color: glass,
    rows: 1,
  });
  for (let i = 0; i < 3; i++) {
    const u = 1.52 + i * 0.42;
    const a = f.p(u, 0.28, 17);
    const b = f.p(u + 0.3, 0.28, 17);
    const c = f.p(u + 0.3, 0.28, 23);
    // Shade the roof against the wall, not against the lit window: the neon amber is saturated
    // enough that a multiply of it lands off-palette.
    poly(g, [a, b, c], shade(wall, 1.1));
    poly(g, [b, f.p(u + 0.3, 1.44, 17), f.p(u + 0.3, 1.44, 23)], shade(wall, 0.95));
    // Lit leading edge of each tooth.
    g.moveTo(a.x, a.y)
      .lineTo(b.x, b.y)
      .stroke({ width: 1.1, color: glow, alpha: 0.8 });
  }

  // Fuel silo with a charge column down the side.
  const tower = f.p(2.3, 0.42, 0);
  g.rect(tower.x - 11, tower.y - 46, 22, 46).fill(shade(silo, 0.86));
  g.rect(tower.x - 4, tower.y - 46, 15, 46).fill(silo);
  g.ellipse(tower.x, tower.y - 46, 11, 5).fill(shade(roof, 1.15));
  g.ellipse(tower.x, tower.y - 46, 7, 3).fill(shade(roof, 0.8));
  for (const z of [16, 30]) {
    g.rect(tower.x - 11, tower.y - z, 22, 2).fill(shade(silo, 0.7));
  }
  // Charge column: the lit strip that says "this silo is live".
  g.rect(tower.x + 6, tower.y - 44, 3, 42).fill({ color: glow, alpha: 0.85 });
  g.rect(tower.x + 6, tower.y - 44, 1.2, 42).fill(shade(glow, 1.4));

  // Conveyor bridge with a lit belt.
  const from = f.p(0.9, 2.1, 2);
  const to = f.p(1.98, 0.6, 40);
  g.moveTo(from.x, from.y)
    .lineTo(to.x, to.y)
    .stroke({ width: 5, color: shade(roof, 0.75) });
  g.moveTo(from.x, from.y - 2)
    .lineTo(to.x, to.y - 2)
    .stroke({ width: 1.6, color: glow, alpha: 0.9 });

  // Switchyard: a fenced pad with lit insulators and a busbar.
  f.quad(g, 0.14, 1.66, 0.98, 2.86, shade(roof, 0.62));
  for (const u of [0.28, 0.5, 0.72, 0.92]) {
    const p = f.post(g, u, 2.6, 9, shade(roof, 0.8), 1.4);
    g.ellipse(p.x, p.y, 2.6, 1.2).fill(shade(glass, 0.9));
    lamp(g, p.x, p.y - 1, glow, 1);
  }
  f.line(g, f.p(0.24, 2.6), f.p(0.96, 2.6), 1.6, glow, 7, 0.9);
}

/** Gas plant: a fuel depot with glowing pressure spheres and a flare boom. */
export function drawCyberGasPlant(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'gas.wall');
  const roof = color(theme, 'gas.roof');
  const glass = color(theme, 'gas.window');
  const tank = color(theme, 'gas.tankBody');
  const tankTop = color(theme, 'gas.tankTop');
  const rim = color(theme, 'gas.tankRim');
  const glow = color(theme, 'gas.glow');
  const flare = color(theme, 'gas.flare');

  // Process unit: a stepped block with a lit control column.
  f.box(g, [0.1, 0.12, 1.05, 1.28], 0, 22, wall, roof, { color: glass, rows: 2 });
  f.box(g, [0.22, 0.24, 0.78, 0.7], 22, 8, shade(wall, 1.08), shade(roof, 1.1));
  f.trimAt(g, f.p(0.1, 1.28), f.p(1.05, 1.28), 22, 1.6, glow, 0.9);
  const column = f.p(0.5, 0.24, 30);
  g.rect(column.x - 3, column.y - 12, 6, 12).fill(shade(rim, 0.8));
  g.rect(column.x - 2, column.y - 11, 4, 10).fill({ color: glow, alpha: 0.7 });

  // Pipe rack: glowing conduits running along the front of the unit.
  for (const z of [6, 11]) {
    f.line(g, f.p(0.12, 1.36), f.p(1.02, 1.36), 2.2, glow, z, 0.85);
  }
  for (const u of [0.18, 0.6, 0.98]) f.post(g, u, 1.36, 15, shade(roof, 0.72), 1.6);

  // Pressure spheres with lit seams and a holo band.
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
    // Equatorial glow seam: the signature ring of a fuel sphere.
    g.ellipse(c.x, c.y, 12.6, 12.6).stroke({ width: 1.2, color: glow, alpha: 0.8 });
    g.ellipse(c.x, c.y, 14, 14).fill({ color: glow, alpha: 0.12 });
    // Holo band across the face.
    g.rect(c.x - 9, c.y - 1, 18, 2).fill({ color: glow, alpha: 0.55 });
    g.moveTo(c.x + 9, c.y + 4)
      .lineTo(c.x + 9, c.y - 12)
      .stroke({ width: 1.2, color: shade(rim, 1.2) });
  }

  // Flare boom with a hot tip.
  const boom = f.post(g, 1.74, 0.16, 52, shade(roof, 0.7), 2.4);
  g.moveTo(boom.x, boom.y + 4)
    .lineTo(boom.x - 6, boom.y)
    .stroke({ width: 1.4, color: shade(rim, 0.9) });
  g.circle(boom.x, boom.y, 6).fill({ color: flare, alpha: 0.4 });
  g.circle(boom.x, boom.y, 3).fill(color(theme, 'fx.flameInner'));
  lamp(g, boom.x, boom.y - 5, glow, 1.4);
}

/**
 * Wind turbine: a lit mast with a glowing hub and a service ring at the foot.
 *
 * The sprite origin is the south corner of the lot. The ring sits on the centre of the diamond.
 */
export function drawCyberWindTurbine(g: Graphics, theme: Theme): void {
  const tower = color(theme, 'wind.tower');
  const blade = color(theme, 'wind.blade');
  const hubColor = color(theme, 'wind.hub');
  const glow = color(theme, 'wind.glow');
  const foot = color(theme, 'ground.bareLot');
  const ground = -TILE_H / 2;

  // Service ring instead of a plain concrete pad.
  g.ellipse(0, ground, 17, 8).fill(foot);
  g.ellipse(0, ground, 13, 6).fill({ color: glow, alpha: 0.14 });
  g.ellipse(0, ground, 13, 6).stroke({ width: 1.2, color: glow, alpha: 0.75 });

  // Tapered mast with a lit spine down the leading edge.
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
  g.rect(-0.6, ground - 70, 1.6, 68).fill({ color: glow, alpha: 0.7 });
  g.rect(-3, ground - 11, 6, 11).fill(shade(tower, 0.68));

  // Nacelle, hub and the three blades. The nacelle is centred on the mast.
  const hub = { x: 0, y: ground - 78 };
  g.roundRect(hub.x - 12, hub.y - 5, 24, 10, 4).fill(shade(tower, 1.1));
  g.rect(hub.x - 11, hub.y + 1, 22, 1.4).fill({ color: glow, alpha: 0.8 });
  g.circle(hub.x, hub.y, 5.2).fill(hubColor);
  g.circle(hub.x - 1, hub.y - 1, 3).fill(shade(hubColor, 1.2));
  for (const [dx, dy] of [
    [0, -34],
    [29, 17],
    [-29, 17],
  ] as const) {
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
  lamp(g, hub.x, hub.y - 6, glow, 1.6);
}

/** Water pump: a reclamation plant with a purification column and a lit reservoir. */
export function drawCyberWaterPump(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'pump.wall');
  const roof = color(theme, 'pump.roof');
  const glass = color(theme, 'pump.window');
  const tank = color(theme, 'pump.tank');
  const tankTop = color(theme, 'pump.tankTop');
  const pipe = color(theme, 'well.pipe');
  const frame = color(theme, 'pump.frame');
  const glow = color(theme, 'pump.glow');

  // Pumphouse with a lit door.
  f.box(g, [0.1, 0.12, 1.0, 1.9], 0, 16, wall, roof, { color: glass, rows: 1 });
  f.trimAt(g, f.p(0.1, 1.9), f.p(1.0, 1.9), 16, 1.6, glow, 0.9);
  frontFace(g, f, 0.28, 0.62, 1.902, 0.4, 9, shade(roof, 0.55));
  frontFace(g, f, 0.31, 0.59, 1.904, 1, 8.4, glow, 0.45);
  f.trimAt(g, f.p(0.28, 1.902), f.p(0.62, 1.902), 9.6, 1.1, glow, 0.8);

  // Purification column: a filter drum banded with light.
  const filter = f.p(0.52, 0.5, 0);
  g.rect(filter.x - 6, filter.y - 40, 12, 40).fill(shade(wall, 0.88));
  g.rect(filter.x - 3, filter.y - 40, 6, 40).fill(wall);
  for (let k = 0; k < 5; k++) {
    const z = 4 + k * 7;
    g.rect(filter.x - 6, filter.y - z, 12, 2).fill({ color: glow, alpha: 0.8 });
  }
  g.ellipse(filter.x, filter.y - 40, 6, 2.6).fill(tankTop);
  g.ellipse(filter.x, filter.y - 40, 3.6, 1.5).fill({ color: glow, alpha: 0.85 });

  // Short rising main on the west edge of the tower's own tile, not a second column.
  const riser = f.p(1.02, 1.5, 0);
  g.rect(riser.x - 2.2, riser.y - 20, 4.4, 20).fill(pipe);
  g.rect(riser.x - 0.9, riser.y - 18, 1.3, 16).fill({ color: glow, alpha: 0.8 });
  g.rect(riser.x - 3.2, riser.y - 10, 6.4, 2.2).fill(shade(pipe, 0.75));

  // Elevated tank on the centre of the front-east tile (u 1–2, v 1–2).
  // Feet end at that ground point: a rect down to y = 0 would leave the tile.
  const centre = f.p(1.5, 1.5, 0);
  const legRise = 32;
  const legTop = centre.y - legRise;
  for (const dx of [-8, -3, 3, 8]) {
    g.rect(centre.x + dx - 1.3, legTop, 2.6, legRise).fill(shade(frame, 0.86));
  }
  g.moveTo(centre.x - 8, legTop)
    .lineTo(centre.x + 8, centre.y - 2)
    .stroke({ width: 1.5, color: shade(frame, 0.9) });
  g.moveTo(centre.x + 8, legTop)
    .lineTo(centre.x - 8, centre.y - 2)
    .stroke({ width: 1.5, color: shade(frame, 0.9) });
  g.rect(centre.x - 9, centre.y - 4, 18, 2).fill(shade(frame, 0.95));

  g.rect(centre.x - 10, centre.y - 52, 20, 20).fill(shade(tank, 0.74));
  g.rect(centre.x - 6.5, centre.y - 52, 13, 20).fill(tank);
  g.rect(centre.x - 10, centre.y - 45, 20, 2).fill(shade(tank, 1.22));
  g.rect(centre.x - 10, centre.y - 38, 20, 1.6).fill(shade(tank, 0.88));
  g.ellipse(centre.x, centre.y - 52, 10, 4).fill(tankTop);
  g.ellipse(centre.x - 1.6, centre.y - 53, 5, 1.8).fill(shade(tankTop, 1.18));
  // Reservoir level: a bright column on the face of the drum.
  g.rect(centre.x + 3.2, centre.y - 49, 2.2, 13).fill({ color: glow, alpha: 0.85 });
  g.rect(centre.x + 3.2, centre.y - 49, 0.9, 13).fill(shade(glow, 1.4));
  g.rect(centre.x - 2, centre.y - 57, 4, 4).fill(shade(frame, 0.9));
  g.moveTo(centre.x + 7, centre.y - 2)
    .lineTo(centre.x + 7, centre.y - 32)
    .stroke({ width: 1.2, color: shade(frame, 1.05) });
}

/** Well: a water node — a lit borehole casing with a pump arm and a glowing sump. */
export function drawCyberWell(g: Graphics, theme: Theme): void {
  const f = new Frame(1);
  const wall = color(theme, 'well.wall');
  const roof = color(theme, 'well.roof');
  const pipe = color(theme, 'well.pipe');
  const pipeTop = color(theme, 'well.pipeTop');
  const base = color(theme, 'well.base');
  const glow = color(theme, 'well.glow');

  // Hexagonal collar around the borehole.
  f.box(g, [0.22, 0.22, 0.78, 0.78], 0, 8, wall, roof);
  f.quad(g, 0.3, 0.3, 0.7, 0.7, shade(base, 0.85), 8);
  f.trimAt(g, f.p(0.24, 0.76), f.p(0.76, 0.76), 8.4, 1.4, glow, 0.85);

  // Casing with light rings and a lit cap.
  const head = f.p(0.5, 0.5, 8);
  g.rect(head.x - 4.5, head.y - 24, 9, 24).fill(pipe);
  g.rect(head.x - 4.5, head.y - 24, 3, 24).fill({ color: glow, alpha: 0.55 });
  g.rect(head.x - 6, head.y - 16, 12, 3).fill(shade(pipe, 0.78));
  for (const z of [10, 20]) {
    g.rect(head.x - 5, head.y - z, 10, 1.6).fill({ color: glow, alpha: 0.7 });
  }
  g.ellipse(head.x, head.y - 24, 4.5, 2.4).fill(pipeTop);
  g.ellipse(head.x, head.y - 24, 2.6, 1.3).fill({ color: glow, alpha: 0.9 });

  // Pump arm: a jointed boom that dips into the sump.
  g.moveTo(head.x - 1, head.y - 20)
    .lineTo(head.x + 13, head.y - 25)
    .stroke({ width: 2.8, color: base });
  g.rect(head.x + 9, head.y - 23, 6, 3.2).fill(shade(base, 1.12));
  g.moveTo(head.x + 12, head.y - 20)
    .lineTo(head.x + 14, head.y - 15)
    .stroke({ width: 2, color: base });
  g.ellipse(head.x + 14.5, head.y - 12, 2, 1).fill({ color: glow, alpha: 0.85 });
  lamp(g, head.x, head.y - 26, glow, 1.4);

  // Sump: a lit pool where the water lands.
  g.ellipse(head.x + 14.5, head.y - 10, 4, 1.8).fill({ color: glow, alpha: 0.28 });
  g.ellipse(head.x + 14.5, head.y - 10, 2.4, 1.1).fill({ color: glow, alpha: 0.5 });
}

/**
 * Marina on a 3×3 lot. `side` is where the water is, matching `drawMarina`: 0 = +y, 1 = +x,
 * 2 = -y, 3 = -x. The quay stays on that edge so the piers still meet it; the clubhouse, shed
 * and flag are replaced by the same dark slabs and edge lights as the rest of the city.
 */
export function drawCyberMarina(g: Graphics, theme: Theme, side: number): void {
  const f = new Frame(3);
  const toGrid = (a: number, b: number): [number, number] => {
    switch (side) {
      case 1:
        return [b, 3 - a];
      case 2:
        return [3 - a, 3 - b];
      case 3:
        return [3 - b, a];
      default:
        return [a, b];
    }
  };
  const P = (a: number, b: number, z = 0): Point => {
    const [u, v] = toGrid(a, b);
    return f.p(u, v, z);
  };
  const R = (a0: number, b0: number, a1: number, b1: number): Rect => {
    const [ua, va] = toGrid(a0, b0);
    const [ub, vb] = toGrid(a1, b1);
    return [Math.min(ua, ub), Math.min(va, vb), Math.max(ua, ub), Math.max(va, vb)];
  };
  const apron = color(theme, 'airport.apron');
  const deck = color(theme, 'marina.pierWood');
  const wall = color(theme, 'airport.terminalWall');
  const roof = color(theme, 'airport.terminalRoof');
  const glass = color(theme, 'marina.clubWindow');
  const trim = color(theme, 'marina.flagCloth');
  const steel = color(theme, 'qanat.coil');
  const towardWater = HEADINGS[[2, 0, 6, 4][side] ?? 2] as Point;

  f.quad(g, 0.04, 0.04, 2.96, 2.96, apron);
  f.quad(g, ...R(0.16, 1.55, 1.14, 2.24), color(theme, 'road.surface'));
  for (const a of [0.34, 0.56, 0.78]) {
    const from = P(a, 1.64);
    const to = P(a, 2.08);
    g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: 0.8, color: glass, alpha: 0.65 });
  }

  // Metal quay along the water, with a lit lip instead of timber planks.
  f.quad(g, ...R(0, 2.38, 3, 3), deck);
  f.trimAt(g, P(0.04, 2.96), P(2.96, 2.96), 1.4, 1.5, glass, 0.9);
  const quay = P(0.04, 2.4);
  const quayEnd = P(2.96, 2.4);
  g.moveTo(quay.x, quay.y).lineTo(quayEnd.x, quayEnd.y).stroke({ width: 1.2, color: color(theme, 'marina.woodEdge') });

  for (const a of [0.4, 1.5, 2.6]) {
    const base = P(a, 2.68);
    g.rect(base.x - 0.7, base.y - 7, 1.4, 7).fill(steel);
    lamp(g, base.x, base.y - 7.4, glass, 1.05);
  }

  const items: { depth: number; draw: () => void }[] = [];
  const add = (r: Rect, draw: () => void) => items.push({ depth: r[2] + r[3], draw });

  const terminal = R(0.16, 0.18, 1.58, 1.28);
  add(terminal, () => {
    f.box(g, terminal, 0, 15, wall, roof, { color: glass, rows: 1 });
    f.trimAt(g, f.p(terminal[0], terminal[3]), f.p(terminal[2], terminal[3]), 15, 1.6, trim, 0.95);
    f.trimAt(g, f.p(terminal[2], terminal[3]), f.p(terminal[2], terminal[1]), 15, 1.6, trim, 0.95);
    const tip = f.post(g, terminal[0] + 0.14, terminal[1] + 0.14, 16, steel, 1.15, 15);
    lamp(g, tip.x, tip.y, glass, 1.25);
  });

  const hangar = R(1.78, 0.16, 2.84, 1.42);
  add(hangar, () => {
    f.box(g, hangar, 0, 12, shade(wall, 0.9), roof, { color: glass, rows: 1 });
    f.trimAt(g, f.p(hangar[0], hangar[3]), f.p(hangar[2], hangar[3]), 12, 1.5, glass, 0.9);
    f.trimAt(g, f.p(hangar[2], hangar[3]), f.p(hangar[2], hangar[1]), 12, 1.5, glass, 0.9);
    // Lit bay on the face toward the water.
    poly(
      g,
      [P(1.96, 1.42, 1), P(2.66, 1.42, 1), P(2.66, 1.42, 8), P(1.96, 1.42, 8)],
      glass,
      0.55,
    );
  });

  const gantry = R(2.1, 1.68, 2.82, 2.28);
  add(gantry, () => {
    for (const [u, v] of [
      [gantry[0], gantry[1]],
      [gantry[2], gantry[1]],
      [gantry[0], gantry[3]],
      [gantry[2], gantry[3]],
    ] as const) {
      f.post(g, u, v, 12, steel, 1.3);
    }
    f.trimAt(g, f.p(gantry[0], gantry[3]), f.p(gantry[2], gantry[3]), 12, 1.4, glass, 0.9);
    drawBoat(g, theme, P(2.46, 1.98, 5), towardWater, 'motor', theme.boats[0] as number, false, 0.85);
  });

  const rack = R(1.12, 1.68, 1.92, 2.26);
  add(rack, () => {
    for (const a of [1.32, 1.72]) {
      const cradle = P(a, 2.0);
      g.rect(cradle.x - 5, cradle.y - 1.2, 10, 1.4).fill(steel);
      drawBoat(
        g,
        theme,
        P(a, 2.0, 3),
        towardWater,
        a < 1.5 ? 'motor' : 'sail',
        theme.boats[a < 1.5 ? 1 : 2] as number,
        false,
        0.8,
      );
    }
  });

  items.sort((a, b) => a.depth - b.depth);
  for (const item of items) item.draw();
}

/** Dispatches a civic building to its cyberpunk drawing. */
export function drawCyberCivic(g: Graphics, theme: Theme, kind: string): boolean {
  switch (kind) {
    case 'policeStation':
      drawCyberPoliceStation(g, theme);
      return true;
    case 'fireStation':
      drawCyberFireStation(g, theme);
      return true;
    case 'school':
      drawCyberSchool(g, theme);
      return true;
    case 'hospital':
      drawCyberHospital(g, theme);
      return true;
    default:
      return false;
  }
}

/**
 * Datacenter: a low hall, not a tower. Light strips run the length of the roof and a cooling
 * block sits on the back corner. The classic renderer never asks for this silhouette.
 */
export function drawCyberDatacenter(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'qanat.wall');
  const roof = color(theme, 'qanat.roof');
  const canal = color(theme, 'infra.canal');
  const dark = color(theme, 'infra.canalDark');

  f.box(g, [0.12, 0.35, 1.88, 1.82], 0, 14, wall, roof);
  f.trimAt(g, f.p(0.2, 1.82), f.p(1.8, 1.82), 6, 1.4, canal, 0.95);
  f.trimAt(g, f.p(0.2, 1.82), f.p(1.8, 1.82), 10, 1.1, canal, 0.7);
  f.trimAt(g, f.p(1.88, 0.5), f.p(1.88, 1.7), 8, 1.2, canal, 0.85);

  // Cooling block on the back of the hall, banded so it reads as plant rather than a tower.
  f.box(g, [0.28, 0.42, 0.85, 0.95], 14, 8, shade(wall, 0.85), shade(roof, 1.1));
  for (let k = 0; k < 3; k++) {
    const u = 0.38 + k * 0.16;
    f.line(g, f.p(u, 0.95), f.p(u, 0.98), 1.2, dark, 16, 0.9);
  }
  const vent = f.p(0.55, 0.68, 22);
  g.circle(vent.x, vent.y, 3.2).fill({ color: canal, alpha: 0.35 });
  g.circle(vent.x, vent.y, 1.5).fill(canal);

  // Door lamp, so the hall has a front at a glance.
  const door = f.p(1.35, 1.82, 4);
  lamp(g, door.x, door.y, canal, 1.2);
}

/** Edge node: a street cabinet with one lit spine. The classic renderer never draws it. */
export function drawCyberEdgeNode(g: Graphics, theme: Theme): void {
  const f = new Frame(1);
  const wall = color(theme, 'qanat.wall');
  const roof = color(theme, 'qanat.roof');
  const canal = color(theme, 'infra.canal');

  f.box(g, [0.28, 0.32, 0.72, 0.78], 0, 18, wall, roof);
  f.trimAt(g, f.p(0.72, 0.4), f.p(0.72, 0.7), 8, 1.5, canal, 0.95);
  const tip = f.post(g, 0.5, 0.4, 8, shade(wall, 1.1), 1.4, 18);
  lamp(g, tip.x, tip.y, canal, 1.3);
}

/** Dispatches a utility building to its cyberpunk drawing. */
export function drawCyberUtility(g: Graphics, theme: Theme, kind: string, _size: number): boolean {
  switch (kind) {
    case 'coalPlant':
      drawCyberCoalPlant(g, theme);
      return true;
    case 'gasPlant':
      drawCyberGasPlant(g, theme);
      return true;
    case 'windTurbine':
      drawCyberWindTurbine(g, theme);
      return true;
    case 'waterPump':
      drawCyberWaterPump(g, theme);
      return true;
    case 'well':
      drawCyberWell(g, theme);
      return true;
    case 'springHouse':
      drawCyberDatacenter(g, theme);
      return true;
    case 'palm':
      drawCyberEdgeNode(g, theme);
      return true;
    default:
      return false;
  }
}
