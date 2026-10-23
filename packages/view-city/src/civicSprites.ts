import type { Graphics } from 'pixi.js';
import { color, shade, type Theme } from '@theme/core';
import type { Point } from './iso';
import { Frame, poly } from './isoFrame';

/**
 * Civic service buildings: police, fire, school and hospital.
 *
 * All four used to be the same plain box with a different paint job, which read as filler next to
 * the zoned lots. Each one now has the silhouette of what it does — a watch tower, a ready bay, a
 * classroom wing, a ward block — so the service layer is legible at a glance.
 */

/** Police station: a squat precinct with a glazed watch tower and a rooftop light. */
export function drawPoliceStation(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'police.wall');
  const roof = color(theme, 'police.roof');
  const glass = color(theme, 'police.window');
  const star = color(theme, 'police.star');

  f.box(g, [0.12, 0.12, 1.88, 1.88], 0, 20, wall, roof, { color: glass, rows: 2 });
  // Front canopy over the entrance.
  f.quad(g, 0.2, 1.86, 1.1, 1.86, shade(roof, 1.25), 13);
  f.post(g, 0.24, 1.86, 13, shade(wall, 0.85), 2.2);
  f.post(g, 1.06, 1.86, 13, shade(wall, 0.85), 2.2);

  // Watch tower on the rear corner: glass drum, cap and the badge on the wall.
  f.box(g, [1.0, 0.18, 1.8, 0.98], 20, 16, wall, roof, { color: glass, rows: 1 });
  const cap = f.box(g, [0.94, 0.12, 1.86, 1.04], 36, 4, shade(roof, 1.15), roof);
  const c = cap[0] as Point;
  const pole = f.post(g, 1.42, 0.58, 10, color(theme, 'lot.antennaPole'), 1.4, 40);
  const blink = { x: (pole.x + c.x) / 2, y: pole.y };
  g.circle(blink.x, blink.y, 3.4).fill({ color: star, alpha: 0.24 });
  g.circle(blink.x, blink.y, 1.6).fill(star);

  // Badge plate beside the door.
  const face = f.p(0.62, 1.88, 12);
  g.circle(face.x, face.y, 6).fill(shade(star, 0.8));
  g.circle(face.x, face.y, 4.2).fill({ color: star, alpha: 0.9 });
}

/** Fire station: a wide apparatus bay with red doors and a drill tower behind it. */
export function drawFireStation(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'fire.wall');
  const roof = color(theme, 'fire.roof');
  const glass = color(theme, 'fire.window');
  const door = color(theme, 'fire.door');

  f.box(g, [0.1, 0.42, 1.9, 1.88], 0, 16, wall, roof, { color: glass, rows: 1 });
  // Apparatus bays: two tall doors on the front face, each with its lintel lamp.
  const bays = [
    [0.28, 0.86],
    [1.02, 1.6],
  ] as const;
  for (const [u0, u1] of bays) {
    f.quad(g, u0, 1.88, u1, 1.88, door, 10);
    f.quad(g, u0 + 0.04, 1.88, u1 - 0.04, 1.88, shade(door, 0.72), 8);
    const lamp = f.p((u0 + u1) / 2, 1.88, 12.5);
    g.circle(lamp.x, lamp.y, 3.6).fill({ color: glass, alpha: 0.3 });
    g.circle(lamp.x, lamp.y, 1.4).fill(glass);
  }
  // Drill tower, set back so it clears the bay roof.
  f.box(g, [1.24, 0.14, 1.86, 0.72], 16, 26, wall, roof, { color: glass, rows: 3 });
  const beaconBase = f.p(1.55, 0.43, 42);
  g.circle(beaconBase.x, beaconBase.y, 4.2).fill({ color: glass, alpha: 0.26 });
  g.circle(beaconBase.x, beaconBase.y, 1.8).fill(glass);
}

/** School: a classroom wing, a gym with a barrel roof and a flagpole in the yard. */
export function drawSchool(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'school.wall');
  const roof = color(theme, 'school.roof');
  const glass = color(theme, 'school.window');
  const pole = color(theme, 'school.pole');
  const flag = color(theme, 'school.flag');

  // Classroom wing: three floors with a window band on each.
  f.box(g, [0.12, 0.14, 1.88, 0.9], 0, 20, wall, roof, { color: glass, rows: 3 });
  // Entrance canopy over the door at the front of the wing.
  f.quad(g, 0.5, 0.9, 1.0, 0.9, shade(roof, 1.22), 10);
  f.post(g, 0.54, 0.9, 10, shade(wall, 0.85), 1.8);
  f.post(g, 0.96, 0.9, 10, shade(wall, 0.85), 1.8);

  // Gym: a lower block whose barrel roof runs across the footprint.
  f.box(g, [0.16, 1.02, 1.12, 1.88], 0, 13, shade(wall, 1.06), shade(roof, 1.1), { color: glass, rows: 1 });
  // Barrel roof: a half-cylinder, drawn as a band of segments so it reads as curved.
  const gymRoof = 13;
  const u0 = 0.16;
  const u1 = 1.12;
  const segs = 7;
  for (let i = 0; i < segs; i++) {
    const a = u0 + ((u1 - u0) * i) / segs;
    const b = u0 + ((u1 - u0) * (i + 1)) / segs;
    const lift = (t: number) => Math.sin(t * Math.PI) * 8;
    const ta = i / segs;
    const tb = (i + 1) / segs;
    // Front face of the vault.
    poly(
      g,
      [
        f.p(a, 1.88, gymRoof),
        f.p(b, 1.88, gymRoof),
        f.p(b, 1.88, gymRoof + lift(tb)),
        f.p(a, 1.88, gymRoof + lift(ta)),
      ],
      shade(roof, 1.24),
    );
    // Ridge highlight so the curve reads.
    poly(
      g,
      [
        f.p(a, 1.88, gymRoof + lift(ta)),
        f.p(b, 1.88, gymRoof + lift(tb)),
        f.p(b, 1.88, gymRoof + lift(tb) - 1.4),
        f.p(a, 1.88, gymRoof + lift(ta) - 1.4),
      ],
      shade(roof, 1.42),
    );
  }
  // The back half of the vault, so the roof is not a flat cut.
  for (let i = 0; i < segs; i++) {
    const a = u0 + ((u1 - u0) * i) / segs;
    const b = u0 + ((u1 - u0) * (i + 1)) / segs;
    const lift = (t: number) => Math.sin(t * Math.PI) * 8;
    const ta = i / segs;
    const tb = (i + 1) / segs;
    poly(
      g,
      [
        f.p(a, 1.02, gymRoof + lift(ta)),
        f.p(b, 1.02, gymRoof + lift(tb)),
        f.p(b, 1.88, gymRoof + lift(tb)),
        f.p(a, 1.88, gymRoof + lift(ta)),
      ],
      shade(roof, 1.16),
    );
  }

  // Yard: paved apron with the flagpole.
  f.quad(g, 1.22, 1.04, 1.88, 1.88, color(theme, 'park.ground'), 0.6);
  const poleTip = f.post(g, 1.52, 1.5, 30, pole, 1.3, 1);
  g.moveTo(poleTip.x, poleTip.y)
    .lineTo(poleTip.x + 13, poleTip.y + 4)
    .lineTo(poleTip.x + 13, poleTip.y + 10)
    .lineTo(poleTip.x, poleTip.y + 6)
    .closePath()
    .fill(flag);
}

/** Hospital: a tall ward block with a rooftop helipad and a lit red cross on the facade. */
export function drawHospital(g: Graphics, theme: Theme): void {
  const f = new Frame(2);
  const wall = color(theme, 'hospital.wall');
  const roof = color(theme, 'hospital.roof');
  const glass = color(theme, 'hospital.window');
  const cross = color(theme, 'hospital.cross');

  // Ward block: the tall part, with a vertical window band and a service core on top.
  f.box(g, [0.14, 0.2, 1.16, 1.88], 0, 36, wall, roof, { color: glass, rows: 6 });
  f.box(g, [0.3, 0.34, 0.74, 0.7], 36, 7, shade(wall, 0.94), shade(roof, 0.94));
  // Plant room on the roof, set to one side so it does not sit on the helipad.
  f.box(g, [0.22, 0.28, 0.5, 0.62], 43, 9, shade(wall, 1.04), shade(roof, 1.06));
  g.rect(f.p(0.36, 0.45, 52).x - 4, f.p(0.36, 0.45, 52).y - 8, 8, 8).fill(shade(roof, 0.8));

  // Helipad: a flat marked pad, not a dome. The circle is the pad, the H is the marking.
  const pad = f.p(0.95, 1.28, 36);
  g.ellipse(pad.x, pad.y, 15, 7.5).fill(shade(roof, 0.72));
  g.ellipse(pad.x, pad.y, 12.5, 6.2).fill(shade(roof, 0.86));
  g.ellipse(pad.x, pad.y, 10.5, 5.2).fill({ color: glass, alpha: 0.5 });
  // The H painted on the pad.
  g.rect(pad.x - 4.2, pad.y - 3.4, 1.8, 6.8).fill(shade(roof, 0.45));
  g.rect(pad.x + 2.4, pad.y - 3.4, 1.8, 6.8).fill(shade(roof, 0.45));
  g.rect(pad.x - 4.2, pad.y - 0.8, 8.4, 1.6).fill(shade(roof, 0.45));
  // Perimeter lights around the pad.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.circle(pad.x + Math.cos(a) * 13.5, pad.y + Math.sin(a) * 6.6, 1.3).fill({
      color: glass,
      alpha: 0.8,
    });
  }

  // Podium in front, with the ambulance bay under a canopy.
  f.box(g, [1.16, 0.86, 1.88, 1.88], 0, 13, shade(wall, 0.96), shade(roof, 0.95), { color: glass, rows: 1 });
  f.quad(g, 1.24, 1.88, 1.8, 1.88, shade(roof, 0.55), 9);
  // Red cross mounted on the front wall of the ward block, drawn as a flat billboard so it stays
  // upright instead of lying on the ground plane.
  const c = f.p(0.66, 1.9, 27);
  g.rect(c.x - 7, c.y - 2.2, 14, 4.4).fill(cross);
  g.rect(c.x - 2.2, c.y - 7, 4.4, 14).fill(cross);
  g.rect(c.x - 7, c.y - 2.2, 14, 1.1).fill(shade(cross, 1.3));
  g.rect(c.x - 2.2, c.y - 7, 1.1, 14).fill(shade(cross, 1.3));
}

/** Dispatches a civic building to its own drawing; the caller knows the kind. */
export function drawCivic(g: Graphics, theme: Theme, kind: string): boolean {
  switch (kind) {
    case 'policeStation':
      drawPoliceStation(g, theme);
      return true;
    case 'fireStation':
      drawFireStation(g, theme);
      return true;
    case 'school':
      drawSchool(g, theme);
      return true;
    case 'hospital':
      drawHospital(g, theme);
      return true;
    default:
      return false;
  }
}
