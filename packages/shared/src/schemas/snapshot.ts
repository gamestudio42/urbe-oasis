import type { BuildingRecord } from '../types/buildings';
import type { ActiveDisaster, EconomyState, HistoryEntry, RciValues } from '../types/stats';
import type { OasisState } from '../types/oasis';
import type { Ruleset } from '../types/ruleset';
import type { InfluenceLayer, StructureLayer } from '../types/tiles';

export type SnapshotLayer = StructureLayer | InfluenceLayer;

/** Complete, plain-data engine state. Everything needed to resume a simulation exactly. */
export interface EngineSnapshot {
  name: string;
  /** Rules the simulation runs; absent in pre-ruleset snapshots, meaning `classic`. */
  ruleset?: Ruleset;
  seed: string;
  size: number;
  tick: number;
  rng: [number, number, number, number];
  heights: Uint8Array;
  /**
   * Structure and influence layers. `linked` is the Oasis shade service and is absent in a classic
   * snapshot, so classic hashes do not gain a layer.
   */
  layers: Record<SnapshotLayer, Uint8Array> & { linked?: Uint8Array };
  buildings: BuildingRecord[];
  nextBuildingId: number;
  economy: EconomyState;
  demand: RciValues;
  history: HistoryEntry[];
  disasters: ActiveDisaster[];
  disastersEnabled: boolean;
  networksDirty: boolean;
  lastMilestone: number;
  /** Oasis systems state; absent in classic cities. */
  oasis?: OasisState;
}
