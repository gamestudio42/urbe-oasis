import {
  Infra,
  PLACEABLE_SPECS,
  ZoneDensity,
  ZoneType,
  defaultJourneyState,
  isZoneKind,
  type PlaceableKind,
} from '@city/shared';
import { createEngine, type SimulationEngine } from '../engine';
import { addServices, buildTown, flatCity, maintainTown, recoverCity, run } from './builders';
import { buildGridCity, maintainGrid } from './grid';

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
    description: 'Neon town: the balanced city plus a canal spine and two springHouses',
    defaultSize: 64,
    create(seed, size) {
      const engine = createEngine({
        seed,
        size,
        name: 'Neon',
        ruleset: 'oasis',
        terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
      });
      engine.disastersEnabled = false;
      addServices(engine, buildTown(engine, { pumps: 8 }));
      addNeonData(engine);
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
          run.onMonth(e);
          playJourney(e);
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
 * Fiber along the town's water spine, plus two springHouses.
 * The south hall touches the coal plant. The north hall touches the pump column.
 * A short spur makes that cable visible; the pumps already conduct data.
 * The south hall is placed first, so a search with both online starts there.
 * Only the neon preset calls this; `buildTown` stays shared with the classic scenarios.
 */
function addNeonData(engine: SimulationEngine): void {
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
    // Reserves only charge from spare water, so deep water comes first.
    if (engine.servedShares().water < 0.97)
      placeBeside(engine, 'qanat', engine.buildings.ofKind('waterPump'), 8);
    placeBeside(engine, 'cistern', engine.buildings.ofKind('waterPump'), 3);
  }
  if (chapter >= 2 && engine.buildings.ofKind('windbreak').length < 8) {
    const services = [...engine.buildings.values()].filter(
      (b) => !isZoneKind(b.kind) && PLACEABLE_SPECS[b.kind].jobs > 0 && b.kind !== 'windbreak',
    );
    placeBeside(engine, 'windbreak', services, 8);
  }
  if (chapter >= 4) placeBeside(engine, 'caravanserai', engine.buildings.ofKind('school'), 1);
  keepShade(engine);
}

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
