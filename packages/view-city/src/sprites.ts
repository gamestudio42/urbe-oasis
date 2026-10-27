import { isZoneKind, type BuildingRecord } from '@city/shared';
import { color, shade, type Theme } from '@theme/core';
import { Container, Graphics, type Renderer, type Texture } from 'pixi.js';
import { footprint, lerp, up } from './chimneys';
import { drawCivic } from './civicSprites';
import { drawCyberCivic, drawCyberMarina, drawCyberPole, drawCyberUtility } from './cyberSprites';
import { drawCyberCommercial, drawCyberIndustrial, drawCyberResidential } from './cyberZoneSprites';
import { drawAdobeCivic, drawAdobeUtility } from './adobeSprites';
import {
  adobeVariant,
  drawAdobeCommercial,
  drawAdobeIndustrial,
  drawAdobeResidential,
} from './oasisArchitecture';
import { drawUtility } from './utilitySprites';
import { drawDesertPalm } from './oasisLandscape';
import { drawCamel, drawWalker } from './streetLifeSprites';
import {
  HEADINGS,
  drawAirport,
  drawBoat,
  drawMarina,
  drawPlane,
  drawPlaneShadow,
  type BoatKind,
} from './hubSprites';
import { TILE_H, TILE_W, type Point } from './iso';
import {
  drawBattery,
  drawCorpHQ,
  DRONE_FLIGHT_SCALE,
  drawDrone,
  drawDronePort,
  drawDroneShadow,
  drawFirewall,
  drawAdobeArcade,
  drawAdobeCaravanserai,
  drawAdobeCistern,
  drawAdobeQanat,
  drawAdobeWindbreak,
  drawOasisShade,
  drawSubstation,
} from './oasisSprites';
import { drawEraWork } from './eraWorkSprites';
import type { VehicleKind } from './animation/vehicles';
import { drawCommercial, drawIndustrial, drawResidential } from './zoneSprites';

export interface SpriteTexture {
  texture: Texture;
  anchorX: number;
  anchorY: number;
}

const HALF_W = TILE_W / 2;
const HALF_H = TILE_H / 2;

function poly(g: Graphics, points: Point[], fill: number, alpha = 1): void {
  g.poly(points.flatMap((p) => [p.x, p.y])).fill({ color: fill, alpha });
}

/** Draws an isometric box and returns its top face corners. */
function drawPlaceable(g: Graphics, theme: Theme, kind: string, size: number): void {
  switch (kind) {
    case 'park': {
      const { b, r, t, l } = footprint(size, 0.04);
      poly(g, [t, r, b, l], color(theme, 'park.ground'));
      g.ellipse(-6, -14, 8, 4).fill(color(theme, 'park.pond'));
      tree(g, theme, { x: 9, y: -10 }, 1);
      tree(g, theme, { x: -12, y: -22 }, 0.8);
      tree(g, theme, { x: 4, y: -24 }, 0.7);
      break;
    }
  }
}

function tree(g: Graphics, theme: Theme, base: Point, scale: number): void {
  if (theme.style === 'adobe') {
    drawDesertPalm(g, theme, base, scale);
    return;
  }
  g.rect(base.x - 1.5 * scale, base.y - 8 * scale, 3 * scale, 8 * scale).fill(
    color(theme, 'tree.trunk'),
  );
  g.circle(base.x, base.y - 13 * scale, 7 * scale).fill(color(theme, 'tree.leafDark'));
  g.circle(base.x - 3 * scale, base.y - 16 * scale, 5 * scale).fill(color(theme, 'tree.leafMid'));
  g.circle(base.x + 2 * scale, base.y - 18 * scale, 4 * scale).fill(color(theme, 'tree.leafLight'));
}

const TREE_SPOTS: Point[] = [
  { x: 0, y: -14 },
  { x: -12, y: -18 },
  { x: 11, y: -19 },
  { x: -2, y: -24 },
  { x: 6, y: -10 },
];

/** Screen offset of a ground point given in grid units from the origin. */
function isoProject(gx: number, gy: number): Point {
  return { x: (gx - gy) * HALF_W, y: (gx + gy) * HALF_H };
}

/** Ground rectangle (back, right, front, left) centred on the origin, `length` along `axis`. */
function groundRect(axis: 'x' | 'y', length: number, width: number): Point[] {
  const hx = (axis === 'x' ? length : width) / 2;
  const hy = (axis === 'x' ? width : length) / 2;
  return [isoProject(-hx, -hy), isoProject(hx, -hy), isoProject(hx, hy), isoProject(-hx, hy)];
}

function groundShadow(g: Graphics, axis: 'x' | 'y', length: number, width: number): void {
  poly(g, groundRect(axis, length, width), 0x000000, 0.22);
}

/** Glass canopy drawn in the token colour, without shading the emissive faces. */
function glassDeck(
  g: Graphics,
  axis: 'x' | 'y',
  length: number,
  width: number,
  z0: number,
  height: number,
  fill: number,
): void {
  const [back, right, front, left] = groundRect(axis, length, width).map((p) => up(p, z0)) as [
    Point,
    Point,
    Point,
    Point,
  ];
  poly(g, [left, front, up(front, height), up(left, height)], fill);
  poly(g, [front, right, up(right, height), up(front, height)], fill);
  const roof = [up(back, height), up(right, height), up(front, height), up(left, height)];
  poly(g, roof, fill);
}

/** Lit side trim and two headlights on the nose of a top face (back, right, front, left). */
function emissiveTrim(g: Graphics, top: Point[], accent: number): void {
  g.moveTo(top[0]!.x, top[0]!.y)
    .lineTo(top[1]!.x, top[1]!.y)
    .stroke({ width: 1.15, color: accent });
  g.moveTo(top[3]!.x, top[3]!.y)
    .lineTo(top[2]!.x, top[2]!.y)
    .stroke({ width: 1.15, color: accent });
  for (const t of [0.28, 0.72]) {
    const lamp = lerp(top[1]!, top[2]!, t);
    g.circle(lamp.x, lamp.y, 0.85).fill(accent);
  }
}

/**
 * Cosmetic traffic. Classic cars stay two painted boxes. A cyber theme draws a dark chassis
 * with the palette colour only on the trim and the headlights, so the traffic matches the
 * buildings. The footprint stays the same either way.
 */
export function drawVehicle(
  g: Graphics,
  theme: Theme,
  kind: VehicleKind,
  axis: 'x' | 'y',
  carColor: number,
  light = false,
): void {
  const length = kind === 'car' ? 0.32 : 0.42;
  const width = kind === 'car' ? 0.17 : 0.19;
  groundShadow(g, axis, length + 0.04, width + 0.04);
  if (theme.style === 'cyber' && kind !== 'fireTruck') {
    const shell = color(theme, 'vehicle.truckBody');
    const glass = color(theme, 'road.mark');
    const painted = theme.cars[carColor % theme.cars.length] as number;
    // The steel swatch is the chassis itself, so that car takes the rail colour instead.
    const accent =
      kind === 'car'
        ? painted === shell
          ? color(theme, 'road.bridgeRail')
          : painted
        : color(theme, 'airport.yellow');
    const body = groundBox(g, axis, length, width, 0, kind === 'car' ? 3.2 : 5.2, shell);
    glassDeck(
      g,
      axis,
      length * (kind === 'car' ? 0.42 : 0.3),
      width * 0.72,
      kind === 'car' ? 3.2 : 5.2,
      kind === 'car' ? 1.5 : 1.3,
      glass,
    );
    emissiveTrim(g, body, accent);
    return;
  }
  if (kind === 'car') {
    const body = theme.cars[carColor % theme.cars.length] as number;
    groundBox(g, axis, length, width, 0, 3.5, body);
    groundBox(g, axis, length * 0.5, width * 0.86, 3.5, 2.5, shade(body, 1.08), 0x2a3a4a);
  } else if (kind === 'truck') {
    groundBox(g, axis, length, width, 0, 6, color(theme, 'vehicle.truckBody'));
  } else {
    const [t, r, b, l] = groundBox(
      g,
      axis,
      length,
      width,
      0,
      5,
      color(theme, 'vehicle.fireBody'),
    ) as [Point, Point, Point, Point];
    // Ladder along the travel axis.
    const from = axis === 'x' ? lerp(t, l, 0.5) : lerp(t, r, 0.5);
    const to = axis === 'x' ? lerp(r, b, 0.5) : lerp(l, b, 0.5);
    const a = lerp(from, to, 0.15);
    const e = lerp(from, to, 0.85);
    g.moveTo(a.x, a.y)
      .lineTo(e.x, e.y)
      .stroke({ width: 1.2, color: color(theme, 'vehicle.fireLadder') });
    groundBox(
      g,
      axis,
      0.06,
      width * 0.8,
      5,
      1.6,
      color(theme, light ? 'vehicle.fireLightOn' : 'vehicle.fireLightOff'),
      color(theme, light ? 'vehicle.fireLightGlow' : 'vehicle.fireLightDark'),
    );
  }
}

/** Box standing on the ground rectangle, lifted by `z0`; returns its top face. */
function groundBox(
  g: Graphics,
  axis: 'x' | 'y',
  length: number,
  width: number,
  z0: number,
  height: number,
  fill: number,
  sideColor?: number,
): Point[] {
  const [t, r, b, l] = groundRect(axis, length, width).map((p) => up(p, z0)) as [
    Point,
    Point,
    Point,
    Point,
  ];
  const side = sideColor ?? fill;
  poly(g, [l, b, up(b, height), up(l, height)], shade(side, 0.75));
  poly(g, [b, r, up(r, height), up(b, height)], shade(side, 0.92));
  const top = [up(t, height), up(r, height), up(b, height), up(l, height)];
  poly(g, top, fill);
  return top;
}

/**
 * Draws one placeable into `g`, picking the architecture the theme asks for.
 *
 * Kept separate from the factory so the routing can be tested without a GPU: the cyberpunk
 * variants and the classic ones are different shapes, and a theme must never mix them.
 */
export function drawBuilding(
  g: Graphics,
  theme: Theme,
  kind: string,
  size: number,
  level: number,
  variant: number,
  abandoned: boolean,
  side = 0,
): void {
  if (kind === 'residential') {
    if (theme.style === 'cyber') drawCyberResidential(g, theme, level, variant, abandoned);
    else if (theme.style === 'adobe') drawAdobeResidential(g, theme, level, variant, abandoned);
    else drawResidential(g, theme, level, variant, abandoned);
  } else if (kind === 'commercial') {
    if (theme.style === 'cyber') drawCyberCommercial(g, theme, level, variant, abandoned);
    else if (theme.style === 'adobe') drawAdobeCommercial(g, theme, level, variant, abandoned);
    else drawCommercial(g, theme, level, variant, abandoned);
  } else if (kind === 'industrial') {
    if (theme.style === 'cyber') drawCyberIndustrial(g, theme, level, variant, abandoned);
    else if (theme.style === 'adobe') drawAdobeIndustrial(g, theme, level, variant, abandoned);
    else drawIndustrial(g, theme, level, variant, abandoned);
  } else if (kind === 'marina') {
    if (theme.style === 'cyber') drawCyberMarina(g, theme, side);
    else drawMarina(g, theme, side);
  } else if (kind === 'airport') drawAirport(g, theme);
  else if (theme.style === 'adobe' && kind === 'qanat') drawAdobeQanat(g, theme);
  else if (kind === 'qanat') drawSubstation(g, theme);
  else if (theme.style === 'adobe' && kind === 'cistern') drawAdobeCistern(g, theme);
  else if (kind === 'cistern') drawBattery(g, theme);
  else if (theme.style === 'adobe' && kind === 'windbreak') drawAdobeWindbreak(g, theme);
  else if (kind === 'windbreak') drawFirewall(g, theme);
  else if (theme.style === 'adobe' && kind === 'arcade') drawAdobeArcade(g, theme);
  else if (kind === 'arcade') drawDronePort(g, theme);
  else if (theme.style === 'adobe' && kind === 'caravanserai') drawAdobeCaravanserai(g, theme);
  else if (kind === 'caravanserai') drawCorpHQ(g, theme);
  else if (theme.style === 'adobe' && (kind === 'springHouse' || kind === 'palm')) {
    drawOasisShade(g, theme, kind);
  } else if (drawEraWork(g, theme, kind)) {
    // Era works keep one silhouette in every style.
  } else if (theme.style === 'adobe' && drawAdobeCivic(g, theme, kind)) {
    // Mud-brick service buildings: a yard, a ward, a court. Not the classic civic set.
  } else if (theme.style === 'adobe' && drawAdobeUtility(g, theme, kind, size)) {
    // Kiln, jars, sail and stone ring. Not the classic plant silhouettes.
  } else if (theme.style === 'cyber' && drawCyberCivic(g, theme, kind)) {
    // Cyberpunk service buildings draw their own silhouette.
  } else if (theme.style === 'cyber' && drawCyberUtility(g, theme, kind, size)) {
    // Cyberpunk power and water infrastructure draw their own silhouette.
  } else if (drawCivic(g, theme, kind)) {
    // Service buildings draw their own silhouette.
  } else if (drawUtility(g, theme, kind, size)) {
    // Power plants and water infrastructure draw their own silhouette.
  } else drawPlaceable(g, theme, kind, size);
}

/** Generates and caches procedural textures for one theme. */
export class SpriteFactory {
  private readonly cache = new Map<string, SpriteTexture>();

  constructor(
    private readonly renderer: Renderer,
    private readonly theme: Theme,
  ) {}

  /** `side` turns buildings that face something (the marina faces its water, 0..3). */
  building(
    b: Pick<BuildingRecord, 'kind' | 'level' | 'variant' | 'abandoned' | 'w'> &
      Partial<Pick<BuildingRecord, 'x' | 'y'>>,
    side = 0,
  ): SpriteTexture {
    const level = Math.max(1, b.level);
    const variant =
      this.theme.style === 'adobe' && isZoneKind(b.kind)
        ? adobeVariant(b.variant, b.x, b.y)
        : b.variant & 3;
    const key = `b:${b.kind}:${level}:${variant}:${b.abandoned ? 1 : 0}:${side}`;
    return this.get(key, (g) => {
      drawBuilding(g, this.theme, b.kind, b.w, level, variant, b.abandoned, side);
    });
  }

  /** Boat centred on its position; `heading` indexes `HEADINGS`. */
  boat(kind: BoatKind, heading: number, hull: number, moving: boolean): SpriteTexture {
    const c = hull % this.theme.boats.length;
    return this.get(`boat:${kind}:${heading}:${c}:${moving ? 1 : 0}`, (g) =>
      drawBoat(
        g,
        this.theme,
        { x: 0, y: 0 },
        HEADINGS[heading] as Point,
        kind,
        this.theme.boats[c] as number,
        moving,
      ),
    );
  }

  /** Airliner centred on its ground position (lift it by its altitude when placing it). */
  plane(heading: number): SpriteTexture {
    return this.get(`plane:${heading}`, (g) =>
      drawPlane(g, this.theme, { x: 0, y: 0 }, HEADINGS[heading] as Point),
    );
  }

  planeShadow(heading: number): SpriteTexture {
    return this.get(`planeShadow:${heading}`, (g) =>
      drawPlaneShadow(g, this.theme, { x: 0, y: 0 }, HEADINGS[heading] as Point),
    );
  }

  /** Drone centred on its position, rotors at `frame` (an animation step, not a heading). */
  drone(frame: number): SpriteTexture {
    const step = ((frame % 4) + 4) % 4;
    return this.get(`drone:${step}`, (g) =>
      drawDrone(g, this.theme, { x: 0, y: 0 }, step * 0.5, DRONE_FLIGHT_SCALE),
    );
  }

  droneShadow(): SpriteTexture {
    return this.get('droneShadow', (g) =>
      drawDroneShadow(g, this.theme, { x: 0, y: 0 }, DRONE_FLIGHT_SCALE),
    );
  }

  trees(density: number, variant: number): SpriteTexture {
    const d = Math.max(1, Math.min(3, density));
    return this.get(`t:${d}:${variant % 4}`, (g) => {
      const count = d === 1 ? 1 : d === 2 ? 3 : 5;
      const sorted = TREE_SPOTS.slice(0, count).sort((a, c) => a.y - c.y);
      sorted.forEach((spot, k) =>
        tree(
          g,
          this.theme,
          { x: spot.x + ((variant + k) % 3) - 1, y: spot.y + 8 },
          0.75 + ((variant + k) % 3) * 0.1,
        ),
      );
    });
  }

  pole(): SpriteTexture {
    return this.get(`pole:${this.theme.style}`, (g) => {
      if (this.theme.style === 'cyber') {
        drawCyberPole(g, this.theme);
        return;
      }
      g.rect(-1, -22, 2, 22).fill(color(this.theme, 'pole.post'));
      g.rect(-6, -21, 12, 2).fill(color(this.theme, 'pole.arm'));
    });
  }

  /** Vehicle seen from above, its ground centre at the origin; `axis` is its travel axis. */
  vehicle(kind: VehicleKind, axis: 'x' | 'y', carColor: number, light = false): SpriteTexture {
    const key = `v:${this.theme.style}:${kind}:${axis}:${kind === 'car' ? carColor % this.theme.cars.length : 0}:${light ? 1 : 0}`;
    return this.get(key, (g) => drawVehicle(g, this.theme, kind, axis, carColor, light));
  }

  /** Architecture style of the theme this factory draws. */
  get style(): Theme['style'] {
    return this.theme.style;
  }

  /** A pedestrian, its feet at the origin. */
  walker(robe: number, frame: number): SpriteTexture {
    return this.get(`walker:${robe % 4}:${frame % 2}`, (g) =>
      drawWalker(g, this.theme, robe, frame),
    );
  }

  /** A pack camel facing right, its feet at the origin. */
  camel(load: number, frame: number): SpriteTexture {
    return this.get(`camel:${load % 2}:${frame % 2}`, (g) => drawCamel(g, this.theme, load, frame));
  }

  smokePuff(): SpriteTexture {
    return this.get('smoke', (g) => {
      g.circle(0, 0, 9).fill({ color: color(this.theme, 'fx.smokeDark'), alpha: 0.7 });
      g.circle(-2.5, -2.5, 6).fill({ color: color(this.theme, 'fx.smokeLight'), alpha: 0.65 });
    });
  }

  /** Short glint on water, aligned with the isometric grid. */
  sparkle(): SpriteTexture {
    return this.get('sparkle', (g) => {
      g.poly([-5, 0, 0, -1.3, 5, 0, 0, 1.3]).fill({
        color: color(this.theme, 'fx.sparkle'),
        alpha: 0.95,
      });
    });
  }

  flame(frame: number): SpriteTexture {
    return this.get(`fire:${frame % 2}`, (g) => {
      const s = frame % 2 === 0 ? 1 : 1.15;
      g.poly([-12 * s, -4, -4, -34 * s, 2, -12, 8, -40 * s, 14 * s, -4]).fill({
        color: color(this.theme, 'fx.flameOuter'),
        alpha: 0.9,
      });
      g.poly([-7 * s, -4, -1, -24 * s, 4, -10, 7, -26 * s, 9 * s, -4]).fill({
        color: color(this.theme, 'fx.flameInner'),
        alpha: 0.95,
      });
    });
  }

  /** Textures generated so far; a steadily growing count would be a leak. */
  get cachedTextures(): number {
    return this.cache.size;
  }

  private get(key: string, draw: (g: Graphics) => void): SpriteTexture {
    const cached = this.cache.get(key);
    if (cached) return cached;
    const g = new Graphics();
    draw(g);
    const holder = new Container();
    holder.addChild(g);
    const bounds = g.getLocalBounds();
    const texture = this.renderer.generateTexture({
      target: holder,
      resolution: 2,
      antialias: true,
    });
    const entry: SpriteTexture = {
      texture,
      anchorX: bounds.width > 0 ? -bounds.x / bounds.width : 0.5,
      anchorY: bounds.height > 0 ? -bounds.y / bounds.height : 1,
    };
    g.destroy();
    holder.destroy();
    this.cache.set(key, entry);
    return entry;
  }
}
