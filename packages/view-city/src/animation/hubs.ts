import type { BuildingRecord } from '@city/shared';
import type { World } from '@city/simulation';
import type { Theme } from '@theme/core';
import { RUNWAY, headingIndex, type BoatKind } from '../hubSprites';
import type { Random } from './random';

/** Boat cruising speed in tiles per game second. */
export const BOAT_SPEED = 0.9;
export const MAX_BOATS_PER_MARINA = 3;
/** Longest trip from the marina, in tiles of water. */
export const BOAT_RANGE = 16;
const BOAT_MIN_TRIP = 5;
const BOAT_SPAWN = { min: 1.5, max: 5 } as const;
const BOAT_PAUSE = { min: 1.5, max: 4 } as const;
const FLIGHT_GAP = { min: 3, max: 8 } as const;

/** Altitude gained per tile flown, in pixels (also the landing glide slope). */
export const CLIMB_PER_TILE = 9;
const TAKEOFF_ACCEL = 0.55;
const LIFTOFF_RUN = 2.4;
const CLIMB_ACCEL = 0.3;
const FADE_ALTITUDE = { from: 170, to: 270 } as const;
const APPROACH_SPEED = 1.8;
const APPROACH_TIME = 6;
const ROLLOUT_DECEL = 0.75;
const TOUCHDOWN_U = RUNWAY.u0 + 0.3;
const FADE_TIME = 0.8;

export interface HubSite {
  id: number;
  kind: 'marina' | 'airport';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Boat {
  id: number;
  site: number;
  /** Water tiles from the marina to the trip's end (reversed for the way back). */
  path: number[];
  /** Position along `path`, in tiles. */
  t: number;
  returning: boolean;
  pause: number;
  kind: BoatKind;
  color: number;
  /** Sideways offset from the tile centres, so boats do not sail on one line. */
  lane: number;
}

export type FlightMode = 'takeoff' | 'landing';

export interface Plane {
  id: number;
  site: number;
  mode: FlightMode;
  time: number;
}

/** Where a flight is after `time` game seconds, along the runway axis of its airport. */
export interface FlightState {
  /** Tiles from the airport's north corner along +x (negative before the runway). */
  u: number;
  altitude: number;
  alpha: number;
  done: boolean;
}

/** Takeoff run, rotation and climb out; landing approach, flare and rollout. Pure. */
export function flightState(mode: FlightMode, time: number): FlightState {
  if (mode === 'takeoff') {
    const fadeIn = Math.min(1, time / 0.6);
    const tLift = Math.sqrt((2 * LIFTOFF_RUN) / TAKEOFF_ACCEL);
    if (time <= tLift) {
      return {
        u: RUNWAY.u0 + 0.5 * TAKEOFF_ACCEL * time * time,
        altitude: 0,
        alpha: fadeIn,
        done: false,
      };
    }
    const tc = time - tLift;
    const run = LIFTOFF_RUN + TAKEOFF_ACCEL * tLift * tc + 0.5 * CLIMB_ACCEL * tc * tc;
    const altitude = (run - LIFTOFF_RUN) * CLIMB_PER_TILE;
    const fade = (altitude - FADE_ALTITUDE.from) / (FADE_ALTITUDE.to - FADE_ALTITUDE.from);
    return {
      u: RUNWAY.u0 + run,
      altitude,
      alpha: Math.max(0, Math.min(1, 1 - fade)),
      done: altitude >= FADE_ALTITUDE.to,
    };
  }
  if (time < APPROACH_TIME) {
    const out = APPROACH_SPEED * (APPROACH_TIME - time);
    return {
      u: TOUCHDOWN_U - out,
      altitude: out * CLIMB_PER_TILE,
      alpha: Math.min(1, time),
      done: false,
    };
  }
  const tr = time - APPROACH_TIME;
  const stop = APPROACH_SPEED / ROLLOUT_DECEL;
  const roll = Math.min(tr, stop);
  const u = TOUCHDOWN_U + APPROACH_SPEED * roll - 0.5 * ROLLOUT_DECEL * roll * roll;
  const parked = tr - stop;
  const alpha = parked <= FADE_TIME ? 1 : Math.max(0, 1 - (parked - FADE_TIME) / FADE_TIME);
  return { u, altitude: 0, alpha, done: parked >= 2 * FADE_TIME };
}

/** Water tiles a marina's boats can reach: BFS parents and trip ends, from the jetty tiles. */
export interface WaterReach {
  parent: Map<number, number>;
  ends: number[];
}

/**
 * Breadth-first search over water from the tiles beside the marina, up to `range` steps.
 * Diagonal steps need both orthogonal neighbours to be water, so boats never cut a corner of land.
 */
export function waterReach(world: World, site: HubSite, range = BOAT_RANGE): WaterReach {
  const size = world.size;
  const water = (x: number, y: number) => world.inBounds(x, y) && world.isWater(world.index(x, y));
  const parent = new Map<number, number>();
  const dist = new Map<number, number>();
  let frontier: number[] = [];
  for (let y = site.y - 1; y <= site.y + site.h; y++) {
    for (let x = site.x - 1; x <= site.x + site.w; x++) {
      const outsideX = x < site.x || x >= site.x + site.w;
      const outsideY = y < site.y || y >= site.y + site.h;
      if (outsideX === outsideY || !water(x, y)) continue;
      const i = y * size + x;
      parent.set(i, -1);
      dist.set(i, 0);
      frontier.push(i);
    }
  }
  const ends: number[] = [];
  const nearEnds: number[] = [];
  for (let d = 1; d <= range && frontier.length > 0; d++) {
    const next: number[] = [];
    for (const t of frontier) {
      const tx = t % size;
      const ty = (t - tx) / size;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = tx + dx;
          const ny = ty + dy;
          if (!water(nx, ny)) continue;
          if (dx !== 0 && dy !== 0 && (!water(tx + dx, ty) || !water(tx, ty + dy))) continue;
          const n = ny * size + nx;
          if (dist.has(n)) continue;
          dist.set(n, d);
          parent.set(n, t);
          next.push(n);
          if (d >= BOAT_MIN_TRIP) ends.push(n);
          else if (d >= 2) nearEnds.push(n);
        }
      }
    }
    frontier = next;
  }
  return { parent, ends: ends.length > 0 ? ends : nearEnds };
}

function pathTo(reach: WaterReach, end: number): number[] {
  const path: number[] = [];
  for (let t = end; t !== -1; t = reach.parent.get(t) ?? -1) path.push(t);
  return path.reverse();
}

/** Grid position and heading of a boat (tile centres plus its lane offset). */
export function boatPose(boat: Boat, size: number): { x: number; y: number; heading: number } {
  const last = boat.path.length - 1;
  const k = Math.min(Math.floor(boat.t), Math.max(0, last - 1));
  const a = boat.path[k] as number;
  const b = boat.path[Math.min(k + 1, last)] as number;
  const ax = a % size;
  const ay = (a - ax) / size;
  const bx = b % size;
  const by = (b - bx) / size;
  const f = Math.min(1, Math.max(0, boat.t - k));
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  // Lane offset perpendicular to the direction of travel.
  const ox = (-dy / len) * boat.lane;
  const oy = (dx / len) * boat.lane;
  return {
    x: ax + 0.5 + dx * f + ox,
    y: ay + 0.5 + dy * f + oy,
    heading: dx === 0 && dy === 0 ? 0 : headingIndex(dx, dy),
  };
}

const between = (random: Random, r: { min: number; max: number }) =>
  r.min + random() * (r.max - r.min);

/**
 * Cosmetic traffic of the transport hubs: boats leave operating marinas for a trip on the water
 * and come back; operating airports alternate takeoffs and landings.
 */
export class HubTraffic {
  readonly boats: Boat[] = [];
  readonly planes: Plane[] = [];
  private sites: HubSite[] = [];
  private readonly reach = new Map<number, WaterReach>();
  private readonly timers = new Map<number, number>();
  private readonly nextMode = new Map<number, FlightMode>();
  private terrainVersion = -1;
  private nextId = 1;

  constructor(
    private readonly random: Random,
    private readonly theme: Theme,
  ) {}

  /** Operating hubs of the city; boats and planes of removed hubs disappear. */
  setSites(world: World, buildings: Iterable<BuildingRecord>): void {
    const sites: HubSite[] = [];
    for (const b of buildings) {
      if (b.kind !== 'marina' && b.kind !== 'airport') continue;
      if (!b.powered || b.offline > 0) continue;
      sites.push({ id: b.id, kind: b.kind, x: b.x, y: b.y, w: b.w, h: b.h });
    }
    const live = new Set(sites.map((s) => s.id));
    if (world.terrainVersion !== this.terrainVersion) {
      this.terrainVersion = world.terrainVersion;
      this.reach.clear();
    }
    for (const id of [...this.reach.keys()]) if (!live.has(id)) this.reach.delete(id);
    for (const s of sites) {
      if (s.kind === 'marina' && !this.reach.has(s.id)) this.reach.set(s.id, waterReach(world, s));
    }
    removeWhere(this.boats, (b) => !live.has(b.site));
    removeWhere(this.planes, (p) => !live.has(p.site));
    this.sites = sites;
  }

  site(id: number): HubSite | undefined {
    return this.sites.find((s) => s.id === id);
  }

  step(dt: number): void {
    if (dt <= 0) return;
    for (const boat of this.boats) {
      if (boat.pause > 0) {
        boat.pause -= dt;
        if (boat.pause <= 0) {
          boat.path.reverse();
          boat.t = 0;
          boat.returning = true;
        }
        continue;
      }
      boat.t += BOAT_SPEED * dt;
      if (boat.t >= boat.path.length - 1) {
        boat.t = boat.path.length - 1;
        if (!boat.returning) boat.pause = between(this.random, BOAT_PAUSE);
      }
    }
    removeWhere(this.boats, (b) => b.returning && b.t >= b.path.length - 1);
    for (const plane of this.planes) plane.time += dt;
    removeWhere(this.planes, (p) => flightState(p.mode, p.time).done);

    for (const s of this.sites) {
      const left = (this.timers.get(s.id) ?? between(this.random, BOAT_SPAWN)) - dt;
      this.timers.set(s.id, left);
      if (left > 0) continue;
      if (s.kind === 'marina') {
        this.timers.set(s.id, between(this.random, BOAT_SPAWN));
        this.launchBoat(s);
      } else if (!this.planes.some((p) => p.site === s.id)) {
        this.timers.set(s.id, between(this.random, FLIGHT_GAP));
        const mode = this.nextMode.get(s.id) ?? 'takeoff';
        this.nextMode.set(s.id, mode === 'takeoff' ? 'landing' : 'takeoff');
        this.planes.push({ id: this.nextId++, site: s.id, mode, time: 0 });
      }
    }
  }

  clear(): void {
    this.boats.length = 0;
    this.planes.length = 0;
    this.timers.clear();
  }

  private launchBoat(s: HubSite): void {
    if (this.boats.filter((b) => b.site === s.id).length >= MAX_BOATS_PER_MARINA) return;
    const reach = this.reach.get(s.id);
    if (!reach || reach.ends.length === 0) return;
    const end = reach.ends[Math.floor(this.random() * reach.ends.length)] as number;
    const path = pathTo(reach, end);
    if (path.length < 2) return;
    this.boats.push({
      id: this.nextId++,
      site: s.id,
      path,
      t: 0,
      returning: false,
      pause: 0,
      kind: this.random() < 0.5 ? 'sail' : 'motor',
      color: Math.floor(this.random() * this.theme.boats.length),
      lane: (this.random() - 0.5) * 0.3,
    });
  }
}

function removeWhere<T>(list: T[], drop: (item: T) => boolean): void {
  let n = 0;
  for (const item of list) if (!drop(item)) list[n++] = item;
  list.length = n;
}
