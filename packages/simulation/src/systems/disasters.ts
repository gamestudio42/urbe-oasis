import {
  BALANCE,
  Infra,
  type ActiveDisaster,
  type BuildingRecord,
  type DisasterKind,
} from '@city/shared';
import type { SimulationEngine } from '../engine';
import { forEachNeighbor4 } from '../world/neighbors';

export type DestructionCause = 'fire' | 'flood' | 'earthquake';

const RANDOM_DISASTERS: DisasterKind[] = [
  'fire',
  'flood',
  'earthquake',
  'crisis',
  'blackout',
  'epidemic',
];
const PLANT_KINDS = new Set(['coalPlant', 'gasPlant', 'windTurbine']);

const ticksPerDay = BALANCE.clock.ticksPerDay;
const ticksPerMonth = ticksPerDay * BALANCE.clock.daysPerMonth;

/** Number of burning tiles; derived from the `fire` layer (not serialized). */
export function countFires(engine: SimulationEngine): number {
  const fire = engine.world.fire;
  let n = 0;
  for (let i = 0; i < fire.length; i++) if ((fire[i] as number) > 0) n++;
  return n;
}

function setFire(engine: SimulationEngine, i: number, value: number): void {
  const w = engine.world;
  const before = w.fire[i] as number;
  if (before === value) return;
  if (before === 0) engine.fireCount++;
  else if (value === 0) engine.fireCount--;
  w.setLayer('fire', i, value);
}

/** 0 for tiles that cannot burn, 1 for buildings, less for forests. */
export function flammability(engine: SimulationEngine, i: number): number {
  const w = engine.world;
  if (w.isWater(i) || (w.flood[i] as number) > 0) return 0;
  if ((w.buildingId[i] as number) !== 0) return 1;
  const trees = w.trees[i] as number;
  return trees > 0 ? (BALANCE.fire.treeFlammability * trees) / 3 : 0;
}

/** Sets a tile on fire. Returns false when it cannot burn or is already burning. */
export function ignite(engine: SimulationEngine, i: number): boolean {
  if ((engine.world.fire[i] as number) > 0 || flammability(engine, i) === 0) return false;
  setFire(engine, i, 1);
  return true;
}

/** Removes a building and leaves rubble on its footprint. */
export function destroyBuilding(
  engine: SimulationEngine,
  b: BuildingRecord,
  cause: DestructionCause,
): void {
  const w = engine.world;
  const tiles = engine.buildings.footprint(b);
  engine.buildings.remove(b.id);
  for (const t of tiles) {
    setFire(engine, t, 0);
    w.setLayer('trees', t, 0);
    w.setInfra(t, Infra.Rubble, true);
  }
  engine.networksDirty = true;
  engine.losses[cause]++;
  engine.emit({ type: 'buildingDestroyed', x: b.x, y: b.y, cause });
}

function extinguish(engine: SimulationEngine, i: number, intensity: number): void {
  setFire(engine, i, 0);
  const b = engine.buildings.at(i);
  if (!b) return;
  b.condition = Math.max(1, b.condition - Math.round(intensity * BALANCE.fire.damagePerIntensity));
  engine.buildings.touch(b);
}

function burnOut(engine: SimulationEngine, i: number): void {
  const b = engine.buildings.at(i);
  if (b) {
    destroyBuilding(engine, b, 'fire');
    return;
  }
  setFire(engine, i, 0);
  engine.world.setLayer('trees', i, 0);
}

/**
 * Every tick: fires grow, spread to flammable orthogonal neighbours and are put out with a
 * chance that rises with fire-station coverage (which reaches tiles through the road network).
 */
export function updateFires(engine: SimulationEngine): void {
  if (engine.fireCount === 0) return;
  const w = engine.world;
  const f = BALANCE.fire;
  const cover = w.influence.fireCover;
  const burning: number[] = [];
  for (let i = 0; i < w.tileCount; i++) if ((w.fire[i] as number) > 0) burning.push(i);

  for (const i of burning) {
    const intensity = w.fire[i] as number;
    // A tile may have been cleared by an earlier tile of the same building.
    if (intensity === 0) continue;
    const c = (cover[i] as number) / 255;
    if ((w.flood[i] as number) > 0 || engine.rng.chance(f.extinguishBase + f.extinguishCover * c)) {
      extinguish(engine, i, intensity);
      continue;
    }
    forEachNeighbor4(w.size, i, (n) => {
      if ((w.fire[n] as number) > 0) return;
      const fuel = flammability(engine, n);
      if (fuel === 0) return;
      const cn = (cover[n] as number) / 255;
      if (engine.rng.chance(f.spread * fuel * (1 - f.spreadCoverReduction * cn))) {
        setFire(engine, n, 1);
      }
    });
    const limit = (w.buildingId[i] as number) !== 0 ? f.burnout : f.treeBurnout;
    if (intensity + 1 >= limit) burnOut(engine, i);
    else setFire(engine, i, intensity + 1);
  }
}

/** Every tick: advances active disasters and ends the ones that ran out. */
export function updateDisasters(engine: SimulationEngine): void {
  if (engine.disasters.length === 0) return;
  const ended: ActiveDisaster[] = [];
  for (const d of engine.disasters) {
    d.remainingTicks--;
    if (d.kind === 'flood' && engine.tick % ticksPerDay === 0) floodDay(engine, d);
    if (d.kind === 'blackout') {
      const plant = engine.buildings.get(d.targetId);
      if (plant) plant.offline = Math.max(0, d.remainingTicks);
    }
    if (d.remainingTicks <= 0) ended.push(d);
  }
  if (ended.length === 0) return;
  engine.disasters = engine.disasters.filter((d) => d.remainingTicks > 0);
  for (const d of ended) endDisaster(engine, d);
}

function endDisaster(engine: SimulationEngine, d: ActiveDisaster): void {
  const w = engine.world;
  if (d.kind === 'flood') {
    for (let i = 0; i < w.tileCount; i++) if ((w.flood[i] as number) > 0) w.setLayer('flood', i, 0);
  } else if (d.kind === 'blackout') {
    const plant = engine.buildings.get(d.targetId);
    if (plant) {
      plant.offline = 0;
      engine.buildings.touch(plant);
    }
    engine.networksDirty = true;
    engine.refreshUtilities();
  }
  engine.emit({ type: 'disasterEnded', disaster: d.kind });
}

/** Monthly: spontaneous fires and the occasional random disaster (when enabled). */
export function monthlyDisasters(engine: SimulationEngine): void {
  if (!engine.disastersEnabled) return;
  const w = engine.world;
  const f = BALANCE.fire;
  for (const b of engine.buildings.list()) {
    const i = w.index(b.x, b.y);
    const cover = (w.influence.fireCover[i] as number) / 255;
    if (engine.rng.chance(f.ignitionPerBuilding * (1 - cover)) && ignite(engine, i)) {
      engine.emit({ type: 'fireStarted', x: b.x, y: b.y });
    }
  }
  if (engine.rng.chance(BALANCE.disasters.randomChancePerMonth)) {
    const kind = RANDOM_DISASTERS[engine.rng.int(RANDOM_DISASTERS.length)] as DisasterKind;
    triggerDisaster(engine, kind);
  }
}

/** Starts a disaster, at (x, y) when given. Returns false when it cannot start now. */
export function triggerDisaster(
  engine: SimulationEngine,
  kind: DisasterKind,
  x?: number,
  y?: number,
): boolean {
  const at = x !== undefined && y !== undefined && engine.world.inBounds(x, y) ? { x, y } : null;
  switch (kind) {
    case 'fire':
      return startFire(engine, at);
    case 'flood':
      return startFlood(engine, at);
    case 'earthquake':
      return earthquake(engine, at);
    case 'blackout':
      return blackout(engine);
    case 'crisis':
    case 'epidemic':
      return startTimed(engine, kind, kind === 'crisis' ? 'crisisMonths' : 'epidemicMonths');
  }
}

type Point = { x: number; y: number };

function randomBuildingTile(engine: SimulationEngine): Point | null {
  const list = engine.buildings.list();
  if (list.length === 0) return null;
  const b = list[engine.rng.int(list.length)] as BuildingRecord;
  return { x: b.x, y: b.y };
}

function startFire(engine: SimulationEngine, at: Point | null): boolean {
  const p = at ?? randomBuildingTile(engine);
  if (!p || !ignite(engine, engine.world.index(p.x, p.y))) return false;
  engine.emit({ type: 'fireStarted', x: p.x, y: p.y });
  return true;
}

function isShore(engine: SimulationEngine, i: number): boolean {
  const w = engine.world;
  if (w.isWater(i)) return false;
  let shore = false;
  forEachNeighbor4(w.size, i, (n) => {
    if (w.isWater(n)) shore = true;
  });
  return shore;
}

/** Nearest shore tile to `at` (ring search), or a random shore tile of the map. */
function findShore(engine: SimulationEngine, at: Point | null): number {
  const w = engine.world;
  if (at) {
    for (let r = 0; r <= 8; r++) {
      for (let y = at.y - r; y <= at.y + r; y++) {
        for (let x = at.x - r; x <= at.x + r; x++) {
          if (Math.max(Math.abs(x - at.x), Math.abs(y - at.y)) !== r || !w.inBounds(x, y)) continue;
          const i = w.index(x, y);
          if (isShore(engine, i)) return i;
        }
      }
    }
    return -1;
  }
  const shores: number[] = [];
  for (let i = 0; i < w.tileCount; i++) if (isShore(engine, i)) shores.push(i);
  return shores.length === 0 ? -1 : (shores[engine.rng.int(shores.length)] as number);
}

function startFlood(engine: SimulationEngine, at: Point | null): boolean {
  if (engine.hasDisaster('flood')) return false;
  const origin = findShore(engine, at);
  if (origin < 0) return false;
  const w = engine.world;
  const x = w.xOf(origin);
  const y = w.yOf(origin);
  w.setLayer('flood', origin, 1);
  engine.disasters.push({
    kind: 'flood',
    remainingTicks: BALANCE.disasters.floodDays * ticksPerDay,
    x,
    y,
    targetId: 0,
  });
  engine.emit({ type: 'disasterStarted', disaster: 'flood', x, y });
  return true;
}

/** Once a day while a flood lasts: the water rises, then damages what it covers. */
function floodDay(engine: SimulationEngine, d: ActiveDisaster): void {
  const w = engine.world;
  const cfg = BALANCE.disasters;
  const elapsedDays = cfg.floodDays - Math.ceil(d.remainingTicks / ticksPerDay);
  if (elapsedDays < cfg.floodSpreadDays) {
    const maxElevation = w.elevation(d.x, d.y) + cfg.floodMaxRise;
    let flooded = 0;
    const candidate = new Uint8Array(w.tileCount);
    for (let i = 0; i < w.tileCount; i++) {
      if ((w.flood[i] as number) === 0) continue;
      flooded++;
      forEachNeighbor4(w.size, i, (n) => {
        if (w.isWater(n) || (w.flood[n] as number) > 0) return;
        if (w.elevation(w.xOf(n), w.yOf(n)) > maxElevation) return;
        candidate[n] = 1;
      });
    }
    for (let i = 0; i < w.tileCount && flooded < cfg.floodMaxTiles; i++) {
      if (candidate[i] === 1 && engine.rng.chance(cfg.floodSpreadChance)) {
        w.setLayer('flood', i, 1);
        flooded++;
      }
    }
  }
  for (const b of engine.buildings.list()) {
    if (!engine.buildings.footprint(b).some((t) => (w.flood[t] as number) > 0)) continue;
    b.condition = Math.max(1, b.condition - cfg.floodDamagePerDay);
    engine.buildings.touch(b);
    if (engine.rng.chance(cfg.floodDestroyChancePerDay)) destroyBuilding(engine, b, 'flood');
  }
}

function earthquake(engine: SimulationEngine, at: Point | null): boolean {
  const w = engine.world;
  const cfg = BALANCE.disasters;
  const centre = at ??
    randomBuildingTile(engine) ?? { x: engine.rng.int(w.size), y: engine.rng.int(w.size) };
  const radius = cfg.earthquakeRadius;
  const hitChance = (x: number, y: number) => {
    const dx = x - centre.x;
    const dy = y - centre.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    return d >= radius ? 0 : cfg.earthquakeStrength * (1 - d / radius);
  };
  engine.emit({ type: 'disasterStarted', disaster: 'earthquake', x: centre.x, y: centre.y });
  for (const b of engine.buildings.list()) {
    const p = hitChance(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2);
    if (p === 0 || !engine.rng.chance(p)) continue;
    if (engine.rng.chance(cfg.earthquakeCollapseShare)) destroyBuilding(engine, b, 'earthquake');
    else ignite(engine, w.index(b.x, b.y));
  }
  const cut = Infra.Road | Infra.PowerLine;
  for (let y = Math.max(0, centre.y - radius); y <= Math.min(w.size - 1, centre.y + radius); y++) {
    for (
      let x = Math.max(0, centre.x - radius);
      x <= Math.min(w.size - 1, centre.x + radius);
      x++
    ) {
      const i = w.index(x, y);
      if (((w.infra[i] as number) & cut) === 0 || w.isWater(i)) continue;
      const p = hitChance(x, y) * cfg.earthquakeNetworkFactor;
      if (p === 0 || !engine.rng.chance(p)) continue;
      w.setInfra(i, cut, false);
      w.setInfra(i, Infra.Rubble, true);
    }
  }
  engine.networksDirty = true;
  engine.refreshUtilities();
  return true;
}

function blackout(engine: SimulationEngine): boolean {
  const plants = engine.buildings.list().filter((b) => PLANT_KINDS.has(b.kind) && b.offline === 0);
  if (plants.length === 0) return false;
  const plant = plants[engine.rng.int(plants.length)] as BuildingRecord;
  const ticks = BALANCE.disasters.blackoutDays * ticksPerDay;
  plant.offline = ticks;
  engine.buildings.touch(plant);
  engine.disasters.push({
    kind: 'blackout',
    remainingTicks: ticks,
    x: plant.x,
    y: plant.y,
    targetId: plant.id,
  });
  engine.networksDirty = true;
  engine.refreshUtilities();
  engine.emit({ type: 'disasterStarted', disaster: 'blackout', x: plant.x, y: plant.y });
  return true;
}

function startTimed(
  engine: SimulationEngine,
  kind: 'crisis' | 'epidemic',
  months: 'crisisMonths' | 'epidemicMonths',
): boolean {
  if (engine.hasDisaster(kind)) return false;
  engine.disasters.push({
    kind,
    remainingTicks: BALANCE.disasters[months] * ticksPerMonth,
    x: 0,
    y: 0,
    targetId: 0,
  });
  engine.emit({ type: 'disasterStarted', disaster: kind, x: 0, y: 0 });
  return true;
}
