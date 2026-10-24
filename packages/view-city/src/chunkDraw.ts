import {
  Infra,
  Terrain,
  ZoneDensity,
  type BuildingRecord,
  type InfluenceLayer,
} from '@city/shared';
import { Connection, connectionMask, type World } from '@city/simulation';
import { color, heatColor, goodColor, shade, tileHash, type Theme } from '@theme/core';
import { Container, Sprite, type Graphics } from 'pixi.js';
import { BRIDGE_DECK, BRIDGE_INSET, ROAD_INSET, isLandRoad } from './bridge';
import { HEIGHT_STEP, tileLocalToScreen, tileQuad, vertexToScreen, type Point } from './iso';
import { HEADINGS, drawBoat } from './hubSprites';
import { drawOasisLotDetails } from './oasisLotDetails';
import { desertTone, drawDesertSurface } from './desertSurface';
import type { SpriteFactory } from './sprites';

export type OverlayMode =
  | 'none'
  | 'pollution'
  | 'crime'
  | 'landValue'
  | 'traffic'
  | 'power'
  | 'water'
  | 'data'
  | 'police'
  | 'fireCover'
  | 'health'
  | 'education'
  | 'access';

export interface DrawContext {
  world: World;
  buildings: Map<number, BuildingRecord>;
  underground: boolean;
  grid: boolean;
  overlay: OverlayMode;
  animationFrame: number;
}

export interface ChunkArea {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Iterates tiles of the area back to front (by x + y). */
function forEachTile(area: ChunkArea, fn: (x: number, y: number) => void): void {
  const w = area.x1 - area.x0;
  const h = area.y1 - area.y0;
  for (let d = 0; d < w + h - 1; d++) {
    for (let lx = Math.max(0, d - h + 1); lx <= Math.min(d, w - 1); lx++) {
      fn(area.x0 + lx, area.y0 + d - lx);
    }
  }
}

/** Pumps and wells are the only buildings that matter while laying pipes. */
function isWaterSource(kind: string): boolean {
  return kind === 'waterPump' || kind === 'well';
}

function isDataSource(kind: string): boolean {
  return kind === 'springHouse' || kind === 'palm';
}

function fillQuad(g: Graphics, q: Point[], fill: number, alpha = 1): void {
  g.poly(q.flatMap((p) => [p.x, p.y])).fill({ color: fill, alpha });
}

function rect(q: [Point, Point, Point, Point], u0: number, v0: number, u1: number, v1: number): Point[] {
  return [
    tileLocalToScreen(q, u0, v0),
    tileLocalToScreen(q, u1, v0),
    tileLocalToScreen(q, u1, v1),
    tileLocalToScreen(q, u0, v1),
  ];
}

export function drawGround(g: Graphics, theme: Theme, ctx: DrawContext, area: ChunkArea): void {
  const { world } = ctx;
  const size = world.size;
  const infraLayer = world.infra;
  const skirtColor = color(theme, 'ground.skirt');
  const waterEdge = color(theme, 'ground.waterEdge');
  const undergroundWater = color(theme, 'ground.undergroundWater');
  const undergroundLand = color(theme, 'ground.undergroundLand');
  const bareLot = color(theme, 'ground.bareLot');
  const rubble = color(theme, 'infra.rubble');
  const flood = color(theme, 'infra.flood');
  const roadShadow = color(theme, 'infra.roadShadow');
  forEachTile(area, (x, y) => {
    const i = y * size + x;
    const q = tileQuad(world, x, y);
    const [n, e, s, w] = world.corners(x, y);
    const terrain = world.terrain[i] as number;
    const infra = infraLayer[i] as number;
    const jitter = theme.style === 'adobe' ? desertTone(x, y) : 0.975 + tileHash(x, y) * 0.05;
    const light = 1 + 0.16 * (e - w) + 0.1 * (s - n) + 0.025 * Math.min(n, e, s, w);
    let fill = shade(theme.terrain[terrain] ?? 0x777777, jitter * light);
    if (ctx.underground) {
      fill = terrain === Terrain.Water ? shade(undergroundWater, 0.8 + 0.12 * light) : shade(undergroundLand, 0.75 + 0.1 * light);
    }

    // Map edge skirts.
    if (y === size - 1) skirt(g, q[3], q[2], w, s, skirtColor);
    if (x === size - 1) skirt(g, q[2], q[1], s, e, skirtColor);

    fillQuad(g, q, fill);
    if (theme.style === 'adobe' && !ctx.underground && ctx.overlay === 'none')
      drawDesertSurface(g, theme, world, x, y, q);
    if (terrain === Terrain.Water && !ctx.underground) {
      g.poly(q.flatMap((p) => [p.x, p.y])).stroke({ width: 1, color: waterEdge, alpha: 0.25 });
      drawMarinaPiers(g, theme, ctx, x, y, q);
    }

    if (ctx.underground) {
      const id = world.buildingId[i] as number;
      if (id !== 0) {
        const b = ctx.buildings.get(id);
        if (b && isWaterSource(b.kind)) {
          fillQuad(g, rect(q, 0.06, 0.06, 0.94, 0.94), color(theme, 'overlay.waterOn'), 0.45);
        }
        if (b && isDataSource(b.kind)) {
          fillQuad(g, rect(q, 0.06, 0.06, 0.94, 0.94), color(theme, 'overlay.dataOn'), 0.45);
        }
      }
      if (infra & Infra.Pipe) drawPipe(g, theme, ctx, x, y, q);
      if (infra & Infra.Canal) drawFiber(g, theme, ctx, x, y, q);
      if (infra & Infra.Road) fillQuad(g, rect(q, 0.35, 0.35, 0.65, 0.65), roadShadow, 0.5);
      if (ctx.grid) outline(g, q, 0.08, color(theme, 'ground.outline'));
      return;
    }

    // Canals are shade on the surface in the adobe city, not a buried cable.
    if (theme.style === 'adobe' && (infra & Infra.Canal) !== 0) drawFiber(g, theme, ctx, x, y, q);

    const zone = world.zone[i] as number;
    const id = world.buildingId[i] as number;
    if (zone !== 0) {
      if (id !== 0) {
        fillQuad(g, rect(q, 0.04, 0.04, 0.96, 0.96), theme.lot[zone] ?? 0x999999);
        if (theme.style === 'adobe' && ctx.overlay === 'none') {
          const b = ctx.buildings.get(id);
          if (b) drawOasisLotDetails(g, theme, q, b);
        }
      } else {
        const zc = theme.zone[zone] ?? 0xffffff;
        fillQuad(g, rect(q, 0.1, 0.1, 0.9, 0.9), zc, 0.32);
        const border = rect(q, 0.1, 0.1, 0.9, 0.9);
        g.poly(border.flatMap((p) => [p.x, p.y])).stroke({ width: 1.5, color: zc, alpha: 0.9 });
        if (world.zoneDensity[i] === ZoneDensity.Dense) {
          const inner = rect(q, 0.25, 0.25, 0.75, 0.75);
          g.poly(inner.flatMap((p) => [p.x, p.y])).stroke({ width: 1.5, color: zc, alpha: 0.9 });
        }
      }
    } else if (id !== 0) {
      const b = ctx.buildings.get(id);
      if (b && b.kind !== 'park') fillQuad(g, rect(q, 0.02, 0.02, 0.98, 0.98), bareLot);
    }

    if (infra & Infra.Rubble) {
      fillQuad(g, rect(q, 0.1, 0.1, 0.9, 0.9), rubble);
      for (let k = 0; k < 5; k++) {
        const p = tileLocalToScreen(q, 0.2 + tileHash(x + k, y) * 0.6, 0.2 + tileHash(x, y + k) * 0.6);
        g.circle(p.x, p.y, 2).fill(shade(rubble, 0.7));
      }
    }

    if ((world.flood[i] as number) > 0) fillQuad(g, q, flood, 0.6);
    if (ctx.grid) outline(g, q, 0.08, color(theme, 'ground.outline'));
  });
}

/**
 * Roads and bridge decks, drawn above boats so a boat sailing a water tile slips under the
 * span instead of painting over it. Cars stay in the vehicles layer, above this one.
 */
export function drawRoads(g: Graphics, theme: Theme, ctx: DrawContext, area: ChunkArea): void {
  if (ctx.underground) return;
  const { world } = ctx;
  const size = world.size;
  const infraLayer = world.infra;
  forEachTile(area, (x, y) => {
    const i = y * size + x;
    if (!((infraLayer[i] as number) & Infra.Road)) return;
    drawRoad(g, theme, ctx, x, y, tileQuad(world, x, y), world.terrain[i] === Terrain.Water);
  });
}

function marinaAt(ctx: DrawContext, x: number, y: number): boolean {
  if (!ctx.world.inBounds(x, y)) return false;
  const id = ctx.world.buildingId[ctx.world.index(x, y)] as number;
  if (id === 0) return false;
  return ctx.buildings.get(id)?.kind === 'marina';
}

/** Side of a building with the most water beside it: 0 = +y, 1 = +x, 2 = -y, 3 = -x. */
export function waterSide(world: World, b: Pick<BuildingRecord, 'x' | 'y' | 'w' | 'h'>): number {
  const count = [0, 0, 0, 0];
  const water = (x: number, y: number) => world.inBounds(x, y) && world.isWater(world.index(x, y));
  for (let k = 0; k < b.w; k++) {
    if (water(b.x + k, b.y + b.h)) count[0]!++;
    if (water(b.x + k, b.y - 1)) count[2]!++;
  }
  for (let k = 0; k < b.h; k++) {
    if (water(b.x + b.w, b.y + k)) count[1]!++;
    if (water(b.x - 1, b.y + k)) count[3]!++;
  }
  let best = 0;
  for (let s = 1; s < 4; s++) if ((count[s] as number) > (count[best] as number)) best = s;
  return best;
}

const PIER_LIFT = 2;

/**
 * Jetty on a water tile beside a marina: a walkway out from the quay, two finger piers and
 * boats moored between them (chosen by a stable hash of the tile).
 */
function drawMarinaPiers(
  g: Graphics,
  theme: Theme,
  ctx: DrawContext,
  x: number,
  y: number,
  q: [Point, Point, Point, Point],
): void {
  // Tile-local (u, v) of a point `out` tiles from the quay and `along` it.
  let local: ((along: number, out: number) => [number, number]) | null = null;
  let heading = 0;
  if (marinaAt(ctx, x, y - 1)) {
    local = (a, o) => [a, o];
    heading = 0;
  } else if (marinaAt(ctx, x - 1, y)) {
    local = (a, o) => [o, a];
    heading = 2;
  } else if (marinaAt(ctx, x, y + 1)) {
    local = (a, o) => [a, 1 - o];
    heading = 0;
  } else if (marinaAt(ctx, x + 1, y)) {
    local = (a, o) => [1 - o, a];
    heading = 2;
  }
  if (!local) return;
  const at = (a: number, o: number, lift = 0) => {
    const [u, v] = (local as (a: number, o: number) => [number, number])(a, o);
    const p = tileLocalToScreen(q, u, v);
    return { x: p.x, y: p.y - lift };
  };
  const pierWood = color(theme, 'marina.pierWood');
  const pierSide = color(theme, 'marina.pierSide');
  const deck = (a0: number, o0: number, a1: number, o1: number) => {
    const corners = [at(a0, o0), at(a1, o0), at(a1, o1), at(a0, o1)];
    fillQuad(g, corners, pierSide);
    fillQuad(
      g,
      corners.map((p) => ({ x: p.x, y: p.y - PIER_LIFT })),
      pierWood,
    );
  };
  const boatAt = (a: number, o: number, slot: number) => {
    const roll = tileHash(x * 7 + slot, y * 13 + slot);
    if (roll < 0.25) return;
    const kind = roll > 0.62 ? 'sail' : 'motor';
    const hull = theme.boats[Math.floor(roll * 97) % theme.boats.length] as number;
    drawBoat(g, theme, at(a, o), HEADINGS[heading] as Point, kind, hull, false, 0.85);
  };
  boatAt(0.27, 0.26, 0);
  boatAt(0.73, 0.26, 1);
  deck(0.44, 0, 0.56, 0.95);
  deck(0.08, 0.44, 0.92, 0.52);
  boatAt(0.27, 0.7, 2);
  boatAt(0.73, 0.7, 3);
  deck(0.18, 0.88, 0.82, 0.95);
  if (theme.style === 'cyber') {
    const glow = color(theme, 'marina.clubWindow');
    const lip = (a0: number, o0: number, a1: number, o1: number) => {
      const from = at(a0, o0, PIER_LIFT);
      const to = at(a1, o1, PIER_LIFT);
      g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width: 1.1, color: glow, alpha: 0.8 });
    };
    lip(0.08, 0.52, 0.92, 0.52);
    lip(0.18, 0.95, 0.82, 0.95);
  }
  for (const a of [0.44, 0.56]) {
    const p = at(a, 0.95, PIER_LIFT);
    g.rect(p.x - 0.5, p.y, 1, 3).fill(pierSide);
  }
}

function outline(g: Graphics, q: Point[], alpha: number, fill: number): void {
  g.poly(q.flatMap((p) => [p.x, p.y])).stroke({ width: 1, color: fill, alpha });
}

function skirt(g: Graphics, a: Point, b: Point, ha: number, hb: number, fill: number): void {
  const depth = 2 * HEIGHT_STEP;
  g.poly([
    a.x,
    a.y,
    b.x,
    b.y,
    b.x,
    b.y + depth + hb * HEIGHT_STEP,
    a.x,
    a.y + depth + ha * HEIGHT_STEP,
  ]).fill(fill);
}

function lift(p: Point, h: number): Point {
  return { x: p.x, y: p.y - h };
}

function liftAll(pts: Point[], h: number): Point[] {
  return pts.map((p) => lift(p, h));
}

function drawRoad(
  g: Graphics,
  theme: Theme,
  ctx: DrawContext,
  x: number,
  y: number,
  q: [Point, Point, Point, Point],
  bridge: boolean,
): void {
  const mask = connectionMask(ctx.world, x, y, Infra.Road);
  const north = (mask & Connection.North) !== 0;
  const east = (mask & Connection.East) !== 0;
  const south = (mask & Connection.South) !== 0;
  const west = (mask & Connection.West) !== 0;
  const roadColor = color(theme, 'road.surface');
  const bridgeColor = color(theme, 'road.bridge');
  const edgeColor = color(theme, 'road.edge');
  const markColor = color(theme, 'road.mark');
  const railColor = color(theme, 'road.bridgeRail');
  const bridgeMark = color(theme, 'road.bridgeMark');
  const base = bridge ? bridgeColor : roadColor;
  const lo = bridge ? BRIDGE_INSET : ROAD_INSET;
  const hi = 1 - lo;
  const deck = bridge ? BRIDGE_DECK : 0;
  const any = north || east || south || west;
  const band = (u0: number, v0: number, u1: number, v1: number) => liftAll(rect(q, u0, v0, u1, v1), deck);
  const landN = bridge && isLandRoad(ctx.world, x, y - 1);
  const landS = bridge && isLandRoad(ctx.world, x, y + 1);
  const landW = bridge && isLandRoad(ctx.world, x - 1, y);
  const landE = bridge && isLandRoad(ctx.world, x + 1, y);

  if (bridge) drawBridgeSupports(g, theme, ctx.world, x, y, q, north, east, south, west);

  if (!any) {
    fillQuad(g, band(0.2, 0.2, 0.8, 0.8), base);
    return;
  }
  fillQuad(g, band(lo, lo, hi, hi), base);
  // Land approaches are sloped ramps drawn in drawBridgeSupports — a lifted band
  // here would leave an 8px cliff against the asphalt.
  if (north && !landN) fillQuad(g, band(lo, 0, hi, lo), base);
  if (south && !landS) fillQuad(g, band(lo, hi, hi, 1), base);
  if (west && !landW) fillQuad(g, band(0, lo, lo, hi), base);
  if (east && !landE) fillQuad(g, band(hi, lo, 1, hi), base);

  const edge = (a: Point, b: Point, fill: number, width: number) =>
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width, color: fill, alpha: 0.9 });
  const side = (u0: number, v0: number, u1: number, v1: number) => {
    const a = lift(tileLocalToScreen(q, u0, v0), deck);
    const b = lift(tileLocalToScreen(q, u1, v1), deck);
    edge(a, b, bridge ? railColor : edgeColor, bridge ? 2 : 1);
  };
  if (!north) side(lo, lo, hi, lo);
  if (!south) side(lo, hi, hi, hi);
  if (!west) side(lo, lo, lo, hi);
  if (!east) side(hi, lo, hi, hi);

  const straightX = (east || west) && !north && !south;
  const straightY = (north || south) && !east && !west;
  if (straightX || straightY) {
    for (const t of [0.2, 0.58]) {
      const a = lift(straightX ? tileLocalToScreen(q, t, 0.5) : tileLocalToScreen(q, 0.5, t), deck);
      const b = lift(
        straightX ? tileLocalToScreen(q, t + 0.2, 0.5) : tileLocalToScreen(q, 0.5, t + 0.2),
        deck,
      );
      edge(a, b, bridge ? bridgeMark : markColor, 1);
    }
  }
}

function drawBridgeSupports(
  g: Graphics,
  theme: Theme,
  world: World,
  x: number,
  y: number,
  q: [Point, Point, Point, Point],
  north: boolean,
  east: boolean,
  south: boolean,
  west: boolean,
): void {
  const lo = BRIDGE_INSET;
  const hi = 1 - BRIDGE_INSET;
  const rLo = ROAD_INSET;
  const rHi = 1 - ROAD_INSET;
  const straightX = (east || west) && !north && !south;
  // Posts sit on the front edge of the deck so a flat top does not hide them.
  const spots: Array<[number, number]> = straightX
    ? [
        [0.32, hi],
        [0.68, hi],
      ]
    : [
        [hi, 0.32],
        [hi, 0.68],
      ];
  const pierColor = color(theme, 'road.bridgePier');
  const shadowColor = color(theme, 'road.bridgeShadow');
  for (const [u, v] of spots) {
    const top = lift(tileLocalToScreen(q, u, v), BRIDGE_DECK);
    const foot = tileLocalToScreen(q, u, v);
    g.moveTo(top.x, top.y)
      .lineTo(foot.x, foot.y + 4)
      .stroke({ width: 4, color: pierColor, alpha: 1 });
    g.ellipse(foot.x, foot.y + 3, 4, 1.8).fill({ color: shadowColor, alpha: 0.5 });
  }

  const bridgeSide = color(theme, 'road.bridgeSide');
  const face = (u0: number, v0: number, u1: number, v1: number) => {
    const a = tileLocalToScreen(q, u0, v0);
    const b = tileLocalToScreen(q, u1, v1);
    fillQuad(g, [a, b, lift(b, BRIDGE_DECK), lift(a, BRIDGE_DECK)], bridgeSide);
  };
  // South and east faces — the visible sides in isometric order.
  face(lo, hi, hi, hi);
  face(hi, lo, hi, hi);

  const roadColor = color(theme, 'road.surface');
  const approach = (
    ou0: number,
    ov0: number,
    ou1: number,
    ov1: number,
    iu0: number,
    iv0: number,
    iu1: number,
    iv1: number,
  ) => {
    fillQuad(
      g,
      [
        tileLocalToScreen(q, ou0, ov0),
        tileLocalToScreen(q, ou1, ov1),
        lift(tileLocalToScreen(q, iu1, iv1), BRIDGE_DECK),
        lift(tileLocalToScreen(q, iu0, iv0), BRIDGE_DECK),
      ],
      roadColor,
    );
  };
  if (north && isLandRoad(world, x, y - 1)) approach(rLo, 0, rHi, 0, lo, lo, hi, lo);
  if (south && isLandRoad(world, x, y + 1)) approach(rLo, 1, rHi, 1, lo, hi, hi, hi);
  if (west && isLandRoad(world, x - 1, y)) approach(0, rLo, 0, rHi, lo, lo, lo, hi);
  if (east && isLandRoad(world, x + 1, y)) approach(1, rLo, 1, rHi, hi, lo, hi, hi);
}

function drawPipe(
  g: Graphics,
  theme: Theme,
  ctx: DrawContext,
  x: number,
  y: number,
  q: [Point, Point, Point, Point],
): void {
  const w = ctx.world;
  const c = tileLocalToScreen(q, 0.5, 0.5);
  const mask = connectionMask(w, x, y, Infra.Pipe);
  const watered = w.watered[w.index(x, y)] === 1;
  const fill = watered ? color(theme, 'infra.pipe') : color(theme, 'infra.pipeDry');
  const links: Array<[boolean, number, number]> = [
    [(mask & Connection.North) !== 0, 0.5, 0],
    [(mask & Connection.East) !== 0, 1, 0.5],
    [(mask & Connection.South) !== 0, 0.5, 1],
    [(mask & Connection.West) !== 0, 0, 0.5],
  ];
  let any = false;
  for (const [on, u, v] of links) {
    if (!on) continue;
    any = true;
    const p = tileLocalToScreen(q, u, v);
    g.moveTo(c.x, c.y).lineTo(p.x, p.y).stroke({ width: 5, color: fill, alpha: 0.95 });
  }
  g.circle(c.x, c.y, any ? 3 : 4).fill(fill);
}

/** Fiber, drawn only underground. Thinner than a pipe so the two can share a tile. */
function drawFiber(
  g: Graphics,
  theme: Theme,
  ctx: DrawContext,
  x: number,
  y: number,
  q: [Point, Point, Point, Point],
): void {
  const w = ctx.world;
  const c = tileLocalToScreen(q, 0.5, 0.5);
  const mask = connectionMask(w, x, y, Infra.Canal);
  const linked = w.linked[w.index(x, y)] === 1;
  const fill = linked ? color(theme, 'infra.canal') : color(theme, 'infra.canalDark');
  const links: Array<[boolean, number, number]> = [
    [(mask & Connection.North) !== 0, 0.5, 0.18],
    [(mask & Connection.East) !== 0, 0.82, 0.5],
    [(mask & Connection.South) !== 0, 0.5, 0.82],
    [(mask & Connection.West) !== 0, 0.18, 0.5],
  ];
  let any = false;
  for (const [on, u, v] of links) {
    if (!on) continue;
    any = true;
    const p = tileLocalToScreen(q, u, v);
    g.moveTo(c.x, c.y).lineTo(p.x, p.y).stroke({ width: 2.2, color: fill, alpha: 0.95 });
  }
  g.circle(c.x, c.y, any ? 1.8 : 2.4).fill(fill);
}

/** Pole top position for a power line tile. */
function poleTop(world: World, x: number, y: number): Point {
  const q = tileQuad(world, x, y);
  const onRoad = world.hasInfra(world.index(x, y), Infra.Road);
  const p = onRoad ? tileLocalToScreen(q, 0.12, 0.12) : tileLocalToScreen(q, 0.5, 0.5);
  return { x: p.x, y: p.y - 20 };
}

export function drawWires(g: Graphics, theme: Theme, ctx: DrawContext, area: ChunkArea): void {
  if (ctx.underground) return;
  const w = ctx.world;
  const cyber = theme.style === 'cyber';
  const sheath = color(theme, 'infra.wire');
  const core = theme.style === 'adobe' ? color(theme, 'coal.glow') : color(theme, 'infra.pipe');
  const cutColor = color(theme, 'infra.wireCut');
  forEachTile(area, (x, y) => {
    if (!w.hasInfra(w.index(x, y), Infra.PowerLine)) return;
    const a = poleTop(w, x, y);
    const powered = w.powered[w.index(x, y)] === 1;
    for (const [nx, ny] of [
      [x + 1, y],
      [x, y + 1],
      [x - 1, y],
      [x, y - 1],
    ] as const) {
      if (!w.inBounds(nx, ny) || !w.hasInfra(w.index(nx, ny), Infra.PowerLine)) continue;
      const b = poleTop(w, nx, ny);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 2 };
      const stroke = (width: number, fill: number, alpha: number) => {
        g.moveTo(a.x, a.y)
          .quadraticCurveTo((a.x + mid.x) / 2, (a.y + mid.y) / 2 + 1, mid.x, mid.y)
          .stroke({ width, color: fill, alpha });
      };
      if (!powered) stroke(1, cutColor, 0.9);
      else if (cyber) {
        // Dark conduit with a lit core, clamped at the pole head.
        stroke(1.7, sheath, 0.95);
        stroke(0.7, core, 0.7);
      } else stroke(1, sheath, 0.9);
    }
  });
}

/** Rebuilds building, tree, pole and fire sprites of a chunk, depth-sorted. */
export function buildObjects(
  container: Container,
  ctx: DrawContext,
  factory: SpriteFactory,
  area: ChunkArea,
): void {
  for (const child of container.removeChildren()) child.destroy();
  const w = ctx.world;
  const size = w.size;
  if (ctx.underground) {
    forEachTile(area, (x, y) => {
      const id = w.buildingId[y * size + x] as number;
      if (id === 0) return;
      const b = ctx.buildings.get(id);
      if (!b || !isWaterSource(b.kind)) return;
      if (b.x + b.w - 1 !== x || b.y + b.h - 1 !== y) return;
      const tex = factory.building(b);
      const sprite = new Sprite(tex.texture);
      sprite.anchor.set(tex.anchorX, tex.anchorY);
      const front = vertexToScreen(b.x + b.w, b.y + b.h, w.corners(x, y)[2]);
      sprite.position.set(front.x, front.y);
      sprite.alpha = 0.6;
      container.addChild(sprite);
    });
    return;
  }
  const alpha = ctx.overlay === 'none' ? 1 : 0.45;
  forEachTile(area, (x, y) => {
    const i = y * size + x;
    const id = w.buildingId[i] as number;
    if (id !== 0) {
      const b = ctx.buildings.get(id);
      // Draw a building once, from its front (south) tile.
      if (b && b.x + b.w - 1 === x && b.y + b.h - 1 === y) {
        const tex = factory.building(b, b.kind === 'marina' ? waterSide(w, b) : 0);
        const sprite = new Sprite(tex.texture);
        sprite.anchor.set(tex.anchorX, tex.anchorY);
        const front = vertexToScreen(b.x + b.w, b.y + b.h, w.corners(x, y)[2]);
        sprite.position.set(front.x, front.y);
        sprite.alpha = alpha;
        container.addChild(sprite);
      }
    } else if ((w.trees[i] as number) > 0) {
      const tex = factory.trees(w.trees[i] as number, Math.floor(tileHash(x, y) * 4));
      const sprite = new Sprite(tex.texture);
      sprite.anchor.set(tex.anchorX, tex.anchorY);
      const q = tileQuad(w, x, y);
      const c = tileLocalToScreen(q, 0.5, 0.5);
      sprite.position.set(c.x, c.y + 8);
      sprite.alpha = alpha;
      container.addChild(sprite);
    }
    if (w.hasInfra(i, Infra.PowerLine)) {
      const tex = factory.pole();
      const sprite = new Sprite(tex.texture);
      sprite.anchor.set(tex.anchorX, tex.anchorY);
      const top = poleTop(w, x, y);
      sprite.position.set(top.x, top.y + 20);
      sprite.alpha = alpha;
      container.addChild(sprite);
    }
    if ((w.fire[i] as number) > 0) {
      const tex = factory.flame(ctx.animationFrame + x + y);
      const sprite = new Sprite(tex.texture);
      sprite.anchor.set(tex.anchorX, tex.anchorY);
      const c = tileLocalToScreen(tileQuad(w, x, y), 0.5, 0.5);
      sprite.position.set(c.x, c.y + 8);
      container.addChild(sprite);
    }
  });
}

const OVERLAY_LAYER: Partial<Record<OverlayMode, InfluenceLayer>> = {
  pollution: 'pollution',
  crime: 'crime',
  landValue: 'landValue',
  traffic: 'traffic',
  police: 'police',
  fireCover: 'fireCover',
  health: 'health',
  education: 'education',
  access: 'access',
};

const GOOD_OVERLAYS = new Set<OverlayMode>([
  'landValue',
  'police',
  'fireCover',
  'health',
  'education',
  'access',
]);

/** Overlays where a high value is good (green scale) instead of bad (heat scale). */
export function isGoodOverlay(mode: OverlayMode): boolean {
  return GOOD_OVERLAYS.has(mode);
}

/** Colour of tile `i` in an overlay, or null when the tile is not shaded. */
export function overlayColor(w: World, i: number, mode: OverlayMode, theme: Theme): number | null {
  if (mode === 'none') return null;
  if (w.terrain[i] === Terrain.Water && mode !== 'traffic') return null;
  if (mode === 'power' || mode === 'water' || mode === 'data') {
    const flag =
      mode === 'power' ? Infra.PowerLine : mode === 'water' ? Infra.Pipe : Infra.Canal;
    const consumer =
      (w.buildingId[i] as number) !== 0 || (w.zone[i] as number) !== 0 || w.hasInfra(i, flag);
    if (!consumer) return null;
    const served =
      mode === 'power' ? w.powered[i] === 1 : mode === 'water' ? w.watered[i] === 1 : w.linked[i] === 1;
    if (!served) return color(theme, 'overlay.unserved');
    if (mode === 'power') return color(theme, 'overlay.powerOn');
    if (mode === 'water') return color(theme, 'overlay.waterOn');
    return color(theme, 'overlay.dataOn');
  }
  if (mode === 'traffic') {
    if (!w.hasInfra(i, Infra.Road)) return null;
    return heatColor(theme, (w.influence.traffic[i] as number) / 200);
  }
  const layer = OVERLAY_LAYER[mode];
  if (!layer) return null;
  const value = (w.influence[layer][i] as number) / 255;
  if (!GOOD_OVERLAYS.has(mode) && value < 0.03) return null;
  return GOOD_OVERLAYS.has(mode) ? goodColor(theme, value) : heatColor(theme, value);
}

export function drawOverlay(g: Graphics, theme: Theme, ctx: DrawContext, area: ChunkArea): void {
  const mode = ctx.overlay;
  if (mode === 'none') return;
  const w = ctx.world;
  const size = w.size;
  const alpha = mode === 'traffic' ? 0.8 : 0.55;
  forEachTile(area, (x, y) => {
    const fill = overlayColor(w, y * size + x, mode, theme);
    if (fill !== null) fillQuad(g, tileQuad(w, x, y), fill, alpha);
  });
}
