import { BALANCE, Infra } from '@city/shared';
import type { World } from '../world/world';

const NO_ROAD = -1;
const FAR = 255;

/**
 * Road graph derived from the infra layer: connected components, map-edge connections and,
 * for every tile, the nearest road within Chebyshev distance `accessRadius`.
 * Recomputed lazily when `world.roadVersion` changes; it is a pure function of the roads.
 */
export class RoadNetwork {
  /** Component id per tile (0 = not a road). */
  readonly component: Int32Array;
  /** Nearest road tile index per tile, or -1. */
  readonly accessRoad: Int32Array;
  /** Chebyshev distance to `accessRoad` (0 on roads, 255 when none). */
  readonly accessDistance: Uint8Array;
  /** Per component (index = id): 1 when a road of the component touches the map edge. */
  edgeConnected = new Uint8Array(1);
  componentCount = 0;
  roadTiles = 0;
  bridgeTiles = 0;
  /** Road tiles on the map border, in index order. */
  edgeRoads: number[] = [];
  private version = -1;

  constructor(private readonly world: World) {
    this.component = new Int32Array(world.tileCount);
    this.accessRoad = new Int32Array(world.tileCount).fill(NO_ROAD);
    this.accessDistance = new Uint8Array(world.tileCount).fill(FAR);
  }

  /** Recomputes if roads changed since the last call. */
  update(): void {
    if (this.version === this.world.roadVersion) return;
    this.version = this.world.roadVersion;
    this.label();
    this.computeAccess();
  }

  hasAccess(i: number): boolean {
    return (this.accessRoad[i] as number) !== NO_ROAD;
  }

  componentOf(i: number): number {
    const road = this.accessRoad[i] as number;
    return road === NO_ROAD ? 0 : (this.component[road] as number);
  }

  private label(): void {
    const w = this.world;
    const size = w.size;
    const comp = this.component;
    comp.fill(0);
    const queue = new Int32Array(w.tileCount);
    const edge: number[] = [0];
    const edgeRoads: number[] = [];
    let next = 0;
    let roads = 0;
    let bridges = 0;
    for (let i = 0; i < w.tileCount; i++) {
      if (!w.hasInfra(i, Infra.Road)) continue;
      roads++;
      if (w.isWater(i)) bridges++;
      const x = i % size;
      const y = (i / size) | 0;
      if (x === 0 || y === 0 || x === size - 1 || y === size - 1) edgeRoads.push(i);
      if (comp[i] !== 0) continue;
      const id = ++next;
      let head = 0;
      let tail = 0;
      queue[tail++] = i;
      comp[i] = id;
      let touchesEdge = 0;
      while (head < tail) {
        const t = queue[head++] as number;
        const tx = t % size;
        const ty = (t / size) | 0;
        if (tx === 0 || ty === 0 || tx === size - 1 || ty === size - 1) touchesEdge = 1;
        if (ty > 0) tail = visit(w, comp, queue, tail, t - size, id);
        if (tx < size - 1) tail = visit(w, comp, queue, tail, t + 1, id);
        if (ty < size - 1) tail = visit(w, comp, queue, tail, t + size, id);
        if (tx > 0) tail = visit(w, comp, queue, tail, t - 1, id);
      }
      edge.push(touchesEdge);
    }
    this.componentCount = next;
    this.edgeConnected = Uint8Array.from(edge);
    this.roadTiles = roads;
    this.bridgeTiles = bridges;
    this.edgeRoads = edgeRoads;
  }

  /** Multi-source 8-neighbour BFS from road tiles in index order (Chebyshev distance). */
  private computeAccess(): void {
    const w = this.world;
    const size = w.size;
    const radius = BALANCE.traffic.accessRadius;
    const road = this.accessRoad;
    const dist = this.accessDistance;
    road.fill(NO_ROAD);
    dist.fill(FAR);
    const queue = new Int32Array(w.tileCount);
    let tail = 0;
    for (let i = 0; i < w.tileCount; i++) {
      if (!w.hasInfra(i, Infra.Road)) continue;
      road[i] = i;
      dist[i] = 0;
      queue[tail++] = i;
    }
    for (let head = 0; head < tail; head++) {
      const t = queue[head] as number;
      const d = dist[t] as number;
      if (d >= radius) continue;
      const tx = t % size;
      const ty = (t / size) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = ty + dy;
        if (ny < 0 || ny >= size) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = tx + dx;
          if ((dx === 0 && dy === 0) || nx < 0 || nx >= size) continue;
          const n = ny * size + nx;
          if ((dist[n] as number) !== FAR) continue;
          dist[n] = d + 1;
          road[n] = road[t] as number;
          queue[tail++] = n;
        }
      }
    }
  }
}

function visit(
  w: World,
  comp: Int32Array,
  queue: Int32Array,
  tail: number,
  n: number,
  id: number,
): number {
  if (comp[n] !== 0 || !w.hasInfra(n, Infra.Road)) return tail;
  comp[n] = id;
  queue[tail] = n;
  return tail + 1;
}
