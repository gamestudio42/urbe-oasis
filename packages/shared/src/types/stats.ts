import type { Department } from '../balance/balance';
import type { DisasterKind } from '../commands/commands';
import type { ZoneBuildingKind } from './buildings';

export type RciValues = Record<ZoneBuildingKind, number>;

export const EXPENSE_CATEGORIES = [
  'transport',
  'power',
  'water',
  'police',
  'fire',
  'health',
  'education',
  'parks',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface MonthlyReport {
  revenue: RciValues;
  expenses: Record<ExpenseCategory, number>;
  /** One-off construction spending during the month (not part of `net`). */
  construction: number;
  net: number;
}

export interface EconomyState {
  funds: number;
  /** Construction spending accumulated since the last monthly report. */
  constructionThisMonth: number;
  taxes: RciValues;
  funding: Record<Department, number>;
  lastMonth: MonthlyReport;
  monthsInDebt: number;
  bankrupt: boolean;
}

export interface ActiveDisaster {
  kind: DisasterKind;
  remainingTicks: number;
  x: number;
  y: number;
  /** Building affected by a blackout, or 0. */
  targetId: number;
}

export interface UtilityStats {
  supply: number;
  demand: number;
  /** Fraction of consumer buildings served, 0..1. */
  served: number;
}

export interface CityStats {
  name: string;
  /** Rules this city runs; the UI hides neon-only tools for `classic`. */
  ruleset: 'classic' | 'oasis';
  tick: number;
  day: number;
  month: number;
  year: number;
  funds: number;
  population: number;
  housingCapacity: number;
  workforce: number;
  jobs: RciValues;
  employed: RciValues;
  unemployment: number;
  demand: RciValues;
  taxes: RciValues;
  funding: Record<Department, number>;
  lastMonth: MonthlyReport;
  power: UtilityStats;
  water: UtilityStats;
  avgCongestion: number;
  averages: { pollution: number; crime: number; landValue: number };
  coverage: { police: number; fire: number; health: number; education: number };
  counts: {
    roads: number;
    residential: number;
    commercial: number;
    industrial: number;
    abandoned: number;
    services: number;
    plants: number;
  };
  monthsInDebt: number;
  bankrupt: boolean;
  activeFires: number;
  disasters: ActiveDisaster[];
  disastersEnabled: boolean;
  edgeConnected: boolean;
  /** Neon-only telemetry; absent in a classic city. */
  oasis?: {
    waterPolicy: {
      enabled: boolean;
      normalDemand: number;
      rationedDemand: number;
      fullMonthPenalty: number;
      accruedPenalty: number;
    };

    /** Districts above the grid overload threshold. */
    parched: number;
    /** Battery banks and their mean charge 0..1. */
    cisterns: { banks: number; charge: number };
    /** Share of services under windbreak cover 0..1. */
    windbreak: number;
    /** Online drone ports. */
    arcades: number;
    /** Caravans and their total holdings. */
    caravans: { count: number; holdings: number };
    /** Cash caravans have paid into the treasury. */
    trade: number;
    /** Shade network: supply, demand and the share of lots reached. */
    data: { supply: number; demand: number; served: number };
    /** Tile of the wandering spring. */
    spring: { x: number; y: number };
    /** Post-tutorial journey; absent for cities that were not founded by the Oasis app. */
    journey?: {
      /** Chapters completed, 0..5. */
      chapter: number;
      /** Months until the drought starts (0 when it starts at the next close); -1 otherwise. */
      droughtIn: number;
      /** Month closes left in an active drought; 0 when none is running. */
      droughtMonthsLeft: number;
      /** Mean water service over the drought closes so far, 0..1; -1 before the first. */
      droughtServed: number;
      /** -1 before the drought ends, 1 when the city held on, 0 when it fell short. */
      droughtOutcome: number;
    };
  };
}

export interface HistoryEntry {
  month: number;
  population: number;
  funds: number;
  jobs: number;
  demandR: number;
  demandC: number;
  demandI: number;
  revenue: number;
  expenses: number;
  pollution: number;
  crime: number;
  landValue: number;
}

export type SimEvent =
  | { type: 'fireStarted'; x: number; y: number }
  | { type: 'buildingDestroyed'; x: number; y: number; cause: 'fire' | 'flood' | 'earthquake' }
  | { type: 'disasterStarted'; disaster: DisasterKind; x: number; y: number }
  | { type: 'disasterEnded'; disaster: DisasterKind }
  | { type: 'brownout' }
  | { type: 'waterShortage' }
  | { type: 'debt'; months: number }
  | { type: 'bankrupt' }
  | { type: 'recovered' }
  | { type: 'milestone'; population: number }
  | { type: 'newYear'; year: number }
  // Neo ruleset only.
  | { type: 'waterStress'; x: number; y: number }
  | { type: 'canalCollapse'; x: number; y: number; tiles: number }
  | { type: 'caravanTrade'; caravan: number; x: number; y: number }
  | { type: 'caravanLeave'; caravan: number; x: number; y: number }
  | { type: 'sandstorm'; x: number; y: number; kind: string; blocked: boolean }
  | { type: 'springMoved'; x: number; y: number }
  | { type: 'journeyChapter'; chapter: number; reward: number }
  | { type: 'droughtStarted'; months: number }
  | { type: 'droughtEnded'; held: boolean; served: number }
  | { type: 'arcadeOpen'; x: number; y: number };

export type ProblemCode =
  | 'NO_ZONE'
  | 'NO_ROAD'
  | 'NO_POWER'
  | 'BROWNOUT'
  | 'NO_WATER_FOR_LEVEL'
  | 'LOW_DEMAND'
  | 'NO_JOB_ACCESS'
  | 'NO_CUSTOMERS'
  | 'NO_WORKERS'
  | 'POLLUTION'
  | 'CRIME'
  | 'LOW_LAND_VALUE'
  | 'CONGESTION'
  | 'HIGH_TAXES'
  | 'SLOPE'
  | 'ABANDONED'
  | 'ON_FIRE'
  | 'RUBBLE'
  | 'FLOODED'
  | 'MAX_LEVEL'
  | 'GROWING'
  // Neo ruleset only.
  | 'WATER_STRESS'
  | 'CARAVAN_LOT'
  | 'BURIED'
  | 'NO_WINDBREAK'
  | 'ARCADE'
  | 'NO_SHADE';

export interface Problem {
  code: ProblemCode;
  /** 0 = info, 1 = minor, 2 = major, 3 = blocking. */
  severity: 0 | 1 | 2 | 3;
}
