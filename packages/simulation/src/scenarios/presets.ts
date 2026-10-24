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
