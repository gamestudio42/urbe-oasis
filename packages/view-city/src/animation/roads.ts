import { Infra } from '@city/shared';
import type { World } from '@city/simulation';
import type { Random } from './random';

/** Travel direction: 0 north (−y), 1 east (+x), 2 south (+y), 3 west (−x). */
export type Dir = 0 | 1 | 2 | 3;

export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;

/** Distance of a lane centre from the road axis, in tile units (the road is 0.56 wide). */
export const LANE_OFFSET = 0.14;

/** What the animations need to know about the road network. */
export interface RoadView {
  readonly size: number;
  hasRoad(i: number): boolean;
  /** Simulated traffic load per tile, 0..255 (only meaningful on road tiles). */
  readonly traffic: ArrayLike<number>;
}

export function worldRoadView(world: World): RoadView {
  const infra = world.infra;
  return {
    size: world.size,
    hasRoad: (i) => ((infra[i] as number) & Infra.Road) !== 0,
    traffic: world.influence.traffic,
  };
}

export function reverse(d: Dir): Dir {
  return ((d + 2) % 4) as Dir;
}

/** Index of the neighbour in direction `d`, or -1 outside the map. */
export function neighbour(size: number, i: number, d: Dir): number {
  const x = (i % size) + DX[d];
  const y = Math.floor(i / size) + DY[d];
  return x < 0 || y < 0 || x >= size || y >= size ? -1 : y * size + x;
}

/** Direction from tile `a` to the orthogonally adjacent tile `b`. */
export function directionBetween(size: number, a: number, b: number): Dir {
  const dx = (b % size) - (a % size);
  if (dx === 1) return 1;
  if (dx === -1) return 3;
  return b > a ? 2 : 0;
}

/** Directions in which tile `i` connects to another road tile. */
export function roadExits(view: RoadView, i: number): Dir[] {
  const exits: Dir[] = [];
  for (let d = 0; d < 4; d++) {
    const n = neighbour(view.size, i, d as Dir);
    if (n >= 0 && view.hasRoad(n)) exits.push(d as Dir);
  }
  return exits;
}

/** Right-hand perpendicular of a direction, in grid units (y grows southwards). */
function right(d: Dir): [number, number] {
  return [-DY[d], DX[d]];
}

const EDGE_U = [0.5, 1, 0.5, 0] as const;
const EDGE_V = [0, 0.5, 1, 0.5] as const;

/**
 * Tile-local point (u along +x, v along +y) of a vehicle on the right-hand lane, `t` of the way
 * through a tile it entered travelling `travelIn` and leaves travelling `travelOut`. The path
 * goes from the entry edge to the lane corner (the centre for straight runs) and on to the exit.
 */
export function lanePoint(
  travelIn: Dir,
  travelOut: Dir,
  t: number,
  lane = LANE_OFFSET,
): { u: number; v: number } {
  const [rix, riy] = right(travelIn);
  const [rox, roy] = right(travelOut);
  const entry = reverse(travelIn);
  const startU = EDGE_U[entry] + rix * lane;
  const startV = EDGE_V[entry] + riy * lane;
  const endU = EDGE_U[travelOut] + rox * lane;
  const endV = EDGE_V[travelOut] + roy * lane;
  let midU = 0.5;
  let midV = 0.5;
  if (travelIn === travelOut) {
    midU += rix * lane;
    midV += riy * lane;
  } else {
    // Turns meet at the corner where both lanes cross; a U-turn cancels out at the centre.
    midU += (rix + rox) * lane;
    midV += (riy + roy) * lane;
  }
  if (t < 0.5) {
    const k = t * 2;
    return { u: startU + (midU - startU) * k, v: startV + (midV - startV) * k };
  }
  const k = (t - 0.5) * 2;
  return { u: midU + (endU - midU) * k, v: midV + (endV - midV) * k };
}

/** Direction a vehicle faces at progress `t` (it turns at the middle of the tile). */
export function headingAt(travelIn: Dir, travelOut: Dir, t: number): Dir {
  return t < 0.5 ? travelIn : travelOut;
}

/**
 * Exit chosen by a vehicle that entered tile `i` travelling `travelIn`. U-turns only happen at
 * dead ends. Busier neighbours are more likely, so vehicles follow the simulated flows, and going
 * straight on is favoured. Returns -1 when the tile has no road neighbour.
 */
export function nextDirection(view: RoadView, i: number, travelIn: Dir, random: Random): Dir | -1 {
  const back = reverse(travelIn);
  const options: Dir[] = [];
  const weights: number[] = [];
  let total = 0;
  for (const d of roadExits(view, i)) {
    if (d === back) continue;
    const n = neighbour(view.size, i, d);
    const w = (1 + (view.traffic[n] as number) / 32) * (d === travelIn ? 1.5 : 1);
    options.push(d);
    weights.push(w);
    total += w;
  }
  if (options.length === 0) {
    const n = neighbour(view.size, i, back);
    return n >= 0 && view.hasRoad(n) ? back : -1;
  }
  let r = random() * total;
  for (let k = 0; k < options.length; k++) {
    r -= weights[k] as number;
    if (r < 0) return options[k] as Dir;
  }
  return options[options.length - 1] as Dir;
}

/**
 * Shortest road path (tile indices, source first) from any of `sources` to a tile accepted by
 * `isTarget`, exploring neighbours in N, E, S, W order. Null when no target is within
 * `maxLength` road tiles.
 */
export function routeBfs(
  view: RoadView,
  sources: readonly number[],
  isTarget: (i: number) => boolean,
  maxLength = 64,
): number[] | null {
  const parent = new Map<number, number>();
  let frontier: number[] = [];
  for (const s of sources) {
    if (!view.hasRoad(s) || parent.has(s)) continue;
    parent.set(s, -1);
    frontier.push(s);
  }
  for (let depth = 0; frontier.length > 0 && depth <= maxLength; depth++) {
    const next: number[] = [];
    for (const i of frontier) {
      if (isTarget(i)) {
        const path = [i];
        for (let p = parent.get(i) as number; p !== -1; p = parent.get(p) as number) path.push(p);
        return path.reverse();
      }
      for (let d = 0; d < 4; d++) {
        const n = neighbour(view.size, i, d as Dir);
        if (n < 0 || parent.has(n) || !view.hasRoad(n)) continue;
        parent.set(n, i);
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}
