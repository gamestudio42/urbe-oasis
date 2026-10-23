import {
  OASIS_SAVE_FORMAT,
  SAVE_FORMAT,
  decodeSave,
  encodeSave,
  INFLUENCE_LAYERS,
  SPEED_TICKS_PER_SECOND,
  STRUCTURE_LAYERS,
  stringifySave,
  type Delta,
  type FromWorkerMessage,
  type FullState,
  type InfluenceLayer,
  type StructureLayer,
  type ToWorkerMessage,
} from '@city/shared';
import { createEngine, hashState, SIM_PRESETS, SimulationEngine } from '@city/simulation';
import { startFixedStep, WorkerClock } from '@shell/bridge';

interface WorkerScope {
  postMessage(message: FromWorkerMessage): void;
  onmessage: ((event: MessageEvent<ToWorkerMessage>) => void) | null;
}

const scope = self as unknown as WorkerScope;
const DEMO_PROGRESS_MONTHS = 6;

let engine: SimulationEngine | null = null;
/** Envelope format used by `exportSave` / `importSave`; Neo Urbe switches it on `newCity`. */
let saveFormat: string = SAVE_FORMAT;
const clock = new WorkerClock(SPEED_TICKS_PER_SECOND);

/** The envelope format a ruleset writes: the two games never share a file format. */
function formatFor(ruleset: 'classic' | 'oasis' | undefined): string {
  return ruleset === 'oasis' ? OASIS_SAVE_FORMAT : SAVE_FORMAT;
}

function post(message: FromWorkerMessage): void {
  scope.postMessage(message);
}

function fullState(e: SimulationEngine): FullState {
  const w = e.world;
  w.takeDirty();
  w.heightsDirty = false;
  w.influenceDirty = false;
  e.buildings.takeChanges();
  e.takeEvents();
  e.historyDirty = false;
  return {
    size: w.size,
    name: e.name,
    seed: e.seed,
    heights: w.heights.slice(),
    structure: copyLayers(w.structure, STRUCTURE_LAYERS),
    influence: copyLayers(w.influence, INFLUENCE_LAYERS),
    buildingId: w.buildingId.slice(),
    linked: w.linked.slice(),
    buildings: e.buildings.list().map((b) => ({ ...b })),
    stats: e.stats(),
    history: e.history.map((h) => ({ ...h })),
  };
}

function copyLayers<K extends string>(
  source: Record<K, Uint8Array>,
  names: readonly K[],
): Record<K, Uint8Array> {
  const out = {} as Record<K, Uint8Array>;
  for (const name of names) out[name] = source[name].slice();
  return out;
}

function buildDelta(e: SimulationEngine): Delta {
  const w = e.world;
  const dirty = w.takeDirty();
  let tiles: Delta['tiles'] = null;
  if (dirty.length > 0) {
    const indices = Int32Array.from(dirty);
    const structure = {} as Record<StructureLayer, Uint8Array>;
    for (const name of STRUCTURE_LAYERS) {
      const src = w.structure[name];
      const out = new Uint8Array(indices.length);
      for (let k = 0; k < indices.length; k++) out[k] = src[indices[k] as number] as number;
      structure[name] = out;
    }
    const buildingId = new Int32Array(indices.length);
    const linked = new Uint8Array(indices.length);
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k] as number;
      buildingId[k] = w.buildingId[i] as number;
      linked[k] = w.linked[i] as number;
    }
    tiles = { indices, structure, buildingId, linked };
  }
  let influence: Record<InfluenceLayer, Uint8Array> | null = null;
  if (w.influenceDirty) {
    influence = copyLayers(w.influence, INFLUENCE_LAYERS);
    w.influenceDirty = false;
  }
  let heights: Uint8Array | null = null;
  if (w.heightsDirty) {
    heights = w.heights.slice();
    w.heightsDirty = false;
  }
  const { changed, removed } = e.buildings.takeChanges();
  let history: Delta['history'] = null;
  if (e.historyDirty) {
    history = e.history.map((h) => ({ ...h }));
    e.historyDirty = false;
  }
  return {
    tick: e.tick,
    tiles,
    heights,
    influence,
    buildings: changed,
    removedBuildings: removed,
    stats: e.stats(),
    history,
    events: e.takeEvents(),
  };
}

function publish(): void {
  if (!engine) return;
  post({ type: 'delta', delta: buildDelta(engine) });
}

function frame(ticks: number): void {
  if (!engine) return;
  engine.runTicks(ticks);
  publish();
}

scope.onmessage = (event) => {
  const message = event.data;
  try {
    switch (message.type) {
      case 'newCity':
        engine = createEngine(message.options);
        saveFormat = message.options.saveFormat ?? formatFor(message.options.ruleset);
        clock.reset();
        post({ type: 'init', state: fullState(engine) });
        break;
      case 'loadCity':
        engine = SimulationEngine.fromSnapshot(message.snapshot);
        if (message.saveFormat) saveFormat = message.saveFormat;
        clock.setSpeed(0);
        clock.reset();
        post({ type: 'init', state: fullState(engine) });
        break;
      case 'command': {
        if (!engine) throw new Error('No city loaded');
        const result = engine.execute(message.command);
        publish();
        post({ type: 'commandResult', id: message.id, result });
        break;
      }
      case 'setSpeed':
        clock.setSpeed(message.speed);
        break;
      case 'runTicks':
        if (!engine) throw new Error('No city loaded');
        engine.runTicks(message.ticks);
        publish();
        post({ type: 'ticksDone', id: message.id });
        break;
      case 'snapshot':
        if (!engine) throw new Error('No city loaded');
        post({ type: 'snapshot', id: message.id, snapshot: engine.serialize() });
        break;
      case 'hash':
        if (!engine) throw new Error('No city loaded');
        post({ type: 'hash', id: message.id, hash: hashState(engine) });
        break;
      case 'exportSave': {
        if (!engine) throw new Error('No city loaded');
        const stats = engine.stats();
        const file = encodeSave(
          engine.serialize(),
          {
            population: stats.population,
            funds: stats.funds,
            savedAt: message.savedAt,
          },
          { format: saveFormat },
        );
        post({ type: 'saveData', id: message.id, text: stringifySave(file), meta: file.meta });
        break;
      }
      case 'importSave': {
        // The host may know the ruleset before any city exists, so the format can arrive with the
        // message. The decoder accepts every known city format and the file's own `ruleset`
        // decides which rules the loaded city runs under.
        const decoded = decodeSave(message.text, { format: message.saveFormat ?? saveFormat });
        if (!decoded.ok) {
          post({ type: 'loadResult', id: message.id, result: decoded });
          break;
        }
        // From now on this app writes in the same format the file used.
        saveFormat =
          decoded.snapshot.ruleset === 'oasis' ? OASIS_SAVE_FORMAT : SAVE_FORMAT;
        engine = SimulationEngine.fromSnapshot(decoded.snapshot);
        // Loaded cities start paused so the restored state is exactly the saved one.
        clock.setSpeed(0);
        clock.reset();
        post({ type: 'init', state: fullState(engine) });
        post({
          type: 'loadResult',
          id: message.id,
          result: {
            ok: true,
            meta: decoded.meta,
            migratedFrom: decoded.migratedFrom,
            ruleset: engine.ruleset,
          },
        });
        break;
      }
      case 'demoCity': {
        const preset = SIM_PRESETS.grid;
        if (!preset) throw new Error('Missing grid preset');
        const run = preset.create(message.seed, message.size);
        for (let month = 1; month <= message.months; month++) {
          run.engine.runMonths(1);
          run.onMonth(run.engine);
          if (month % DEMO_PROGRESS_MONTHS === 0 || month === message.months) {
            post({ type: 'demoProgress', done: month, total: message.months });
          }
        }
        engine = run.engine;
        // The menu city belongs to the app's ruleset, so its save carries the matching format.
        saveFormat = message.saveFormat ?? formatFor(message.ruleset);
        clock.setSpeed(1);
        clock.reset();
        post({ type: 'init', state: fullState(engine) });
        break;
      }
    }
  } catch (error) {
    post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};

startFixedStep(clock, frame);
