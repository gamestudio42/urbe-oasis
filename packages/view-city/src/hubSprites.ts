import type { Graphics } from 'pixi.js';
import { color, shade, type Theme } from '@theme/core';
import { TILE_H, TILE_W, type Point } from './iso';

const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;

function poly(g: Graphics, points: Point[], fill: number, alpha = 1): void {
  g.poly(points.flatMap((p) => [p.x, p.y])).fill({ color: fill, alpha });
}

function segment(g: Graphics, a: Point, b: Point, width: number, fill: number, alpha = 1): void {
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width, color: fill, alpha });
}

/** Screen offset of a ground offset given in grid units. */
function iso(gx: number, gy: number): Point {
  return { x: (gx - gy) * HALF_W, y: (gx + gy) * HALF_H };
}

/** Grid directions of the eight headings, clockwise from +x. */
export const HEADINGS: readonly Point[] = [
  { x: 1, y: 0 },
  { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: 0, y: 1 },
  { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: -1, y: 0 },
  { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
  { x: 0, y: -1 },
  { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
];

/** Nearest of the eight headings for a grid direction. */
export function headingIndex(dx: number, dy: number): number {
  const k = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return ((k % 8) + 8) % 8;
}

/**
 * Drawing frame on an n×n footprint whose front (south) vertex is the origin: `u` runs along +x
 * from the north corner, `v` along +y, both in tiles; `z` is a height in pixels.
 */
class Frame {
  constructor(readonly n: number) {}

  p(u: number, v: number, z = 0): Point {
    return { x: (u - v) * HALF_W, y: (u + v - 2 * this.n) * HALF_H - z };
  }

  quad(g: Graphics, u0: number, v0: number, u1: number, v1: number, fill: number, z = 0): void {
    poly(g, [this.p(u0, v0, z), this.p(u1, v0, z), this.p(u1, v1, z), this.p(u0, v1, z)], fill);
  }

  line(
    g: Graphics,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    width: number,
    fill: number,
    alpha = 1,
  ): void {
    segment(g, this.p(u0, v0), this.p(u1, v1), width, fill, alpha);
  }

  /** Box on the rectangle; draws the two visible walls (+v left, +u right) and the roof. */
  box(
    g: Graphics,
    r: Rect,
    z0: number,
    height: number,
    wall: number,
    roof: number,
    windows?: { color: number; rows: number },
  ): void {
    const [u0, v0, u1, v1] = r;
    const z1 = z0 + height;
    const p = (u: number, v: number, z: number) => this.p(u, v, z);
    poly(g, [p(u0, v1, z0), p(u1, v1, z0), p(u1, v1, z1), p(u0, v1, z1)], shade(wall, 0.78));
    poly(g, [p(u1, v1, z0), p(u1, v0, z0), p(u1, v0, z1), p(u1, v1, z1)], shade(wall, 0.95));
    poly(g, [p(u0, v0, z1), p(u1, v0, z1), p(u1, v1, z1), p(u0, v1, z1)], roof);
    if (windows) {
      this.windowRows(
        g,
        (t, z) => p(u0 + (u1 - u0) * t, v1, z),
        u1 - u0,
        z0,
        height,
        windows,
        0.85,
      );
      this.windowRows(g, (t, z) => p(u1, v1 - (v1 - v0) * t, z), v1 - v0, z0, height, windows, 1);
    }
  }

  private windowRows(
    g: Graphics,
    at: (t: number, z: number) => Point,
    length: number,
    z0: number,
    height: number,
    windows: { color: number; rows: number },
    light: number,
  ): void {
    const columns = Math.max(2, Math.round(length * 5));
    const rowH = height / windows.rows;
    for (let row = 0; row < windows.rows; row++) {
      const za = z0 + row * rowH + rowH * 0.3;
      const zb = z0 + row * rowH + rowH * 0.75;
      for (let c = 0; c < columns; c++) {
        const ta = (c + 0.2) / columns;
        const tb = (c + 0.8) / columns;
        poly(g, [at(ta, za), at(tb, za), at(tb, zb), at(ta, zb)], shade(windows.color, light));
      }
    }
  }

  /** Barrel roof on the rectangle at height `z`; the ridge runs along `axis`. */
  vault(
    g: Graphics,
    r: Rect,
    z: number,
    rise: number,
    fill: number,
    wall: number,
    axis: 'u' | 'v',
  ): void {
    const [u0, v0, u1, v1] = r;
    const steps = 6;
    const lift = (k: number) => z + rise * Math.sin((Math.PI * k) / steps);
    for (let k = 0; k < steps; k++) {
      const tone = k < steps / 2 ? 1.08 : 0.86;
      const c = shade(fill, tone - (k % 2) * 0.04);
      if (axis === 'u') {
        const va = v0 + ((v1 - v0) * k) / steps;
        const vb = v0 + ((v1 - v0) * (k + 1)) / steps;
        poly(
          g,
          [
            this.p(u0, va, lift(k)),
            this.p(u1, va, lift(k)),
            this.p(u1, vb, lift(k + 1)),
            this.p(u0, vb, lift(k + 1)),
          ],
          c,
        );
      } else {
        const ua = u0 + ((u1 - u0) * k) / steps;
        const ub = u0 + ((u1 - u0) * (k + 1)) / steps;
        poly(
          g,
          [
            this.p(ua, v0, lift(k)),
            this.p(ub, v0, lift(k + 1)),
            this.p(ub, v1, lift(k + 1)),
            this.p(ua, v1, lift(k)),
          ],
          c,
        );
      }
    }
    // Arched gable on the visible end of the barrel.
    const gable: Point[] = [];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      gable.push(
        axis === 'u'
          ? this.p(u1, v0 + (v1 - v0) * t, lift(k))
          : this.p(u0 + (u1 - u0) * t, v1, lift(k)),
      );
    }
    gable.push(this.p(u1, v1, z));
    gable.push(axis === 'u' ? this.p(u1, v0, z) : this.p(u0, v1, z));
    poly(g, gable, shade(wall, axis === 'u' ? 0.95 : 0.78));
  }

  /** Vertical post standing on (u, v). */
  post(g: Graphics, u: number, v: number, height: number, fill: number, width = 1.4): Point {
    const base = this.p(u, v);
    g.rect(base.x - width / 2, base.y - height, width, height).fill(fill);
    return { x: base.x, y: base.y - height };
  }
}

/** Rectangle [u0, v0, u1, v1] in tiles. */
type Rect = [number, number, number, number];

/** Front-corner depth of a rectangle, for back-to-front ordering. */
const depth = (r: Rect) => r[2] + r[3];

// ---------------------------------------------------------------------------------------------
// Aircraft and boats, drawn around a point with a grid heading.

export const PLANE_LENGTH = 1.05;

interface Placed {
  /** Screen point of the grid-local offset (along the heading, across it) at height z. */
  at(a: number, c: number, z?: number): Point;
}

function placed(origin: Point, heading: Point, scale: number): Placed {
  return {
    at(a, c, z = 0) {
      const gx = (a * heading.x - c * heading.y) * scale;
      const gy = (a * heading.y + c * heading.x) * scale;
      const o = iso(gx, gy);
      return { x: origin.x + o.x, y: origin.y + o.y - z };
    },
  };
}

function mirrored(f: Placed, pts: [number, number][], z: number): [Point[], Point[]] {
  return [pts.map(([a, c]) => f.at(a, c, z)), pts.map(([a, c]) => f.at(a, -c, z))];
}

const FUSELAGE: [number, number][] = [
  [0.52, 0],
  [0.44, 0.05],
  [-0.36, 0.05],
  [-0.48, 0.02],
  [-0.48, -0.02],
  [-0.36, -0.05],
  [0.44, -0.05],
];
const WING: [number, number][] = [
  [0.1, 0.04],
  [-0.12, 0.48],
  [-0.21, 0.48],
  [-0.1, 0.04],
];
const TAILPLANE: [number, number][] = [
  [-0.34, 0.03],
  [-0.44, 0.19],
  [-0.49, 0.19],
  [-0.46, 0.03],
];

/** Airliner seen from above, centred on `origin` and lifted by `z` pixels. */
export function drawPlane(
  g: Graphics,
  theme: Theme,
  origin: Point,
  heading: Point,
  scale = 1,
  accent = 0x2f6fd0,
  z = 0,
): void {
  const f = placed(origin, heading, scale);
  const body = color(theme, 'plane.body');
  const wing = color(theme, 'plane.wing');
  for (const w of mirrored(f, WING, z + 2)) poly(g, w, wing);
  for (const c of [0.2, -0.2]) {
    poly(
      g,
      [
        f.at(0.02, c - 0.03, z + 1),
        f.at(0.02, c + 0.03, z + 1),
        f.at(-0.1, c + 0.03, z + 1),
        f.at(-0.1, c - 0.03, z + 1),
      ],
      color(theme, 'plane.engine'),
    );
  }
  poly(
    g,
    FUSELAGE.map(([a, c]) => f.at(a, c, z + 1)),
    shade(body, 0.7),
  );
  poly(
    g,
    FUSELAGE.map(([a, c]) => f.at(a, c, z + 3.5)),
    body,
  );
  for (const tail of mirrored(f, TAILPLANE, z + 3.5)) poly(g, tail, wing);
  segment(g, f.at(0.36, 0, z + 3.6), f.at(-0.3, 0, z + 3.6), 1, accent, 0.8);
  poly(
    g,
    [f.at(0.5, 0, z + 3.5), f.at(0.44, 0.035, z + 3.5), f.at(0.4, 0, z + 3.5), f.at(0.44, -0.035, z + 3.5)],
    color(theme, 'plane.cockpit'),
  );
  poly(g, [f.at(-0.33, 0, z + 3.5), f.at(-0.48, 0, z + 3.5), f.at(-0.5, 0, z + 12), f.at(-0.43, 0, z + 12)], accent);
}

/** Flat silhouette of the airliner for its ground shadow. */
export function drawPlaneShadow(
  g: Graphics,
  theme: Theme,
  origin: Point,
  heading: Point,
  scale = 1,
): void {
  const f = placed(origin, heading, scale);
  const shadow = color(theme, 'plane.shadow');
  for (const part of [...mirrored(f, WING, 0), ...mirrored(f, TAILPLANE, 0)]) poly(g, part, shadow);
  poly(
    g,
    FUSELAGE.map(([a, c]) => f.at(a, c, 0)),
    shadow,
  );
}

export type BoatKind = 'sail' | 'motor';

const HULL: [number, number][] = [
  [0.18, 0],
  [0.08, 0.065],
  [-0.16, 0.06],
  [-0.17, 0.035],
  [-0.17, -0.035],
  [-0.16, -0.06],
  [0.08, -0.065],
];

/** Small boat centred on `origin`; `wake` adds the foam trail of a moving boat. */
export function drawBoat(
  g: Graphics,
  theme: Theme,
  origin: Point,
  heading: Point,
  kind: BoatKind,
  hull: number,
  wake: boolean,
  scale = 1,
): void {
  const f = placed(origin, heading, scale);
  const foam = color(theme, 'boat.wake');
  if (wake) {
    for (const s of [1, -1]) {
      segment(g, f.at(-0.16, 0.05 * s), f.at(-0.5, 0.2 * s), 1.4, foam, 0.55);
      segment(g, f.at(-0.3, 0.1 * s), f.at(-0.62, 0.24 * s), 1, foam, 0.3);
    }
    poly(g, [f.at(0.2, 0), f.at(0.12, 0.08), f.at(0.12, -0.08)], foam, 0.5);
  }
  poly(
    g,
    HULL.map(([a, c]) => f.at(a, c, 0)),
    shade(hull, 0.7),
  );
  poly(
    g,
    HULL.map(([a, c]) => f.at(a, c, 2.5)),
    color(theme, 'boat.deck'),
  );
  segment(g, f.at(0.1, 0.058, 2.5), f.at(-0.15, 0.055, 2.5), 1, hull, 0.9);
  segment(g, f.at(0.1, -0.058, 2.5), f.at(-0.15, -0.055, 2.5), 1, hull, 0.9);
  if (kind === 'motor') {
    const cabin: [number, number][] = [
      [0.05, 0.035],
      [-0.07, 0.04],
      [-0.07, -0.04],
      [0.05, -0.035],
    ];
    poly(
      g,
      cabin.map(([a, c]) => f.at(a, c, 2.5)),
      color(theme, 'boat.cabinLow'),
    );
    poly(
      g,
      cabin.map(([a, c]) => f.at(a, c, 5.5)),
      color(theme, 'boat.cabinHigh'),
    );
    segment(g, f.at(0.05, 0.035, 5), f.at(0.05, -0.035, 5), 1.4, color(theme, 'boat.window'));
  } else {
    const mast = f.at(0.03, 0, 2.5);
    const top = f.at(0.03, 0, 21 * scale);
    poly(g, [top, mast, f.at(-0.15, 0, 4)], color(theme, 'boat.sail'), 0.95);
    poly(g, [top, f.at(0.17, 0, 3.5), f.at(0.05, 0, 4)], color(theme, 'boat.sailShade'), 0.9);
    segment(g, mast, top, 1, color(theme, 'boat.mast'));
  }
}

// ---------------------------------------------------------------------------------------------
// Buildings.

/** Runway centreline on the airport footprint, in tiles from its north corner (u along +x). */
export const RUNWAY = { v: 3.27, u0: 0.4, u1: 3.75 } as const;

export function drawAirport(g: Graphics, theme: Theme): void {
  const f = new Frame(4);
  const asphalt = color(theme, 'airport.asphalt');
  const paint = color(theme, 'airport.paint');
  f.quad(g, 0.02, 0.02, 3.98, 3.98, color(theme, 'airport.grass'));
  // Apron, taxiway and the runway along the front edge.
  f.quad(g, 0.15, 1.2, 2.75, 2.5, color(theme, 'airport.apron'));
  f.quad(g, 0.15, 2.5, 3.85, 2.78, color(theme, 'airport.taxiway'));
  f.quad(g, 0.2, 2.78, 0.5, 2.88, color(theme, 'airport.taxiway'));
  f.quad(g, 3.5, 2.78, 3.8, 2.88, color(theme, 'airport.taxiway'));
  f.line(g, 0.25, 2.64, 3.75, 2.64, 1, color(theme, 'airport.yellow'), 0.9);
  for (const u of [0.9, 1.75]) f.line(g, u, 1.3, u, 2.5, 1, color(theme, 'airport.yellow'), 0.8);
  f.quad(g, 0.1, 2.88, 3.9, 3.66, asphalt);
  f.line(g, 0.14, 2.94, 3.86, 2.94, 1, paint, 0.85);
  f.line(g, 0.14, 3.6, 3.86, 3.6, 1, paint, 0.85);
  for (let k = 0; k < 9; k++) {
    const u = 0.72 + k * 0.32;
    f.line(g, u, RUNWAY.v, u + 0.16, RUNWAY.v, 1.4, paint, 0.9);
  }
  for (const [ua, ub] of [
    [0.16, 0.4],
    [3.6, 3.84],
  ] as const) {
    for (let j = 0; j < 6; j++) {
      const v = 3.0 + j * 0.105;
      if (Math.abs(v - RUNWAY.v) < 0.05) continue;
      f.line(g, ua, v, ub, v, 1.6, paint, 0.95);
    }
  }
  for (const v of [3.08, 3.46]) f.quad(g, 0.85, v - 0.04, 1.15, v + 0.04, paint);
  for (let k = 0; k <= 9; k++) {
    for (const v of [2.91, 3.63]) {
      const p = f.p(0.15 + k * 0.4, v);
      g.circle(p.x, p.y, 1).fill(color(theme, 'airport.light'));
    }
  }

  // Terminal with a glass front, rooftop plant and two boarding bridges.
  f.box(g, [0.25, 0.3, 2.55, 1.12], 0, 13, color(theme, 'airport.terminalWall'), color(theme, 'airport.terminalRoof'), {
    color: color(theme, 'airport.terminalWindow'),
    rows: 2,
  });
  f.box(g, [0.55, 0.45, 0.85, 0.7], 13, 3, color(theme, 'airport.unitWall'), color(theme, 'airport.unitRoof'));
  f.box(g, [1.6, 0.5, 2.0, 0.8], 13, 3, color(theme, 'airport.unitWall'), color(theme, 'airport.unitRoof'));
  for (const u of [0.85, 1.7]) {
    f.box(g, [u, 1.12, u + 0.12, 1.5], 5, 3.5, color(theme, 'airport.bridgeWall'), color(theme, 'airport.bridgeRoof'));
    f.post(g, u + 0.06, 1.45, 5, color(theme, 'airport.bridgeSupport'));
  }

  // Control tower in the back corner.
  f.box(g, [3.08, 0.42, 3.32, 0.66], 0, 34, color(theme, 'airport.towerWall'), color(theme, 'airport.towerCap'));
  f.box(g, [2.97, 0.31, 3.43, 0.77], 34, 7, color(theme, 'airport.towerGlass'), color(theme, 'airport.towerCap'));
  f.box(g, [3.02, 0.36, 3.38, 0.72], 41, 2, color(theme, 'airport.towerUnit'), color(theme, 'airport.towerWall'));
  const mast = f.p(3.2, 0.54, 43);
  g.rect(mast.x - 0.6, mast.y - 9, 1.2, 9).fill(color(theme, 'airport.mastPole'));
  g.circle(mast.x, mast.y - 9, 1.6).fill(color(theme, 'airport.mastLight'));

  drawPlane(g, theme, f.p(1.32, 1.86), HEADINGS[6] as Point, 0.72, color(theme, 'plane.accent'));

  // Hangar with a barrel roof and its door facing the taxiway.
  const hangar: Rect = [2.88, 1.15, 3.86, 2.38];
  f.box(g, hangar, 0, 10, color(theme, 'airport.hangarWall'), color(theme, 'airport.hangarWall'));
  f.vault(
    g,
    hangar,
    10,
    7,
    color(theme, 'airport.hangarRoof'),
    color(theme, 'airport.hangarWall'),
    'v',
  );
  const door = (u: number, z: number) => f.p(u, hangar[3], z);
  poly(g, [door(3.03, 0), door(3.71, 0), door(3.71, 11), door(3.03, 11)], color(theme, 'airport.hangarDoor'));
  for (let k = 1; k < 5; k++) {
    const u = 3.03 + k * 0.136;
    segment(g, door(u, 0), door(u, 11), 0.8, color(theme, 'airport.hangarDoorLine'), 0.8);
  }

  // Windsock beside the runway threshold.
  const sock = f.post(g, 3.92, 2.82, 11, color(theme, 'airport.windsockPole'), 1);
  poly(
    g,
    [sock, { x: sock.x + 7, y: sock.y + 1 }, { x: sock.x + 7, y: sock.y + 3 }, { x: sock.x, y: sock.y + 4 }],
    color(theme, 'airport.windsock'),
  );
}

/**
 * Marina on a 3×3 lot. `side` is where the water is: 0 = +y (front-left), 1 = +x (front-right),
 * 2 = -y, 3 = -x. The layout is drawn in shore coordinates (a along the shore, b towards the
 * water, which is at b = 3) and turned to match.
 */
export function drawMarina(g: Graphics, theme: Theme, side: number): void {
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
  const P = (a: number, b: number, z = 0) => {
    const [u, v] = toGrid(a, b);
    return f.p(u, v, z);
  };
  const R = (a0: number, b0: number, a1: number, b1: number): Rect => {
    const [ua, va] = toGrid(a0, b0);
    const [ub, vb] = toGrid(a1, b1);
    return [Math.min(ua, ub), Math.min(va, vb), Math.max(ua, ub), Math.max(va, vb)];
  };
  const quad = (r: Rect, fill: number) => f.quad(g, r[0], r[1], r[2], r[3], fill);
  const towardWater = HEADINGS[[2, 0, 6, 4][side] ?? 2] as Point;
  const ridge: 'u' | 'v' = side % 2 === 0 ? 'v' : 'u';
  const boatHull = [theme.boats[1] as number, theme.boats[0] as number];

  // Ground: paved lot, parking, slipway and the timber quay along the water.
  quad(R(0.03, 0.03, 2.97, 2.97), color(theme, 'marina.lot'));
  quad(R(0.12, 1.6, 1.05, 2.3), color(theme, 'marina.parking'));
  for (const a of [0.31, 0.5, 0.69, 0.88])
    segment(g, P(a, 1.62), P(a, 1.95), 0.8, color(theme, 'marina.paint'), 0.8);
  quad(R(2.15, 1.7, 2.85, 2.42), color(theme, 'marina.pad'));
  const wood = color(theme, 'marina.wood');
  quad(R(0, 2.42, 3, 3), wood);
  for (let k = 1; k < 20; k++)
    segment(g, P(k * 0.15, 2.42), P(k * 0.15, 3), 0.6, shade(wood, 0.78), 0.7);
  segment(g, P(0, 2.97), P(3, 2.97), 1.5, color(theme, 'marina.woodEdge'));
  for (const a of [2.35, 2.65])
    segment(g, P(a, 1.7), P(a, 3), 1, color(theme, 'marina.piling'), 0.9);

  const items: { r: Rect; draw: () => void }[] = [];
  const add = (r: Rect, draw: () => void) => items.push({ r, draw });

  const club = R(0.2, 0.25, 1.65, 1.35);
  add(club, () => {
    f.box(g, club, 0, 13, color(theme, 'marina.clubWall'), color(theme, 'marina.clubRoof'), {
      color: color(theme, 'marina.clubWindow'),
      rows: 1,
    });
    f.box(g, R(0.35, 0.4, 1.25, 1.12), 13, 7, color(theme, 'marina.clubWall'), color(theme, 'marina.clubRoof'), {
      color: color(theme, 'marina.clubUpperWindow'),
      rows: 1,
    });
    const flag = P(1.52, 1.25);
    g.rect(flag.x - 0.6, flag.y - 26, 1.2, 26).fill(color(theme, 'marina.flagPole'));
    g.rect(flag.x + 0.6, flag.y - 26, 8, 5).fill(color(theme, 'marina.flagCloth'));
    g.rect(flag.x + 0.6, flag.y - 23.5, 8, 1.2).fill(color(theme, 'marina.flagStripe'));
  });

  const shed = R(1.85, 0.2, 2.85, 1.55);
  add(shed, () => {
    f.box(g, shed, 0, 11, color(theme, 'marina.shedWall'), color(theme, 'marina.shedWall'));
    f.vault(g, shed, 11, 6, color(theme, 'marina.shedRoof'), color(theme, 'marina.shedWall'), ridge);
    // Big door on the end facing the water, when that end is one of the visible walls.
    if (side === 0 || side === 1) {
      const d = (a: number, z: number) => P(a, 1.55, z);
      poly(g, [d(2.02, 0), d(2.68, 0), d(2.68, 10), d(2.02, 10)], color(theme, 'marina.shedDoor'));
    }
  });

  const rack = R(1.15, 1.7, 1.95, 2.3);
  add(rack, () => {
    for (const a of [1.35, 1.75]) {
      for (const db of [-0.12, 0.12]) {
        const base = P(a, 2.0 + db);
        g.rect(base.x - 0.7, base.y - 4, 1.4, 4).fill(color(theme, 'marina.rackPost'));
      }
      drawBoat(
        g,
        theme,
        P(a, 2.0, 4),
        towardWater,
        a < 1.5 ? 'motor' : 'sail',
        a < 1.5 ? (boatHull[0] as number) : (boatHull[1] as number),
        false,
        0.9,
      );
    }
  });

  const lift = R(2.18, 1.82, 2.82, 2.38);
  add(lift, () => {
    const blue = color(theme, 'marina.lift');
    const top = [P(2.2, 1.85, 14), P(2.8, 1.85, 14), P(2.2, 2.35, 14), P(2.8, 2.35, 14)];
    drawBoat(g, theme, P(2.5, 2.1, 6), towardWater, 'motor', theme.boats[3] as number, false, 0.95);
    for (const [a, b] of [
      [2.2, 1.85],
      [2.8, 1.85],
      [2.2, 2.35],
      [2.8, 2.35],
    ] as const) {
      const base = P(a, b);
      g.rect(base.x - 0.9, base.y - 14, 1.8, 14).fill(blue);
    }
    segment(g, top[0] as Point, top[2] as Point, 2, shade(blue, 1.15));
    segment(g, top[1] as Point, top[3] as Point, 2, shade(blue, 1.15));
  });

  for (const a of [0.45, 1.3, 2.0]) {
    const r = R(a - 0.02, 2.5, a + 0.02, 2.54);
    add(r, () => {
      const base = P(a, 2.52);
      g.rect(base.x - 0.6, base.y - 9, 1.2, 9).fill(color(theme, 'marina.bollard'));
      g.circle(base.x, base.y - 9.5, 1.6).fill(color(theme, 'marina.bollardLight'));
    });
  }

  items.sort((x, y) => depth(x.r) - depth(y.r));
  for (const item of items) item.draw();
}
