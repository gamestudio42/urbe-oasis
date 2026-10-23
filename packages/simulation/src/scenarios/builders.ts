import { Infra, ZoneDensity, ZoneType, type Command, type CommandResult } from '@city/shared';
import { createEngine, type SimulationEngine } from '../engine';

/**
 * Flat grass map without water, hills or trees. Random fires and disasters start disabled so
 * economic scenarios measure trends, not luck; enable them with `setDisasters`.
 */
export function flatCity(seed = 'scenario', size = 64, funds?: number): SimulationEngine {
  const engine = createEngine({
    seed,
    size,
    name: 'Cenário',
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    ...(funds === undefined ? {} : { funds }),
  });
  engine.disastersEnabled = false;
  return engine;
}

/**
 * Police, fire, school and hospital along the town's avenue, plus a few parks. Placed between
 * the zone blocks so every station touches a road.
 */
export function addServices(engine: SimulationEngine, layout: CityLayout): void {
  const y = layout.avenueY;
  // Stations sit on the free tiles west of the first residential block and next to the plant.
  run(engine, { type: 'place', kind: 'policeStation', x: 4, y: y - 3 });
  run(engine, { type: 'place', kind: 'fireStation', x: 4, y: y + 2 });
  run(engine, { type: 'place', kind: 'school', x: 37, y: y - 3 });
  run(engine, { type: 'place', kind: 'hospital', x: 37, y: y + 4 });
  for (const x of [1, 2]) run(engine, { type: 'place', kind: 'park', x, y: y - 2 });
}

export function run(engine: SimulationEngine, command: Command): CommandResult {
  const result = engine.execute(command);
  if (!result.ok)
    throw new Error(`Scenario command failed: ${command.type} ${result.reason ?? ''}`);
  return result;
}

export interface CityLayout {
  /** Rows of the main avenue and the zone blocks. */
  avenueY: number;
  x0: number;
  x1: number;
}

/**
 * A small grid town: an avenue reaching the west map edge, residential blocks north of it,
 * commercial and industrial blocks south of it, a power plant and a water pump.
 */
export function buildTown(
  engine: SimulationEngine,
  options: {
    power?: boolean;
    water?: boolean;
    /** Number of inland pumps stacked north of the first one (1..8). */
    pumps?: number;
    edgeRoad?: boolean;
    /**
     * `mixed` (default): industry beside the eastern homes. `near`: an industrial strip right
     * across the avenue from every home. `far`: the same strip on a street eight tiles south.
     */
    industry?: 'mixed' | 'near' | 'far';
  } = {},
): CityLayout {
  const { power = true, water = true, pumps = 8, edgeRoad = true, industry = 'mixed' } = options;
  const avenueY = 20;
  const x0 = edgeRoad ? 0 : 4;
  const x1 = 40;
  run(engine, { type: 'road', x0, y0: avenueY, x1, y1: avenueY });
  // Side streets every 6 tiles.
  for (let x = 6; x <= x1; x += 6) {
    run(engine, { type: 'road', x0: x, y0: avenueY - 7, x1: x, y1: avenueY + 7 });
  }
  const zone = (z: ZoneType, ax0: number, ay0: number, ax1: number, ay1: number, dense = false) =>
    run(engine, {
      type: 'zone',
      zone: z,
      density: dense ? ZoneDensity.Dense : ZoneDensity.Light,
      x0: ax0,
      y0: ay0,
      x1: ax1,
      y1: ay1,
    });
  for (let x = 7; x + 4 <= x1; x += 6) {
    zone(ZoneType.Residential, x, avenueY - 6, x + 4, avenueY - 1, true);
  }
  if (industry === 'near') {
    zone(ZoneType.Industrial, 7, avenueY + 1, 35, avenueY + 3, true);
    zone(ZoneType.Commercial, 7, avenueY + 4, 35, avenueY + 6);
  } else if (industry === 'far') {
    zone(ZoneType.Commercial, 7, avenueY + 1, 35, avenueY + 3);
    run(engine, { type: 'road', x0: 6, y0: avenueY + 8, x1: 36, y1: avenueY + 8 });
    zone(ZoneType.Industrial, 7, avenueY + 9, 35, avenueY + 11, true);
    if (power) run(engine, { type: 'powerLine', x0: 36, y0: avenueY + 4, x1: 36, y1: avenueY + 9 });
  } else {
    zone(ZoneType.Commercial, 7, avenueY + 1, 23, avenueY + 3, true);
    zone(ZoneType.Industrial, 25, avenueY + 1, 35, avenueY + 6, true);
    zone(ZoneType.Commercial, 7, avenueY + 4, 23, avenueY + 6);
  }
  if (power) {
    run(engine, { type: 'place', kind: 'coalPlant', x: 44, y: avenueY + 2 });
    run(engine, { type: 'powerLine', x0: 36, y0: avenueY + 3, x1: 43, y1: avenueY + 3 });
  }
  if (water) {
    // Adjacent pumps conduct power and water to each other, so the column needs one link.
    for (let p = 0; p < Math.max(1, Math.min(8, pumps)); p++) {
      run(engine, { type: 'place', kind: 'waterPump', x: 44, y: avenueY - 4 - 2 * p });
    }
    run(engine, { type: 'powerLine', x0: 44, y0: avenueY - 2, x1: 44, y1: avenueY + 1 });
    run(engine, { type: 'pipe', x0: 43, y0: avenueY - 3, x1: 7, y1: avenueY - 3 });
    run(engine, { type: 'pipe', x0: 7, y0: avenueY + 2, x1: 43, y1: avenueY + 2 });
    run(engine, { type: 'pipe', x0: 43, y0: avenueY - 3, x1: 43, y1: avenueY + 2 });
  }
  return { avenueY, x0, x1 };
}

const PLANT_SLOTS = [
  [47, 22],
  [47, 24],
  [49, 22],
  [49, 24],
  [51, 22],
  [51, 24],
] as const;
const PUMP_SLOTS = [16, 14, 12, 10, 8, 6, 4, 2].map((y) => [46, y] as const);

/**
 * A minimal automated player for `buildTown` cities: adds a gas plant or a pump next to the
 * existing ones when demand passes 85% of supply. Returns the number of buildings added.
 */
export function maintainTown(engine: SimulationEngine): number {
  const s = engine.stats();
  let added = 0;
  const tryPlace = (
    kind: 'gasPlant' | 'waterPump',
    slots: readonly (readonly [number, number])[],
  ) => {
    for (const [x, y] of slots) {
      if (engine.execute({ type: 'place', kind, x, y }).ok) {
        added++;
        return;
      }
    }
  };
  if (s.power.demand > 0.85 * s.power.supply) tryPlace('gasPlant', PLANT_SLOTS);
  if (s.water.supply > 0 && s.water.demand > 0.85 * s.water.supply)
    tryPlace('waterPump', PUMP_SLOTS);
  return added;
}

/**
 * A responsive player for runs with disasters: clears rubble, then replays the commands that
 * built the city (`plan`, e.g. a slice of `engine.commandLog`) so destroyed plants, pumps,
 * services and network pieces come back. Line tools only build the missing tiles.
 */
export function recoverCity(engine: SimulationEngine, plan: readonly Command[]): number {
  const w = engine.world;
  let actions = 0;
  for (let i = 0; i < w.tileCount; i++) {
    if (!w.hasInfra(i, Infra.Rubble)) continue;
    const x = i % w.size;
    const y = (i / w.size) | 0;
    if (engine.execute({ type: 'demolish', x0: x, y0: y, x1: x, y1: y }).ok) actions++;
  }
  for (const command of plan) if (engine.execute(command).ok) actions++;
  return actions;
}

/**
 * Homes on the west half of a street, shops and industry on the east half, powered by a gas
 * plant through a ring of power lines. With `gap`, the street is cut between the two halves
 * and does not reach the map edge, so homes cannot reach any job.
 */
export function buildCorridor(
  engine: SimulationEngine,
  options: { gap?: boolean } = {},
): CityLayout {
  const avenueY = 20;
  if (options.gap) {
    run(engine, { type: 'road', x0: 4, y0: avenueY, x1: 20, y1: avenueY });
    run(engine, { type: 'road', x0: 24, y0: avenueY, x1: 40, y1: avenueY });
  } else {
    run(engine, { type: 'road', x0: 4, y0: avenueY, x1: 40, y1: avenueY });
  }
  const zone = (z: ZoneType, ax0: number, ay0: number, ax1: number, ay1: number) =>
    run(engine, {
      type: 'zone',
      zone: z,
      density: ZoneDensity.Light,
      x0: ax0,
      y0: ay0,
      x1: ax1,
      y1: ay1,
    });
  zone(ZoneType.Residential, 4, avenueY - 3, 20, avenueY - 1);
  zone(ZoneType.Residential, 4, avenueY + 1, 20, avenueY + 2);
  zone(ZoneType.Commercial, 24, avenueY - 3, 40, avenueY - 1);
  zone(ZoneType.Industrial, 24, avenueY + 1, 40, avenueY + 3);
  run(engine, { type: 'place', kind: 'gasPlant', x: 44, y: avenueY - 2 });
  run(engine, { type: 'powerLine', x0: 41, y0: avenueY - 1, x1: 43, y1: avenueY - 1 });
  run(engine, { type: 'powerLine', x0: 41, y0: avenueY - 4, x1: 41, y1: avenueY + 4 });
  run(engine, { type: 'powerLine', x0: 3, y0: avenueY - 4, x1: 40, y1: avenueY - 4 });
  run(engine, { type: 'powerLine', x0: 3, y0: avenueY - 4, x1: 3, y1: avenueY + 2 });
  return { avenueY, x0: 4, x1: 40 };
}
