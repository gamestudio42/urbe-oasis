import { Infra, OASIS_ARCADE } from '@city/shared';
import type { SimulationEngine } from '../../engine';
import type { World } from '../../world/world';
import { isOperatingHub } from '../traffic';

/**
 * Drone air traffic (neon ruleset).
 *
 * Drone ports open an aerial lane above the road network. The lane is purely additive: it never
 * touches the ground `traffic` layer. Consumers instead read `arcadeRelief`, which lowers the
 * congestion they feel while a port is online, so the ground rules stay exactly as they are.
 *
 * A lane is the longest straight run of road touching the port, measured along the street as
 * well as away from the building. A port set beside an avenue therefore flies that avenue.
 * The lanes are a derived read model, rebuilt on demand for the renderer; the only serialized
 * state is the drone port buildings themselves.
 */

/** A rendered aerial corridor along the road that touches a port. */
export interface ArcadeLane {
  portId: number;
  x: number;
  y: number;
  /** Road tiles the lane overflies. */
  length: number;
  /** 0 east, 1 south, 2 west, 3 north. */
  heading: number;
}

/** Online drone ports in the city. */
export function arcadeCount(engine: SimulationEngine): number {
  let ports = 0;
  for (const b of engine.buildings.values()) {
    if (b.kind === 'arcade' && b.powered && b.offline === 0 && b.linked === true) ports++;
  }
  return ports;
}

/** Drones the city can keep in the air. */
export function arcadeCapacity(engine: SimulationEngine): number {
  return arcadeCount(engine) * OASIS_ARCADE.perPort;
}

/**
 * Congestion relief 0..1 from the aerial layer. Zero without a port; otherwise the port's share
 * of the road network, capped at `relief`. `roadTiles` comes from the traffic pass.
 */
export function arcadeRelief(engine: SimulationEngine, roadTiles: number): number {
  const capacity = arcadeCapacity(engine);
  if (capacity === 0) return 0;
  // One port serves roughly 24 road tiles before it is saturated.
  const share = Math.min(1, capacity / Math.max(1, roadTiles / 24));
  return Math.round(OASIS_ARCADE.relief * share * 1000) / 1000;
}

/** Aerial lanes for the renderer, derived from the road network beside each port. */
export function arcadeLanes(engine: SimulationEngine): ArcadeLane[] {
  const lanes: ArcadeLane[] = [];
  for (const port of engine.buildings.values()) {
    if (port.kind !== 'arcade' || !isOperatingHub(port) || port.linked !== true) continue;
    const lane = longestArcadeLane(engine.world, port);
    if (lane) lanes.push(lane);
  }
  return lanes;
}

/** How far a drone follows one straight road before turning back. */
export const ARCADE_LANE_CAP = 14;

const DIRECTIONS = [
  { dx: 1, dy: 0, heading: 0 },
  { dx: 0, dy: 1, heading: 1 },
  { dx: -1, dy: 0, heading: 2 },
  { dx: 0, dy: -1, heading: 3 },
] as const;

function roadAt(w: World, x: number, y: number): boolean {
  return w.inBounds(x, y) && w.hasInfra(w.index(x, y), Infra.Road);
}

/** Road tiles in a straight line from `(x, y)`, including the start, capped at `ARCADE_LANE_CAP`. */
function roadRun(w: World, x: number, y: number, dx: number, dy: number): number {
  let length = 0;
  let cx = x;
  let cy = y;
  while (length < ARCADE_LANE_CAP && roadAt(w, cx, cy)) {
    length++;
    cx += dx;
    cy += dy;
  }
  return length;
}

interface PortFootprint {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Every straight run of road touching the port, one per heading.
 *
 * The run starts on every road tile orthogonally beside the footprint and is measured both
 * away from the building and along the street. Walking only outward from one corner stops on
 * the first tile of a normal avenue, which is too short for a drone to launch.
 */
function scanPort(w: World, port: PortFootprint): {
  best: ArcadeLane | null;
  byHeading: Map<number, ArcadeLane>;
} {
  let best: ArcadeLane | null = null;
  const byHeading = new Map<number, ArcadeLane>();
  const offer = (x: number, y: number, dx: number, dy: number, heading: number): void => {
    const length = roadRun(w, x, y, dx, dy);
    if (length === 0) return;
    const lane = { portId: port.id, x, y, length, heading };
    const prev = byHeading.get(heading);
    if (!prev || length > prev.length) byHeading.set(heading, lane);
    if (!best || length > best.length) best = lane;
  };
  // `inward` steps from the adjacent tile back into the footprint, which is never a road.
  const touch = (x: number, y: number, inwardX: number, inwardY: number): void => {
    if (!roadAt(w, x, y)) return;
    for (const dir of DIRECTIONS) {
      if (dir.dx === inwardX && dir.dy === inwardY) continue;
      offer(x, y, dir.dx, dir.dy, dir.heading);
    }
  };
  for (let x = port.x; x < port.x + port.w; x++) {
    touch(x, port.y - 1, 0, 1);
    touch(x, port.y + port.h, 0, -1);
  }
  for (let y = port.y; y < port.y + port.h; y++) {
    touch(port.x - 1, y, 1, 0);
    touch(port.x + port.w, y, -1, 0);
  }
  return { best, byHeading };
}

/** One corridor per compass heading that has road beside the port, longest run of that heading. */
export function arcadeRoadLanes(w: World, port: PortFootprint): ArcadeLane[] {
  return [...scanPort(w, port).byHeading.values()].sort((a, b) => a.heading - b.heading);
}

/** Longest of `arcadeRoadLanes`. The simulated read model keeps a single corridor. */
export function longestArcadeLane(w: World, port: PortFootprint): ArcadeLane | null {
  return scanPort(w, port).best;
}
