import {
  ERA_RANKS,
  JOURNEY_CHAPTERS,
  OASIS_ERA,
  OASIS_JOURNEY,
  type BuildingRecord,
  type EraState,
  type JourneyState,
} from '@city/shared';
import type { SimulationEngine } from '../../engine';
import { monthIndex } from '../../time';
import { cityTotals } from '../demand';
import { shelterCoverage } from './sandstorms';

/**
 * The journey (oasis ruleset, cities founded by the app only).
 *
 * Five chapters, checked in order at the month close, after growth, utilities and the oasis
 * updates. A completed chapter pays its grant into the treasury after the monthly budget.
 * The fourth chapter is a drought that starts one month after the third completes and draws
 * no random numbers. See docs/oasis-spec.md, "Journey".
 */

/** Well and pump output the n-th era dry season leaves (n counts from 0). */
export function eraDroughtFactor(n: number): number {
  const e = OASIS_ERA;
  return Math.max(e.droughtFactorFloor, e.droughtFactorStart - e.droughtFactorStep * n);
}

/** Month closes the n-th era dry season lasts (n counts from 0). */
export function eraDroughtLength(n: number): number {
  return Math.min(OASIS_ERA.droughtLongest, OASIS_ERA.droughtShortest + Math.floor(n / 2));
}

/** Grant for holding on through the n-th era dry season (n counts from 0). */
export function eraDroughtReward(n: number): number {
  return OASIS_ERA.droughtRewardBase + OASIS_ERA.droughtRewardStep * n;
}

/** Share of well and pump output left right now: 1 without a drought. */
export function droughtFactor(engine: SimulationEngine): number {
  const journey = engine.oasis.journey;
  if (engine.ruleset !== 'oasis' || !journey) return 1;
  if (journey.droughtMonthsLeft > 0) return OASIS_JOURNEY.droughtFactor;
  const era = journey.era;
  if (era && era.droughtMonthsLeft > 0) return eraDroughtFactor(era.droughts - 1);
  return 1;
}

/** Share of qanat output left right now: only era dry seasons reach the water table. */
export function qanatDroughtFactor(engine: SimulationEngine): number {
  const era = engine.ruleset === 'oasis' ? engine.oasis.journey?.era : undefined;
  if (!era || era.droughtMonthsLeft <= 0) return 1;
  return qanatFactor(eraDroughtFactor(era.droughts - 1));
}

/** Qanat output left by a dry season whose wells keep `factor`. */
export function qanatFactor(factor: number): number {
  return 1 - (1 - factor) * OASIS_ERA.qanatShare;
}

/** True while a drought (the journey's or an era dry season) cuts well and pump output. */
export function droughtActive(engine: SimulationEngine): boolean {
  return droughtFactor(engine) < 1;
}

/** Output left by the drought: wells and pumps take the cut, qanats part of an era one. */
export function droughtOutput(engine: SimulationEngine, b: BuildingRecord, supply: number): number {
  if (supply <= 0) return supply;
  const factor =
    b.kind === 'well' || b.kind === 'waterPump'
      ? droughtFactor(engine)
      : b.kind === 'qanat'
        ? qanatDroughtFactor(engine)
        : 1;
  return factor < 1 ? Math.round(supply * factor) : supply;
}

/** Share of water consumers served on the last solve (1 with no consumers). */
function waterServed(engine: SimulationEngine): number {
  return engine.servedShares().water;
}

function shadeServed(engine: SimulationEngine): number {
  return engine.servedShares().shade;
}

/** Whether the goal of `chapter` (0-based) holds right now. The drought is handled apart. */
export function chapterGoalMet(engine: SimulationEngine, chapter: number): boolean {
  const j = OASIS_JOURNEY;
  switch (chapter) {
    case 0:
      return (
        cityTotals(engine).residents >= j.residents &&
        waterServed(engine) >= j.servedShare &&
        shadeServed(engine) >= j.servedShare
      );
    case 1:
      return waterServed(engine) >= j.servedShare && storingBanks(engine) >= j.reserveBanks;
    case 2:
      return shelterCoverage(engine) >= j.shelter;
    case 4:
      return operatingCaravanserais(engine) > 0;
    default:
      return false;
  }
}

/** Powered, online cisterns at least `reserveCharge` full. */
export function storingBanks(engine: SimulationEngine): number {
  let count = 0;
  for (const entry of engine.oasis.cisterns) {
    const b = engine.buildings.get(entry.buildingId);
    if (
      b &&
      b.kind === 'cistern' &&
      b.powered &&
      b.offline === 0 &&
      entry.charge >= OASIS_JOURNEY.reserveCharge
    )
      count++;
  }
  return count;
}

/** Staffed caravanserais: powered, on a road and with workers. */
function operatingCaravanserais(engine: SimulationEngine): number {
  return engine.buildings.ofKind('caravanserai').filter((b) => b.occupancy > 0).length;
}

function complete(engine: SimulationEngine, reward: number, month: number): void {
  const journey = engine.oasis.journey;
  if (!journey) return;
  journey.completedMonths.push(month);
  journey.chapter++;
  engine.economy.funds += reward;
  engine.emit({ type: 'journeyChapter', chapter: journey.chapter, reward });
}

/** Month close: advance at most one chapter and run the drought calendar. */
export function updateJourney(engine: SimulationEngine): void {
  const journey = engine.oasis.journey;
  if (engine.ruleset !== 'oasis' || !journey) return;
  if (journey.chapter >= JOURNEY_CHAPTERS) {
    // A city that finished the journey before the era existed starts it at its next close.
    if (!journey.era) startEra(journey, monthIndex(engine.tick));
    updateEra(engine, journey.era);
    return;
  }
  const month = monthIndex(engine.tick);
  const j = OASIS_JOURNEY;
  if (journey.chapter === 3) {
    if (journey.droughtMonthsLeft > 0) {
      journey.droughtServed += Math.round(waterServed(engine) * 1000);
      journey.droughtMonthsLeft--;
      if (journey.droughtMonthsLeft > 0) return;
      const served = journey.droughtServed / (1000 * j.droughtMonths);
      const held = served >= j.droughtTarget;
      journey.droughtOutcome = held ? 1 : 0;
      // Networks recover their full output at the next refresh.
      engine.networksDirty = true;
      engine.emit({ type: 'droughtEnded', held, served: Math.round(served * 1000) / 1000 });
      complete(engine, held ? (j.rewards[3] as number) : j.droughtShortReward, month);
    } else if (journey.droughtOutcome < 0 && month >= journey.droughtStart) {
      journey.droughtMonthsLeft = j.droughtMonths;
      journey.droughtServed = 0;
      engine.networksDirty = true;
      engine.emit({ type: 'droughtStarted', months: j.droughtMonths });
    }
    return;
  }
  if (!chapterGoalMet(engine, journey.chapter)) return;
  const finished = journey.chapter;
  complete(engine, j.rewards[finished] as number, month);
  if (journey.chapter >= JOURNEY_CHAPTERS) startEra(journey, month);
  // The warning month: the drought starts at the next close.
  if (finished === 2) journey.droughtStart = month + 1;
}

/** The era opens when the last chapter completes; the first dry season is scheduled. */
function startEra(journey: JourneyState, month: number): void {
  journey.era = {
    rank: 0,
    rankMonths: [],
    droughts: 0,
    nextDrought: month + OASIS_ERA.firstDroughtAfter + 1,
    droughtMonthsLeft: 0,
    droughtLength: 0,
    droughtServed: 0,
    held: 0,
  };
}

/** Mean charge of powered, online cisterns, and how many there are. */
function bankCharge(engine: SimulationEngine): { banks: number; charge: number } {
  let banks = 0;
  let sum = 0;
  for (const entry of engine.oasis.cisterns) {
    const b = engine.buildings.get(entry.buildingId);
    if (!b || b.kind !== 'cistern' || !b.powered || b.offline > 0) continue;
    banks++;
    sum += entry.charge;
  }
  return { banks, charge: banks === 0 ? 0 : sum / banks };
}

/** Whether the city meets the goals of era rank `rank` (0-based) right now. */
export function eraRankMet(engine: SimulationEngine, rank: number): boolean {
  const goal = OASIS_ERA.ranks[rank];
  if (!goal) return false;
  const reserve = bankCharge(engine);
  return (
    cityTotals(engine).residents >= goal.residents &&
    waterServed(engine) >= goal.water &&
    shadeServed(engine) >= goal.shade &&
    shelterCoverage(engine) >= goal.shelter &&
    reserve.banks >= goal.banks &&
    (goal.banks === 0 || reserve.charge >= goal.charge)
  );
}

/**
 * Month close after the journey: the dry-season calendar, then at most one rank. A dry season
 * starts at `nextDrought` (the month before is its warning), samples water service at each close
 * and, when it ends, schedules the next one `droughtEvery` months later.
 */
function updateEra(engine: SimulationEngine, era: EraState | undefined): void {
  if (!era) return;
  const month = monthIndex(engine.tick);
  if (era.droughtMonthsLeft > 0) {
    era.droughtServed += Math.round(waterServed(engine) * 1000);
    era.droughtMonthsLeft--;
    if (era.droughtMonthsLeft === 0) {
      const n = era.droughts - 1;
      const served = era.droughtServed / (1000 * era.droughtLength);
      const held = served >= OASIS_ERA.droughtTarget;
      const reward = held ? eraDroughtReward(n) : 0;
      if (held) era.held++;
      engine.economy.funds += reward;
      era.nextDrought = month + OASIS_ERA.droughtEvery;
      engine.networksDirty = true;
      engine.emit({
        type: 'droughtEnded',
        held,
        served: Math.round(served * 1000) / 1000,
        reward,
      });
    }
  } else if (month >= era.nextDrought) {
    const n = era.droughts;
    era.droughts++;
    era.droughtLength = eraDroughtLength(n);
    era.droughtMonthsLeft = era.droughtLength;
    era.droughtServed = 0;
    engine.networksDirty = true;
    engine.emit({ type: 'droughtStarted', months: era.droughtLength });
  }
  if (era.rank >= ERA_RANKS || !eraRankMet(engine, era.rank)) return;
  const reward = OASIS_ERA.ranks[era.rank]!.reward;
  era.rankMonths.push(month);
  era.rank++;
  engine.economy.funds += reward;
  engine.emit({ type: 'eraRank', rank: era.rank, reward });
}

/** Telemetry for the HUD and guide. */
export function journeySummary(
  engine: SimulationEngine,
): NonNullable<NonNullable<ReturnType<SimulationEngine['stats']>['oasis']>['journey']> | null {
  const journey = engine.oasis.journey;
  if (engine.ruleset !== 'oasis' || !journey) return null;
  const month = monthIndex(engine.tick);
  const waiting =
    journey.chapter === 3 && journey.droughtMonthsLeft === 0 && journey.droughtOutcome < 0;
  const done = OASIS_JOURNEY.droughtMonths - journey.droughtMonthsLeft;
  return {
    chapter: journey.chapter,
    droughtIn: waiting ? Math.max(0, journey.droughtStart - month) : -1,
    droughtMonthsLeft: journey.droughtMonthsLeft,
    droughtServed:
      journey.droughtMonthsLeft > 0 && done > 0
        ? Math.round(journey.droughtServed / done) / 1000
        : journey.droughtOutcome >= 0
          ? Math.round(journey.droughtServed / OASIS_JOURNEY.droughtMonths) / 1000
          : -1,
    droughtOutcome: journey.droughtOutcome,
    reserves: storingBanks(engine),
    caravanserais: operatingCaravanserais(engine),
    ...(journey.era ? { era: eraSummary(engine, journey.era, month) } : {}),
  };
}

function eraSummary(engine: SimulationEngine, era: EraState, month: number) {
  const running = era.droughtMonthsLeft > 0;
  // While a dry season runs, describe it; otherwise describe the next one.
  const n = running ? era.droughts - 1 : era.droughts;
  const done = era.droughtLength - era.droughtMonthsLeft;
  const reserve = bankCharge(engine);
  return {
    rank: era.rank,
    banks: reserve.banks,
    charge: Math.round(reserve.charge * 1000) / 1000,
    droughts: era.droughts,
    held: era.held,
    droughtIn: running ? -1 : Math.max(0, era.nextDrought - month),
    droughtMonthsLeft: era.droughtMonthsLeft,
    droughtLength: running ? era.droughtLength : eraDroughtLength(n),
    droughtFactor: Math.round(eraDroughtFactor(n) * 100) / 100,
    droughtServed: running && done > 0 ? Math.round(era.droughtServed / done) / 1000 : -1,
    droughtReward: eraDroughtReward(n),
  };
}
