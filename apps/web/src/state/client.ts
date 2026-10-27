import {
  INFLUENCE_LAYERS,
  STRUCTURE_LAYERS,
  type BuildingRecord,
  type CityStats,
  type Command,
  type CommandResult,
  type Delta,
  type EngineSnapshot,
  type FromWorkerMessage,
  type FullState,
  type HistoryEntry,
  type LoadResult,
  type NewCityOptions,
  type SaveMeta,
  type SimEvent,
  type Speed,
  type ToWorkerMessage,
} from '@city/shared';
import { World } from '@city/simulation';
import { emitListeners, RpcInbox } from '@shell/bridge';

export interface ClientListener {
  /** A new city was loaded: everything must be rebuilt. */
  onInit?(): void;
  /** Tiles changed (`all` = every tile, e.g. after a heights change). */
  onTiles?(indices: Int32Array | null, all: boolean): void;
  onInfluence?(): void;
  onBuildings?(changed: BuildingRecord[], removed: number[]): void;
  onStats?(stats: CityStats): void;
  onHistory?(history: HistoryEntry[]): void;
  onEvents?(events: SimEvent[]): void;
  onError?(message: string): void;
}

export interface DemoCityOptions {
  seed: string;
  size: number;
  months: number;
  /** Rules the menu city runs under; it decides the envelope format of its save. */
  ruleset?: 'classic' | 'oasis';
  saveFormat?: string;
}

interface PendingDemo {
  onProgress?: (done: number, total: number) => void;
  fail(error: Error): void;
}

/**
 * Main-thread bridge to the simulation worker. Keeps a read-only mirror of the world so the
 * renderer and the UI can read state and run validation locally.
 */
export class CityClient {
  world: World | null = null;
  readonly buildings = new Map<number, BuildingRecord>();

  /** True when the mirror world has a building of this kind (one era work of each per city). */
  hasBuilding(kind: BuildingRecord['kind']): boolean {
    for (const b of this.buildings.values()) if (b.kind === kind) return true;
    return false;
  }
  stats: CityStats | null = null;
  history: HistoryEntry[] = [];
  name = '';
  seed = '';

  private readonly worker: Worker;
  private readonly listeners = new Set<ClientListener>();
  private readonly rpc = new RpcInbox<FromWorkerMessage>();
  private demo: PendingDemo | null = null;

  constructor() {
    this.worker = new Worker(new URL('../worker/sim.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (event: MessageEvent<FromWorkerMessage>) => this.handle(event.data);
    this.worker.onerror = (event) => this.demo?.fail(new Error(event.message || 'Worker failed'));
  }

  subscribe(listener: ClientListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  newCity(options: NewCityOptions): Promise<void> {
    return this.rpc.waitInit(() => this.send({ type: 'newCity', options }));
  }

  loadCity(snapshot: EngineSnapshot): Promise<void> {
    return this.rpc.waitInit(() => this.send({ type: 'loadCity', snapshot }));
  }

  /**
   * Builds the city shown behind the main menu. Resolves once its mirror world is loaded and
   * rejects if the worker reports an error before that.
   */
  demoCity(
    options: DemoCityOptions,
    onProgress?: (done: number, total: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const settle = () => {
        this.demo = null;
        resolve();
      };
      this.demo = {
        ...(onProgress ? { onProgress } : {}),
        fail: (error) => {
          this.demo = null;
          this.rpc.dropInit(settle);
          reject(error);
        },
      };
      this.rpc.addInit(settle);
      this.send({ type: 'demoCity', ...options });
    });
  }

  command(command: Command): Promise<CommandResult> {
    return this.rpc.request(
      (id) => this.send({ type: 'command', id, command }),
      (m) => (m.type === 'commandResult' ? m.result : undefined),
    );
  }

  setSpeed(speed: Speed): void {
    this.send({ type: 'setSpeed', speed });
  }

  runTicks(ticks: number): Promise<void> {
    return this.rpc.request((id) => this.send({ type: 'runTicks', id, ticks }), () => undefined);
  }

  snapshot(): Promise<EngineSnapshot> {
    return this.rpc.request(
      (id) => this.send({ type: 'snapshot', id }),
      (m) => (m.type === 'snapshot' ? m.snapshot : undefined),
    );
  }

  hash(): Promise<string> {
    return this.rpc.request(
      (id) => this.send({ type: 'hash', id }),
      (m) => (m.type === 'hash' ? m.hash : undefined),
    );
  }

  exportSave(savedAt: string): Promise<{ text: string; meta: SaveMeta }> {
    return this.rpc.request(
      (id) => this.send({ type: 'exportSave', id, savedAt }),
      (m) => (m.type === 'saveData' ? { text: m.text, meta: m.meta } : undefined),
    );
  }

  /** Loads a save in the worker; on success the mirror world is rebuilt before this resolves. */
  importSave(text: string, saveFormat?: string): Promise<LoadResult> {
    return this.rpc.request(
      (id) => this.send({ type: 'importSave', id, text, saveFormat }),
      (m) => (m.type === 'loadResult' ? m.result : undefined),
    );
  }

  dispose(): void {
    this.worker.terminate();
  }

  private send(message: ToWorkerMessage): void {
    this.worker.postMessage(message);
  }

  private emit<K extends keyof ClientListener>(
    key: K,
    ...args: Parameters<NonNullable<ClientListener[K]>>
  ): void {
    emitListeners(this.listeners, key, ...args);
  }

  private handle(message: FromWorkerMessage): void {
    switch (message.type) {
      case 'init':
        this.applyInit(message.state);
        break;
      case 'delta':
        this.applyDelta(message.delta);
        break;
      case 'demoProgress':
        this.demo?.onProgress?.(message.done, message.total);
        break;
      case 'error':
        console.error('[simulation]', message.message);
        if (this.demo) {
          this.demo.fail(new Error(message.message));
          break;
        }
        this.emit('onError', message.message);
        break;
      default:
        this.rpc.settle(message.id, message);
        break;
    }
  }

  private applyInit(state: FullState): void {
    const world = new World(state.size);
    world.heights.set(state.heights);
    for (const name of STRUCTURE_LAYERS) world.structure[name].set(state.structure[name]);
    for (const name of INFLUENCE_LAYERS) world.influence[name].set(state.influence[name]);
    world.buildingId.set(state.buildingId);
    if (state.linked) world.linked.set(state.linked);
    world.takeDirty();
    this.world = world;
    this.name = state.name;
    this.seed = state.seed;
    this.buildings.clear();
    for (const b of state.buildings) this.buildings.set(b.id, b);
    this.stats = state.stats;
    this.history = state.history;
    this.emit('onInit');
    this.emit('onStats', state.stats);
    this.emit('onHistory', state.history);
    this.rpc.resolveInit();
  }

  private applyDelta(delta: Delta): void {
    const world = this.world;
    if (!world) return;
    for (const id of delta.removedBuildings) this.buildings.delete(id);
    for (const b of delta.buildings) this.buildings.set(b.id, b);
    if (delta.heights) world.heights.set(delta.heights);
    if (delta.tiles) {
      // Raw layer writes bypass World.setInfra, so invalidate derived road data explicitly.
      world.roadVersion++;
      const { indices, structure, buildingId } = delta.tiles;
      for (const name of STRUCTURE_LAYERS) {
        const target = world.structure[name];
        const values = structure[name];
        for (let k = 0; k < indices.length; k++) target[indices[k] as number] = values[k] as number;
      }
      for (let k = 0; k < indices.length; k++) {
        const i = indices[k] as number;
        world.buildingId[i] = buildingId[k] as number;
        if (delta.tiles.linked) world.linked[i] = delta.tiles.linked[k] as number;
      }
    }
    if (delta.influence) {
      for (const name of INFLUENCE_LAYERS) world.influence[name].set(delta.influence[name]);
    }
    if (delta.buildings.length > 0 || delta.removedBuildings.length > 0) {
      this.emit('onBuildings', delta.buildings, delta.removedBuildings);
    }
    if (delta.heights) this.emit('onTiles', null, true);
    else if (delta.tiles) this.emit('onTiles', delta.tiles.indices, false);
    if (delta.influence) this.emit('onInfluence');
    this.stats = delta.stats;
    this.emit('onStats', delta.stats);
    if (delta.history) {
      this.history = delta.history;
      this.emit('onHistory', delta.history);
    }
    if (delta.events.length > 0) this.emit('onEvents', delta.events);
  }
}
