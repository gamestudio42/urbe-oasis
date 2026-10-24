import { directionBetween, neighbour, roadExits, routeBfs, type Dir, type RoadView } from './roads';
import type { Random } from './random';

/**
 * Cosmetic camel caravans. While a caravanserai is staffed, a short pack line walks the roads
 * from the far end of its street network to the caravanserai and fades out there. The route is
 * a plain breadth-first road path; nothing here touches the simulation or its random stream.
 */
export interface CaravanRoute {
  /** Map width, to turn consecutive tiles into directions. */
  size: number;
  /** Road tiles from the far end to the caravanserai's door, in walking order. */
  path: number[];
}

export interface Caravan {
  id: number;
  route: number;
  /** Distance travelled along the route, in tiles, measured at the lead camel. */
  distance: number;
  /** Tiles per second of game time. */
  speed: number;
  camels: number;
}

/** One camel's place on a route: the tile, its entry and exit directions, progress 0..1. */
export interface CamelPose {
  caravan: number;
  index: number;
  tile: number;
  travelIn: Dir;
  travelOut: Dir;
  t: number;
  /** 1 while walking, fading towards 0 at the caravanserai. */
  alpha: number;
}

export const CAMEL_SPACING = 0.42;
const CARAVAN_SPEED = 0.42;
/** Game seconds between departures on a route. */
const DEPARTURE_EVERY = 26;
const MAX_CARAVANS = 3;
const ROUTE_LENGTH = 48;
const FADE_TILES = 0.8;

/**
 * Farthest road tile reachable from the doors (or a map-edge road, which reads as arriving from
 * the desert), and the path from it to the nearest door.
 */
export function caravanRoute(view: RoadView, doors: readonly number[]): CaravanRoute | null {
  if (doors.length === 0) return null;
  const size = view.size;
  // Breadth-first distances from the doors, to find where a caravan would come from.
  const dist = new Map<number, number>();
  let frontier = doors.filter((d) => view.hasRoad(d));
  for (const d of frontier) dist.set(d, 0);
  let far = frontier[0];
  let edge: number | undefined;
  for (let depth = 1; frontier.length > 0 && depth <= ROUTE_LENGTH; depth++) {
    const next: number[] = [];
    for (const i of frontier) {
      for (const d of roadExits(view, i)) {
        const n = neighbour(size, i, d);
        if (dist.has(n)) continue;
        dist.set(n, depth);
        next.push(n);
        far = n;
        const x = n % size;
        const y = (n / size) | 0;
        if (edge === undefined && (x === 0 || y === 0 || x === size - 1 || y === size - 1))
          edge = n;
      }
    }
    frontier = next;
  }
  const origin = edge ?? far;
  if (origin === undefined || doors.includes(origin)) return null;
  const doorSet = new Set(doors);
  const path = routeBfs(view, [origin], (i) => doorSet.has(i), ROUTE_LENGTH + 2);
  return path && path.length >= 3 ? { size, path } : null;
}

export class CaravanSim {
  readonly caravans: Caravan[] = [];
  private routes: CaravanRoute[] = [];
  private nextId = 1;
  // The first caravan leaves as soon as a caravanserai has a route.
  private sinceDeparture = DEPARTURE_EVERY;
  /** A staffed caravanserai has a route: new caravans may depart. */
  private open = false;

  constructor(private readonly random: Random) {}

  /**
   * Replaces the routes. With no staffed caravanserai, caravans already on the road finish
   * their trip and none departs; a changed route restarts the caravans on it.
   */
  setRoutes(routes: CaravanRoute[]): void {
    if (routes.length === 0) {
      this.open = false;
      return;
    }
    const same =
      routes.length === this.routes.length &&
      routes.every((r, k) => {
        const old = this.routes[k];
        return (
          !!old && old.path.length === r.path.length && old.path.every((t, i) => t === r.path[i])
        );
      });
    // Reopening after an outage sends a caravan straight away.
    if (!this.open) this.sinceDeparture = DEPARTURE_EVERY;
    this.open = true;
    if (same) return;
    this.routes = routes;
    this.caravans.length = 0;
  }

  clear(): void {
    this.caravans.length = 0;
  }

  step(dt: number): void {
    if (this.routes.length === 0) return;
    let kept = 0;
    for (const c of this.caravans) {
      c.distance += dt * c.speed;
      const route = this.routes[c.route];
      if (route && c.distance < route.path.length + FADE_TILES) this.caravans[kept++] = c;
    }
    this.caravans.length = kept;
    if (!this.open) return;
    this.sinceDeparture += dt;
    if (this.sinceDeparture < DEPARTURE_EVERY || this.caravans.length >= MAX_CARAVANS) return;
    this.sinceDeparture = 0;
    this.caravans.push({
      id: this.nextId++,
      route: Math.floor(this.random() * this.routes.length),
      distance: 0,
      speed: CARAVAN_SPEED * (0.9 + this.random() * 0.2),
      camels: 3 + Math.floor(this.random() * 2),
    });
  }

  /** Where each camel stands; camels not yet on the route are omitted. */
  poses(): CamelPose[] {
    const out: CamelPose[] = [];
    for (const c of this.caravans) {
      const route = this.routes[c.route];
      if (!route) continue;
      const path = route.path;
      for (let k = 0; k < c.camels; k++) {
        const d = c.distance - k * CAMEL_SPACING;
        if (d < 0) continue;
        const index = Math.min(path.length - 1, Math.floor(d));
        const tile = path[index] as number;
        const dir = (a: number, b: number) =>
          directionBetween(route.size, path[a] as number, path[b] as number);
        const travelOut = index + 1 < path.length ? dir(index, index + 1) : dir(index - 1, index);
        const travelIn = index > 0 ? dir(index - 1, index) : travelOut;
        const over = d - (path.length - 1);
        out.push({
          caravan: c.id,
          index: k,
          tile,
          travelIn,
          travelOut,
          t: Math.min(1, d - index),
          // Camels fade in as they leave the far end and fade out at the caravanserai.
          alpha: Math.min(
            Math.min(1, d / FADE_TILES),
            over <= 0 ? 1 : Math.max(0, 1 - over / FADE_TILES),
          ),
        });
      }
    }
    return out;
  }
}
