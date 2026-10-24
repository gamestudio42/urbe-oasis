import type { Department } from '../balance/balance';
import type { PlaceableKind, ZoneBuildingKind } from '../types/buildings';
import type { ZoneDensity, ZoneType } from '../types/tiles';

export interface Area {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type DisasterKind = 'fire' | 'flood' | 'earthquake' | 'crisis' | 'blackout' | 'epidemic';

export type ToolCommand =
  | ({ type: 'road' } & Area)
  | ({ type: 'powerLine' } & Area)
  | ({ type: 'pipe' } & Area)
  | ({ type: 'canal' } & Area)
  | ({ type: 'zone'; zone: ZoneType; density: ZoneDensity } & Area)
  | ({ type: 'demolish'; underground?: boolean } & Area)
  | ({ type: 'level' } & Area)
  | ({ type: 'raise' } & Area)
  | ({ type: 'lower' } & Area)
  | ({ type: 'plantTrees' } & Area)
  | { type: 'place'; kind: PlaceableKind; x: number; y: number };

export type PolicyCommand =
  | { type: 'setWaterRationing'; enabled: boolean }
  | { type: 'setTax'; zone: ZoneBuildingKind; rate: number }
  | { type: 'setFunding'; department: Department; value: number }
  | { type: 'setDisasters'; enabled: boolean }
  | { type: 'triggerDisaster'; disaster: DisasterKind; x?: number; y?: number }
  | { type: 'rename'; name: string };

export type Command = ToolCommand | PolicyCommand;

export type ToolType = ToolCommand['type'];

const TOOL_TYPES: ReadonlySet<string> = new Set<ToolType>([
  'road',
  'powerLine',
  'pipe',
  'canal',
  'zone',
  'demolish',
  'level',
  'raise',
  'lower',
  'plantTrees',
  'place',
]);

export function isToolCommand(command: Command): command is ToolCommand {
  return TOOL_TYPES.has(command.type);
}

export const RejectReason = {
  OutOfBounds: 'OUT_OF_BOUNDS',
  Water: 'WATER',
  Slope: 'SLOPE',
  Occupied: 'OCCUPIED',
  AlreadyBuilt: 'ALREADY_BUILT',
  InsufficientFunds: 'INSUFFICIENT_FUNDS',
  Bankrupt: 'BANKRUPT',
  NotFlatFootprint: 'NOT_FLAT_FOOTPRINT',
  LevelAffectsConstruction: 'LEVEL_AFFECTS_CONSTRUCTION',
  NothingToDo: 'NOTHING_TO_DO',
  Rubble: 'RUBBLE',
  OnFire: 'ON_FIRE',
  Locked: 'LOCKED',
  NeedsWater: 'NEEDS_WATER',
  NeedsRoad: 'NEEDS_ROAD',
  Invalid: 'INVALID',
} as const;
export type RejectReason = (typeof RejectReason)[keyof typeof RejectReason];

export interface TileRejection {
  index: number;
  reason: RejectReason;
}

/** Result of validating a tool command without applying it. */
export interface CommandPreview {
  ok: boolean;
  cost: number;
  /** Tile indices that would change. */
  valid: number[];
  invalid: TileRejection[];
  /** Reason for refusing the whole command, or the most frequent tile rejection. */
  reason?: RejectReason;
}

export interface CommandResult {
  ok: boolean;
  cost: number;
  applied: number;
  skipped: number;
  reason?: RejectReason;
}
