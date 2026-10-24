/** Persisted state of the neon ruleset systems. Plain data, serialized with the snapshot. */

/** One megacorporation: an autonomous land buyer with a war chest and a taste for a district. */
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
}

/** A live intrusion against one service building. */
export interface Storm {
  /** Building under attack. */
  buildingId: number;
  /** Ticks the service stays offline. */
  ticks: number;
  /** Firewall coverage at the moment of the attack, 0..1 (for diagnostics). */
  windbreak: number;
  /** Storm flavour: `ransom`, `wipe` or `spoof`. */
  kind: string;
}

/** Persisted state of every neon system. */
export interface OasisState {
  /** Optional for legacy saves. Accrued ticks survive a toggle and a mid-month reload. */
  waterPolicy?: { rationing: boolean; rationedTicks: number };

  caravans: Caravan[];
  cisterns: BatteryState[];
  storms: Storm[];
  /** Anchor tile index of districts currently parched. */
  parched: number[];
  /** Month index of the last corporate expansion, so it happens once a month. */
  lastCaravanMonth: number;
  /** Month index of the last intrusion roll. */
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
