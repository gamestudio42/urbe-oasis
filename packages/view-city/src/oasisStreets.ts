import { Infra, ZoneDensity } from '@city/shared';
import { Connection, type World } from '@city/simulation';
import { color, mix, shade, tileHash, type Theme } from '@theme/core';
import type { Graphics } from 'pixi.js';
import { ROAD_INSET } from './bridge';
import { tileLocalToScreen, type Point } from './iso';

type Quad = [Point, Point, Point, Point];
type Cell = { col: number; row: number };
const CUTS = [0, ROAD_INSET, 1 - ROAD_INSET, 1] as const;
const DIRECTIONS = [
  { bit: Connection.North, dx: 0, dy: -1 },
  { bit: Connection.East, dx: 1, dy: 0 },
  { bit: Connection.South, dx: 0, dy: 1 },
  { bit: Connection.West, dx: -1, dy: 0 },
] as const;
const NEIGHBORS = [
  ...DIRECTIONS,
  { dx: -1, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 1 },
  { dx: 1, dy: 1 },
];

/** The existing road footprint, partitioned into cells so curbs never cut through a join. */
export function oasisRoadCells(mask: number): Cell[] {
  const cells = [{ col: 1, row: 1 }];
  for (const d of DIRECTIONS) if (mask & d.bit) cells.push({ col: 1 + d.dx, row: 1 + d.dy });
  return cells;
}

function quad(
  g: Graphics,
  q: Quad,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  fill: number,
  alpha = 1,
): void {
  const pts = [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ].map(([u, v]) => tileLocalToScreen(q, u!, v!));
  g.poly(pts.flatMap((p) => [p.x, p.y])).fill({ color: fill, alpha });
}

function line(
  g: Graphics,
  q: Quad,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  fill: number,
  width: number,
  alpha = 1,
): void {
  const a = tileLocalToScreen(q, u0, v0),
    b = tileLocalToScreen(q, u1, v1);
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: fill, width, alpha });
}

/** Streets use the real connections and existing lane width. Nothing here grants services. */
export function drawOasisStreet(
  g: Graphics,
  theme: Theme,
  world: World,
  x: number,
  y: number,
  q: Quad,
  mask: number,
  details: boolean,
): void {
  const pavement = color(theme, 'ground.bareLot');
  const edge = color(theme, 'road.edge');
  const surface = mix(color(theme, 'road.surface'), edge, 0.23);
  const infra = world.infra[world.index(x, y)]!;
  const urban =
    (infra & Infra.Canal) === 0 &&
    NEIGHBORS.some(({ dx, dy }) => {
      if (!world.inBounds(x + dx, y + dy)) return false;
      const i = world.index(x + dx, y + dy);
      return !world.isWater(i) && (world.zone[i] !== 0 || world.buildingId[i] !== 0);
    });
  const cells = oasisRoadCells(mask);
  const occupied = (col: number, row: number) => cells.some((c) => c.col === col && c.row === row);
  if (urban) {
    quad(g, q, 0, 0, 1, 1, shade(pavement, 0.94));
    // Only the unoccupied cells carry paving joints. Driving lanes remain clear.
    if (details)
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 3; col++) {
          if (occupied(col, row)) continue;
          const u0 = CUTS[col]!,
            v0 = CUTS[row]!,
            u1 = CUTS[col + 1]!,
            v1 = CUTS[row + 1]!;
          const u = (u0 + u1) / 2,
            v = (v0 + v1) / 2;
          line(g, q, u0, v, u1, v, edge, 0.5, 0.24);
          line(g, q, u, v0, u, v1, edge, 0.5, 0.24);
        }
  }
  for (const { col, row } of cells) {
    const u0 = CUTS[col]!,
      v0 = CUTS[row]!,
      u1 = CUTS[col + 1]!,
      v1 = CUTS[row + 1]!;
    quad(g, q, u0, v0, u1, v1, surface);
    // Edges at tile boundaries are open connections. Interior boundaries meet the sidewalk.
    for (const d of DIRECTIONS) {
      const nc = col + d.dx,
        nr = row + d.dy;
      if (nc < 0 || nc > 2 || nr < 0 || nr > 2 || occupied(nc, nr)) continue;
      const a = d.dx === 1 ? u1 : u0,
        b = d.dy === 1 ? v1 : v0;
      const c = d.dx === -1 ? u0 : u1,
        e = d.dy === -1 ? v0 : v1;
      line(g, q, a, b, c, e, edge, urban ? 2.1 : 1, 0.7);
      if (urban) line(g, q, a, b, c, e, pavement, 0.85, 0.85);
    }
  }
  const exits = DIRECTIONS.filter((d) => (mask & d.bit) !== 0);
  if (!details) return;
  if (urban && exits.length >= 3) {
    // Pale inset stone crossings; no traffic or pedestrian rules are implied by the paint.
    for (const d of exits)
      for (let k = 0; k < 4; k++) {
        const a = 0.27 + k * 0.12,
          b = a + 0.065;
        if (d.dy) {
          const v = d.dy < 0 ? 0.1 : 0.82;
          quad(g, q, a, v, b, v + 0.08, pavement, 0.8);
        } else {
          const u = d.dx < 0 ? 0.1 : 0.82;
          quad(g, q, u, a, u + 0.08, b, pavement, 0.8);
        }
      }
  } else if (exits.length <= 2) {
    // Subtle wheel wear replaces painted highway dashes on packed desert streets.
    const straightX = (mask & (Connection.North | Connection.South)) === 0;
    const straightY = (mask & (Connection.East | Connection.West)) === 0;
    if (straightX || straightY)
      for (const lane of [0.36, 0.64]) {
        if (straightX)
          line(
            g,
            q,
            mask & Connection.West ? 0 : ROAD_INSET,
            lane,
            mask & Connection.East ? 1 : 1 - ROAD_INSET,
            lane,
            pavement,
            1.2,
            0.16,
          );
        else
          line(
            g,
            q,
            lane,
            mask & Connection.North ? 0 : ROAD_INSET,
            lane,
            mask & Connection.South ? 1 : 1 - ROAD_INSET,
            pavement,
            1.2,
            0.16,
          );
      }
  }
  // One low bench, limited to a paved corner; never across a road, canal or power pole.
  if (urban && (infra & (Infra.Canal | Infra.PowerLine)) === 0 && tileHash(x + 11, y - 5) < 0.18) {
    const a = tileLocalToScreen(q, 0.05, 0.87),
      b = tileLocalToScreen(q, 0.17, 0.87);
    const wood = color(theme, 'tree.trunk');
    g.moveTo(a.x, a.y)
      .lineTo(a.x, a.y - 2)
      .moveTo(b.x, b.y)
      .lineTo(b.x, b.y - 2)
      .stroke({ color: edge, width: 1 });
    g.moveTo(a.x, a.y - 2)
      .lineTo(b.x, b.y - 2)
      .stroke({ color: wood, width: 2 });
  }
}

/** Quiet parcels keep their zoning identity, with full blueprints restored during planning. */
export function drawOasisParcel(
  g: Graphics,
  theme: Theme,
  world: World,
  x: number,
  y: number,
  q: Quad,
  planning: boolean,
): void {
  const i = world.index(x, y),
    zone = world.zone[i]!;
  const zc = theme.zone[zone]!;
  const dense = world.zoneDensity[i] === ZoneDensity.Dense;
  if (world.buildingId[i] !== 0) {
    quad(
      g,
      q,
      0.02,
      0.02,
      0.98,
      0.98,
      mix(theme.lot[zone]!, color(theme, 'ground.bareLot'), planning ? 0.3 : 0.92),
    );
    return;
  }
  quad(g, q, 0.06, 0.06, 0.94, 0.94, zc, planning ? 0.25 : 0.055);
  const compatible = (dx: number, dy: number) => {
    if (!world.inBounds(x + dx, y + dy)) return false;
    const j = world.index(x + dx, y + dy);
    return world.zone[j] === zone && world.zoneDensity[j] === world.zoneDensity[i];
  };
  for (const d of DIRECTIONS) {
    if (!planning && compatible(d.dx, d.dy)) continue;
    const a = d.dx === 1 ? 0.94 : 0.06,
      b = d.dy === 1 ? 0.94 : 0.06;
    const c = d.dx === -1 ? 0.06 : 0.94,
      e = d.dy === -1 ? 0.06 : 0.94;
    line(g, q, a, b, c, e, zc, planning ? 1.5 : 0.75, planning ? 0.9 : 0.36);
  }
  if (planning && dense) {
    for (const [a, b, c, d] of [
      [0.25, 0.25, 0.75, 0.25],
      [0.75, 0.25, 0.75, 0.75],
      [0.75, 0.75, 0.25, 0.75],
      [0.25, 0.75, 0.25, 0.25],
    ])
      line(g, q, a!, b!, c!, d!, zc, 1.5, 0.9);
  } else if (!planning) {
    // Survey pegs remain visible within a merged district, without a carpet of nested squares.
    for (const u of dense ? [0.46, 0.54] : [0.5]) {
      const p = tileLocalToScreen(q, u, 0.5);
      g.circle(p.x, p.y, 0.8).fill({ color: zc, alpha: 0.55 });
    }
  }
}
