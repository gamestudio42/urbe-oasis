import {
  BALANCE,
  Infra,
  PLACEABLE_SPECS,
  type BuildingRecord,
  type InfluenceLayer,
  type ServiceKind,
} from '@city/shared';
import type { SimulationEngine } from '../engine';
import type { World } from '../world/world';

export const SERVICE_LAYERS: Record<ServiceKind, InfluenceLayer> = {
  policeStation: 'police',
  fireStation: 'fireCover',
  school: 'education',
  hospital: 'health',
};

const SERVICE_KINDS = Object.keys(SERVICE_LAYERS) as ServiceKind[];

/** Road tiles within Chebyshev distance 1 of a building footprint, in index order. */
export function stationAccessRoads(world: World, b: BuildingRecord): number[] {
  const out: number[] = [];
  for (let y = b.y - 1; y <= b.y + b.h; y++) {
    for (let x = b.x - 1; x <= b.x + b.w; x++) {
      if (!world.inBounds(x, y)) continue;
      const i = world.index(x, y);
      if (world.hasInfra(i, Infra.Road)) out.push(i);
    }
  }
  return out;
}

/** Monthly: coverage of police, fire, education and health, spreading along roads. */
export function updateServices(engine: SimulationEngine): void {
  const w = engine.world;
  const size = w.size;
  const cfg = BALANCE.services;
  const stamp = new Int32Array(w.tileCount);
  const dist = new Int32Array(w.tileCount);
  const queue = new Int32Array(w.tileCount);
  let stationStamp = 0;

  for (const kind of SERVICE_KINDS) {
    const spec = PLACEABLE_SPECS[kind];
    const radius = spec.serviceRadius;
    const roadCov = new Float32Array(w.tileCount);
    const tileCov = new Float32Array(w.tileCount);
    const covered: number[] = [];
    for (const b of engine.buildings.ofKind(kind)) {
      const funding = spec.department ? engine.economy.funding[spec.department] / 100 : 1;
      const base = 255 * funding * (b.powered ? 1 : cfg.unpoweredFactor);
      if (base <= 0) continue;
      // Full strength next to the station.
      for (let y = b.y - cfg.localRadius; y < b.y + b.h + cfg.localRadius; y++) {
        for (let x = b.x - cfg.localRadius; x < b.x + b.w + cfg.localRadius; x++) {
          if (!w.inBounds(x, y)) continue;
          const i = w.index(x, y);
          if (base > (tileCov[i] as number)) tileCov[i] = base;
        }
      }
      // Breadth-first along roads from the access roads.
      stationStamp++;
      let tail = 0;
      for (const r of stationAccessRoads(w, b)) {
        if (stamp[r] === stationStamp) continue;
        stamp[r] = stationStamp;
        dist[r] = 0;
        queue[tail++] = r;
      }
      for (let head = 0; head < tail; head++) {
        const t = queue[head] as number;
        const d = dist[t] as number;
        const strength = base * (1 - d / radius);
        if (strength > (roadCov[t] as number)) {
          if ((roadCov[t] as number) === 0) covered.push(t);
          roadCov[t] = strength;
        }
        if (d + 1 >= radius) continue;
        const tx = t % size;
        const ty = (t / size) | 0;
        const next = [
          ty > 0 ? t - size : -1,
          tx < size - 1 ? t + 1 : -1,
          ty < size - 1 ? t + size : -1,
          tx > 0 ? t - 1 : -1,
        ];
        for (const n of next) {
          if (n < 0 || stamp[n] === stationStamp || !w.hasInfra(n, Infra.Road)) continue;
          stamp[n] = stationStamp;
          dist[n] = d + 1;
          queue[tail++] = n;
        }
      }
    }
    // Each tile takes the best road coverage within `tileSpread`, with a falloff per tile.
    covered.sort((a, b) => a - b);
    for (const r of covered) {
      const cov = roadCov[r] as number;
      const rx = r % size;
      const ry = (r / size) | 0;
      for (let dy = -cfg.tileSpread; dy <= cfg.tileSpread; dy++) {
        for (let dx = -cfg.tileSpread; dx <= cfg.tileSpread; dx++) {
          const x = rx + dx;
          const y = ry + dy;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          const v = cov * (1 - cfg.spreadFalloff * Math.max(Math.abs(dx), Math.abs(dy)));
          const i = y * size + x;
          if (v > (tileCov[i] as number)) tileCov[i] = v;
        }
      }
    }
    const layer = w.influence[SERVICE_LAYERS[kind]];
    for (let i = 0; i < w.tileCount; i++) {
      const v = tileCov[i] as number;
      layer[i] = v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v);
    }
  }
  w.influenceDirty = true;
}
