/** Persisted state of the Oasis ruleset systems. Plain data, serialized with the snapshot. */

/** One caravan house: an autonomous land buyer with capital and a taste for a district. */
export interface Caravan {
  id: number;
  name: string;
  /** Cash available for land purchases. */
  capital: number;
  /** Preferred quadrant of the map: 0 north-west, 1 north-east, 2 south-west, 3 south-east. */
  quadrant: number;
  /** Lots bought so far, for the UI and diagnostics. */
  holdings: number;
}

/** A cistern bank's stored energy, 0..1 of its rated capacity. */
export interface BatteryState {
  buildingId: number;
  /** Fraction of a full charge. */
  charge: number;
  /** Tick of the last settlement, for charging by elapsed days. Absent in older saves. */
  settledTick?: number;
}

/** A sandstorm that buried one service building. */
export interface Storm {
  /** Building under attack. */
  buildingId: number;
  /** Ticks the service stays offline. */
  ticks: number;
  /** Windbreak coverage when the storm landed, 0..1 (for diagnostics). */
  windbreak: number;
  /** Storm flavour, one of `STORM_KINDS` (`haboob`, `drift`, `gust`). */
  kind: string;
}

/** Progress through the post-tutorial journey. Created only for cities founded by the Oasis app. */
export interface JourneyState {
  /** Chapters completed, 0..JOURNEY_CHAPTERS. */
  chapter: number;
  /** Month index at which each completed chapter closed, in order. */
  completedMonths: number[];
  /** Month index of the first close that starts the drought; -1 until chapter 3 completes. */
  droughtStart: number;
  /** Month closes left in the active drought; 0 when none is running. */
  droughtMonthsLeft: number;
  /** Sum of water service shares at drought closes, in thousandths. */
  droughtServed: number;
  /** -1 before the drought ends, 1 when the city held on, 0 when it fell short. */
  droughtOutcome: number;
  /** The era after the journey; created when the last chapter completes. */
  era?: EraState;
}

/** Ranks and recurring dry seasons after the journey. */
export interface EraState {
  /** Ranks reached, 0..ERA_RANKS. */
  rank: number;
  /** Month index at which each rank was reached, in order. */
  rankMonths: number[];
  /** Era dry seasons started so far; the running one counts. */
  droughts: number;
  /** Month index of the first close of the next dry season (its warning month precedes it). */
  nextDrought: number;
  /** Month closes left in the running dry season; 0 when none runs. */
  droughtMonthsLeft: number;
  /** Month closes the running (or last) dry season lasts. */
  droughtLength: number;
  /** Sum of water service shares at the running dry season's closes, in thousandths. */
  droughtServed: number;
  /** Dry seasons the city held on through. */
  held: number;
}

export function defaultJourneyState(): JourneyState {
  return {
    chapter: 0,
    completedMonths: [],
    droughtStart: -1,
    droughtMonthsLeft: 0,
    droughtServed: 0,
    droughtOutcome: -1,
  };
}

/** Persisted state of every Oasis system. */
export interface OasisState {
  /** Optional for legacy saves. Accrued ticks survive a toggle and a mid-month reload. */
  waterPolicy?: { rationing: boolean; rationedTicks: number };
  /** Optional: legacy saves, imports and scenario presets have no journey. */
  journey?: JourneyState;

  caravans: Caravan[];
  cisterns: BatteryState[];
  storms: Storm[];
  /** Anchor tile index of districts currently parched. */
  parched: number[];
  /** Month index of the last corporate expansion, so it happens once a month. */
  lastCaravanMonth: number;
  /** Month index of the last sandstorm roll. */
  lastStormMonth: number;
  /** Total cash the caravans have paid into the city. */
  trade: number;
  /** Storms blocked by a windbreak, for the report and diagnostics. */
  blocked: number;
  /** Tile of the wandering spring. -1 until the city places it. */
  springX: number;
  springY: number;
  /** Month index of the last spring step. -1 before the first month. */
  lastSpringMonth: number;
}

export const CARAVAN_NAMES = [
  'Salt Road',
  'Dune House',
  'Amber Line',
  'Well Compact',
  'Date Banner',
] as const;

export function defaultOasisState(): OasisState {
  return {
    caravans: [],
    cisterns: [],
    storms: [],
    parched: [],
    lastCaravanMonth: -1,
    lastStormMonth: -1,
    trade: 0,
    blocked: 0,
    springX: -1,
    springY: -1,
    lastSpringMonth: -1,
  };
}
