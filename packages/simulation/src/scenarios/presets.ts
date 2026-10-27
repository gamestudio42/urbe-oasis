import {
  Infra,
  PLACEABLE_SPECS,
  ZoneDensity,
  ZoneType,
  ERA_WORK_KINDS,
  OASIS_ERA,
  OASIS_ERA_WORKS,
  defaultJourneyState,
  isZoneKind,
  type Command,
  type PlaceableKind,
} from '@city/shared';
import { createEngine, type SimulationEngine } from '../engine';
import { addServices, buildTown, flatCity, maintainTown, recoverCity, run } from './builders';
import { buildGridCity, maintainGrid } from './grid';
import { shelterCoverage, windbreakCoverage } from '../systems/oasis/sandstorms';

export interface PresetRun {
  engine: SimulationEngine;
  /** Called after every simulated month (the automated player). */
  onMonth(engine: SimulationEngine): void;
}

export interface SimPreset {
  description: string;
  defaultSize: number;
  create(seed: string, size: number): PresetRun;
}

const idle = () => undefined;

/** Named cities for `tools/headless-sim.ts` and `tools/benchmark.ts`. */
export const SIM_PRESETS: Record<string, SimPreset> = {
  balanced: {
    description: 'Town with every service, automated plants and pumps (64×64)',
    defaultSize: 64,
    create(seed, size) {
      const engine = flatCity(seed, size);
      addServices(engine, buildTown(engine, { pumps: 8 }));
      return { engine, onMonth: (e) => void maintainTown(e) };
    },
  },
  disasters: {
    description: 'The balanced town with random disasters; the player clears rubble and rebuilds',
    defaultSize: 64,
    create(seed, size) {
      const engine = flatCity(seed, size);
      engine.disastersEnabled = true;
      addServices(engine, buildTown(engine, { pumps: 8 }));
      const plan = engine.commandLog.map((entry) => entry.command);
      return {
        engine,
        onMonth: (e) => {
          recoverCity(e, plan);
          maintainTown(e);
        },
      };
    },
  },
  'oasis-balanced': {
    description: 'Oasis town: the balanced city plus a canal spine and two spring houses',
    defaultSize: 64,
    create(seed, size) {
      const engine = createEngine({
        seed,
        size,
        name: 'Oasis',
        ruleset: 'oasis',
        terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
      });
      engine.disastersEnabled = false;
      addServices(engine, buildTown(engine, { pumps: 8 }));
      addShadeSpine(engine);
      return { engine, onMonth: (e) => void maintainTown(e) };
    },
  },
  'oasis-founding': {
    description:
      'A tutorial-sized Oasis start on Normal funds, with no services, whose player follows the guide',
    defaultSize: 64,
    create(seed, size) {
      const engine = createEngine({
        seed,
        size,
        name: 'Oasis',
        ruleset: 'oasis',
        difficulty: 'normal',
        journey: true,
        terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
      });
      engine.disastersEnabled = false;
      buildFounding(engine);
      return { engine, onMonth: (e) => followGuide(e) };
    },
  },
  'oasis-journey': {
    description: 'Oasis balanced town that follows the journey: reserves, windbreaks, drought',
    defaultSize: 64,
    create(seed, size) {
      const run = SIM_PRESETS['oasis-balanced']!.create(seed, size);
      run.engine.oasis.journey = defaultJourneyState();
      // The balanced town barely breaks even; the journey's answers need capital up front.
      run.engine.economy.funds += 30_000;
      return {
        engine: run.engine,
        onMonth: (e) => {
          const plants = e.buildings.ofKind('gasPlant').length;
          run.onMonth(e);
          playJourney(e);
          // Stats refresh at the next day, so only add power when the town's slots added none.
          if (e.buildings.ofKind('gasPlant').length === plants) keepPower(e);
        },
      };
    },
  },
  'oasis-rationing': {
    description: 'Oasis balanced town with continuous rationing and its business-tax tradeoff',
    defaultSize: 64,
    create(seed, size) {
      const run = SIM_PRESETS['oasis-balanced']!.create(seed, size);
      run.engine.execute({ type: 'setWaterRationing', enabled: true });
      return run;
    },
  },
  'no-power': {
    description: 'The town without power plants',
    defaultSize: 64,
    create(seed, size) {
      const engine = flatCity(seed, size);
      buildTown(engine, { power: false });
      return { engine, onMonth: idle };
    },
  },
  'high-taxes': {
    description: 'The balanced town with every tax at 15%',
    defaultSize: 64,
    create(seed, size) {
      const engine = flatCity(seed, size);
      addServices(engine, buildTown(engine, { pumps: 8 }));
      for (const zone of ['residential', 'commercial', 'industrial'] as const) {
        engine.execute({ type: 'setTax', zone, rate: 15 });
      }
      return { engine, onMonth: (e) => void maintainTown(e) };
    },
  },
  grid: {
    description: 'A street grid of dense blocks filling the whole map (benchmark city)',
    defaultSize: 128,
    create(seed, size) {
      const engine = flatCity(seed, size, 10_000_000);
      const layout = buildGridCity(engine);
      return { engine, onMonth: (e) => void maintainGrid(e, layout) };
    },
  },
  'oasis-grid': {
    description: 'Large Oasis street grid with shade canals and palms (benchmark city)',
    defaultSize: 128,
    create(seed, size) {
      const engine = createEngine({
        seed,
        size,
        name: 'Oasis benchmark',
        ruleset: 'oasis',
        funds: 10_000_000,
        terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
      });
      engine.disastersEnabled = false;
      const layout = buildGridCity(engine);
      for (const y of layout.streets) {
        run(engine, { type: 'canal', x0: 0, y0: y, x1: size - 1, y1: y });
        run(engine, { type: 'place', kind: 'palm', x: 1, y: y + 1 });
      }
      return { engine, onMonth: (e) => void maintainGrid(e, layout) };
    },
  },
  terrain: {
    description: 'Generated terrain without a city (baseline cost of an empty map)',
    defaultSize: 128,
    create(seed, size) {
      return { engine: createEngine({ seed, size }), onMonth: idle };
    },
  },
};

/**
 * A canal along the town's water spine, plus two spring houses.
 * The south spring house touches the coal plant. The north one touches the pump column.
 * A short spur makes that canal visible; the pumps already conduct shade.
 * The south one is placed first, so a search with both online starts there.
 * Only the Oasis preset calls this; `buildTown` stays shared with the classic scenarios.
 */
function addShadeSpine(engine: SimulationEngine): void {
  run(engine, { type: 'canal', x0: 7, y0: 17, x1: 43, y1: 17 });
  run(engine, { type: 'canal', x0: 7, y0: 22, x1: 47, y1: 22 });
  run(engine, { type: 'canal', x0: 43, y0: 18, x1: 43, y1: 21 });
  run(engine, { type: 'canal', x0: 44, y0: 17, x1: 46, y1: 17 });
  run(engine, { type: 'canal', x0: 46, y0: 17, x1: 46, y1: 15 });
  run(engine, { type: 'place', kind: 'springHouse', x: 47, y: 22 });
  run(engine, { type: 'place', kind: 'springHouse', x: 46, y: 14 });
}

/**
 * The automated player's answer to each journey chapter: qanats and cisterns beside the pumps
 * once the first quarter holds, then a windbreak beside each service. Positions are tried in a fixed
 * order, so the run stays deterministic.
 */
function playJourney(engine: SimulationEngine): void {
  const chapter = engine.oasis.journey?.chapter ?? 0;
  if (chapter >= 1) {
    const era = engine.oasis.journey?.era;
    // A dry season that runs short asks for deep water: two more qanats each month it does.
    const qanats = engine.buildings.ofKind('qanat').length;
    const short = era && era.droughtMonthsLeft > 0 && engine.servedShares().water < 1;
    // Reserves only charge from spare water, so deep water comes first.
    if (engine.servedShares().water < 0.97 || short)
      placeBeside(engine, 'qanat', engine.buildings.ofKind('waterPump'), Math.max(8, qanats + 2));
    // The next title asks for a number of cistern banks.
    const goal = era ? OASIS_ERA.ranks[era.rank]?.banks : undefined;
    placeBeside(engine, 'cistern', engine.buildings.ofKind('waterPump'), Math.max(3, goal ?? 0));
  }
  if (chapter >= 2 && engine.buildings.ofKind('windbreak').length < 8) {
    const services = [...engine.buildings.values()].filter(
      (b) => !isZoneKind(b.kind) && PLACEABLE_SPECS[b.kind].jobs > 0 && b.kind !== 'windbreak',
    );
    placeBeside(engine, 'windbreak', services, 8);
  }
  shelterForTitle(engine);
  if (chapter >= 4) placeBeside(engine, 'caravanserai', engine.buildings.ofKind('school'), 1);
  keepShade(engine);
  growDistrict(engine);
  buildStops(engine);
  buildWorks(engine);
}

/**
 * A caravan route once the south district stands: six stops along the two avenues, each on a
 * lot cleared beside the road. Built once, in a fixed order.
 */
function buildStops(engine: SimulationEngine): void {
  const w = engine.world;
  if (!w.hasInfra(w.index(6, DISTRICT_AVENUE), Infra.Road)) return;
  if (engine.buildings.ofKind('caravanStop').length > 0 || engine.economy.funds < 5_000) return;
  for (const [x, y] of STOP_LOTS) {
    engine.execute({ type: 'demolish', x0: x, y0: y, x1: x, y1: y });
    engine.execute({ type: 'place', kind: 'caravanStop', x, y });
  }
}

/** Lots the era player clears for its caravan stops: north of the old avenue (row 20), south of
 * the district avenue (row 33). */
const STOP_LOTS = [
  [9, 19],
  [21, 19],
  [33, 19],
  [9, 34],
  [21, 34],
  [33, 34],
] as const;

/**
 * Power once the town's fixed plant slots are full (a spring house takes one): a gas plant
 * beside the existing plants, which conduct power to it, whenever demand passes 85% of supply.
 */
function keepPower(engine: SimulationEngine): void {
  const power = engine.stats().power;
  if (power.demand <= 0.85 * power.supply) return;
  const plants = [...engine.buildings.ofKind('coalPlant'), ...engine.buildings.ofKind('gasPlant')];
  placeBeside(engine, 'gasPlant', plants, engine.buildings.ofKind('gasPlant').length + 1);
}

/**
 * Era works, after the south district, each once its title is earned and the treasury keeps a
 * reserve after paying for it:
 * the basin and the garden beside the pumps (power and water), the bazaar beside a service on a
 * road.
 */
function buildWorks(engine: SimulationEngine): void {
  const rank = engine.oasis.journey?.era?.rank ?? -1;
  // Growth comes first: works wait for the south district.
  if (!engine.world.hasInfra(engine.world.index(6, DISTRICT_AVENUE), Infra.Road)) return;
  for (const kind of ERA_WORK_KINDS) {
    if (rank < OASIS_ERA_WORKS.rank[kind] || engine.buildings.ofKind(kind).length > 0) continue;
    if (engine.economy.funds < PLACEABLE_SPECS[kind].cost + WORK_RESERVE) continue;
    const anchors =
      kind === 'grandBazaar'
        ? [...engine.buildings.values()].filter(
            (b) => !isZoneKind(b.kind) && PLACEABLE_SPECS[b.kind].requiresRoad,
          )
        : [...engine.buildings.ofKind('waterPump'), ...engine.buildings.ofKind('qanat')];
    placeBeside(engine, kind, anchors, 1);
  }
}

/** Treasury the era player keeps after paying for an era work. */
const WORK_RESERVE = 20_000;

/**
 * The era player's answer to the next title's shelter goal: while cover falls short, a windbreak
 * beside each of up to two uncovered services a month.
 */
function shelterForTitle(engine: SimulationEngine): void {
  const era = engine.oasis.journey?.era;
  const goal = era ? OASIS_ERA.ranks[era.rank] : undefined;
  if (!goal || shelterCoverage(engine) >= goal.shelter) return;
  const exposed = [...engine.buildings.values()].filter(
    (b) =>
      !isZoneKind(b.kind) &&
      PLACEABLE_SPECS[b.kind].jobs > 0 &&
      b.kind !== 'windbreak' &&
      windbreakCoverage(engine, b) < 0.5,
  );
  placeBeside(engine, 'windbreak', exposed, engine.buildings.ofKind('windbreak').length + 2);
}

/**
 * What a player with a full town and spare funds does in the era: once the city holds its City
 * title, a south district with its own avenue, homes, shops and workshops, piped, powered and
 * shaded from the old network. Built once; tiles the reserves already took are skipped.
 */
function growDistrict(engine: SimulationEngine): void {
  const era = engine.oasis.journey?.era;
  if (!era || era.rank < 2 || engine.economy.funds < DISTRICT_FUNDS) return;
  const w = engine.world;
  if (w.hasInfra(w.index(6, DISTRICT_AVENUE), Infra.Road)) return;
  const y = DISTRICT_AVENUE;
  const tryRun = (command: Command) => void engine.execute(command);
  tryRun({ type: 'road', x0: 6, y0: y, x1: 36, y1: y });
  for (let x = 6; x <= 36; x += 6) tryRun({ type: 'road', x0: x, y0: 27, x1: x, y1: y + 7 });
  const zone = (z: ZoneType, x0: number, y0: number, x1: number, y1: number) =>
    tryRun({ type: 'zone', zone: z, density: ZoneDensity.Dense, x0, y0, x1, y1 });
  zone(ZoneType.Commercial, 7, y - 6, 23, y - 1);
  zone(ZoneType.Industrial, 25, y - 6, 35, y - 1);
  for (let x = 7; x + 4 <= 36; x += 6) zone(ZoneType.Residential, x, y + 1, x + 4, y + 6);
  for (const row of [y - 3, y + 3]) {
    tryRun({ type: 'pipe', x0: 7, y0: row, x1: 43, y1: row });
    tryRun({ type: 'canal', x0: 7, y0: row, x1: 43, y1: row });
  }
  tryRun({ type: 'pipe', x0: 43, y0: 22, x1: 43, y1: y + 3 });
  tryRun({ type: 'canal', x0: 43, y0: 22, x1: 43, y1: y + 3 });
}

/** Funds the era player keeps before building the south district, and its avenue row. */
const DISTRICT_FUNDS = 40_000;
const DISTRICT_AVENUE = 33;

/**
 * Shade upkeep a player reading the coverage figure would do: while supply is short, up to three
 * palms a month on free tiles beside the canals, scanned in tile order.
 */
function keepShade(engine: SimulationEngine): void {
  const shade = engine.stats().oasis?.data;
  if (!shade || shade.served >= 0.85 || shade.supply >= shade.demand) return;
  const w = engine.world;
  let placed = 0;
  for (let i = 0; i < w.tileCount && placed < 3; i++) {
    if (!w.hasInfra(i, Infra.Canal)) continue;
    const x = w.xOf(i);
    const y = w.yOf(i);
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      if (engine.execute({ type: 'place', kind: 'palm', x: x + dx, y: y + dy }).ok) {
        placed++;
        break;
      }
    }
  }
}

function placeBeside(
  engine: SimulationEngine,
  kind: PlaceableKind,
  anchors: readonly { x: number; y: number; w: number; h: number }[],
  limit: number,
): void {
  for (const a of anchors) {
    if (engine.buildings.ofKind(kind).length >= limit) return;
    const size = PLACEABLE_SPECS[kind].size;
    let placed = false;
    // Every origin whose footprint touches the anchor's side, so the networks connect.
    for (let y = a.y - size; y <= a.y + a.h && !placed; y++) {
      for (let x = a.x - size; x <= a.x + a.w && !placed; x++) {
        placed = engine.execute({ type: 'place', kind, x, y }).ok;
      }
    }
  }
}

/** The founding tutorial's settlement: an edge road, a small quarter, wind, wells and a palm. */
function buildFounding(engine: SimulationEngine): void {
  const zone = (z: ZoneType, x0: number, y0: number, x1: number, y1: number) =>
    run(engine, { type: 'zone', zone: z, density: ZoneDensity.Light, x0, y0, x1, y1 });
  run(engine, { type: 'road', x0: 0, y0: 30, x1: 34, y1: 30 });
  run(engine, { type: 'road', x0: 20, y0: 23, x1: 20, y1: 36 });
  zone(ZoneType.Residential, 21, 24, 26, 29);
  zone(ZoneType.Commercial, 21, 31, 26, 33);
  zone(ZoneType.Industrial, 28, 31, 33, 33);
  for (const y of [24, 26, 28]) run(engine, { type: 'place', kind: 'windTurbine', x: 27, y });
  run(engine, { type: 'place', kind: 'windTurbine', x: 34, y: 31 });
  for (const y of [25, 27, 29]) run(engine, { type: 'place', kind: 'well', x: 27, y });
  run(engine, { type: 'pipe', x0: 21, y0: 23, x1: 27, y1: 23 });
  // The workshops sit a tile apart from the shops: a short pipe and canal join them to both
  // networks (shade travels only through canals and buildings).
  run(engine, { type: 'pipe', x0: 27, y0: 31, x1: 27, y1: 33 });
  run(engine, { type: 'canal', x0: 27, y0: 31, x1: 27, y1: 33 });
  run(engine, { type: 'canal', x0: 21, y0: 23, x1: 27, y1: 23 });
  run(engine, { type: 'place', kind: 'palm', x: 28, y: 23 });
}

/**
 * What a player reading the guide does: a palm along the canal while shade misses the 80% goal
 * for lack of supply, a well while water does, and two cisterns once the first quarter holds. Fixed positions keep
 * the run deterministic; a spot that is taken is skipped.
 */
function followGuide(engine: SimulationEngine): void {
  const stats = engine.stats();
  const shaded = stats.oasis?.data;
  const funds = engine.economy.funds;
  // More sources only help when supply is short; a disconnected lot needs a canal or pipe.
  if (shaded && shaded.served < 0.8 && shaded.supply < shaded.demand * 1.2 && funds > 600) {
    for (let x = 29; x < 40; x++)
      if (engine.execute({ type: 'place', kind: 'palm', x, y: 23 }).ok) {
        run(engine, { type: 'canal', x0: 28, y0: 22, x1: x, y1: 22 });
        break;
      }
  }
  // Wells go beside the shops, whose zone carries power, so each one is powered and connected.
  if (stats.water.served < 0.8 && stats.water.supply < stats.water.demand * 1.2 && funds > 600) {
    for (let x = 21; x <= 26; x++)
      if (engine.execute({ type: 'place', kind: 'well', x, y: 34 }).ok) break;
  }
  if ((engine.oasis.journey?.chapter ?? 0) >= 1 && engine.buildings.ofKind('cistern').length < 2)
    for (const y of [25, 27]) run(engine, { type: 'place', kind: 'cistern', x: 28, y });
}
