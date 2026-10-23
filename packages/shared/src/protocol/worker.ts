import type { Difficulty, Speed } from '../balance/balance';
import type { Command, CommandResult } from '../commands/commands';
import type { SaveError, SaveMeta } from '../schemas/save';
import type { EngineSnapshot } from '../schemas/snapshot';
import type { BuildingRecord } from '../types/buildings';
import type { CityStats, HistoryEntry, SimEvent } from '../types/stats';
import type { InfluenceLayer, StructureLayer } from '../types/tiles';
import type { Ruleset } from '../types/ruleset';

export interface TerrainOptions {
  /** Fraction of the map covered by water, 0..0.5. */
  water: number;
  /** 0 = flat, 1 = mountainous. */
  hills: number;
  /** Fraction of land with trees, 0..1. */
  forest: number;
  rivers: number;
  /** Generate a completely flat grass map (used by scenarios and tests). */
  flat?: boolean;
}

export interface NewCityOptions {
  name: string;
  seed: string;
  size: number;
  terrain: TerrainOptions;
  difficulty?: Difficulty;
  /** Rules the new city runs; defaults to `classic`. */
  ruleset?: Ruleset;
  /**
   * Envelope format for saves and exports; defaults to `SAVE_FORMAT`. Neo Urbe passes its own so
   * the two games never overwrite or import each other's files.
   */
  saveFormat?: string;
}

export type ToWorkerMessage =
  | { type: 'newCity'; options: NewCityOptions }
  | { type: 'loadCity'; snapshot: EngineSnapshot; saveFormat?: string }
  | { type: 'command'; id: number; command: Command }
  | { type: 'setSpeed'; speed: Speed }
  | { type: 'runTicks'; id: number; ticks: number }
  | { type: 'snapshot'; id: number }
  | { type: 'hash'; id: number }
  /** Encodes the current city as a save file (the host supplies the timestamp). */
  | { type: 'exportSave'; id: number; savedAt: string }
  /**
   * Decodes and validates a save; on success it replaces the current city. The envelope format
   * travels with the message because the import can happen before any city exists, when the worker
   * has not learned the ruleset yet.
   */
  | { type: 'importSave'; id: number; text: string; saveFormat?: string }
  /**
   * Builds the scripted city shown behind the main menu, simulating `months` months up front
   * (reports `demoProgress`, then `init`), and keeps it running at normal speed. The ruleset and
   * the envelope format travel with the message, because this city can be exported before any
   * `newCity` call teaches the worker which format the app uses.
   */
  | { type: 'demoCity'; seed: string; size: number; months: number; ruleset?: 'classic' | 'oasis'; saveFormat?: string };

export type LoadResult =
  | {
      ok: true;
      meta: SaveMeta;
      migratedFrom: number | null;
      /** Rules the loaded city runs under, taken from the file itself. */
      ruleset: 'classic' | 'oasis';
    }
  | { ok: false; errors: SaveError[] };

export interface FullState {
  size: number;
  name: string;
  seed: string;
  heights: Uint8Array;
  structure: Record<StructureLayer, Uint8Array>;
  influence: Record<InfluenceLayer, Uint8Array>;
  buildingId: Int32Array;
  /** Neon data service. Zeros in a classic city; not part of the simulation hash. */
  linked: Uint8Array;
  buildings: BuildingRecord[];
  stats: CityStats;
  history: HistoryEntry[];
}

export interface Delta {
  tick: number;
  /** Changed tiles: indices plus the value of every structure layer at those indices. */
  tiles: {
    indices: Int32Array;
    structure: Record<StructureLayer, Uint8Array>;
    buildingId: Int32Array;
    /** Data-service flag for each dirty tile, parallel to `indices`. */
    linked: Uint8Array;
  } | null;
  heights: Uint8Array | null;
  influence: Record<InfluenceLayer, Uint8Array> | null;
  buildings: BuildingRecord[];
  removedBuildings: number[];
  stats: CityStats;
  history: HistoryEntry[] | null;
  events: SimEvent[];
}

export type FromWorkerMessage =
  | { type: 'init'; state: FullState }
  | { type: 'delta'; delta: Delta }
  | { type: 'commandResult'; id: number; result: CommandResult }
  | { type: 'ticksDone'; id: number }
  | { type: 'snapshot'; id: number; snapshot: EngineSnapshot }
  | { type: 'hash'; id: number; hash: string }
  | { type: 'saveData'; id: number; text: string; meta: SaveMeta }
  /** Sent after the `init` of the loaded city when the load succeeded. */
  | { type: 'loadResult'; id: number; result: LoadResult }
  /** Months of the menu city simulated so far. */
  | { type: 'demoProgress'; done: number; total: number }
  | { type: 'error'; message: string };
