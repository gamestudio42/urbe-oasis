import { JOURNEY_CHAPTERS, OASIS_JOURNEY, type BuildingRecord } from '@city/shared';
import type { SimulationEngine } from '../../engine';
import { monthIndex } from '../../time';
import { cityTotals } from '../demand';
import { shelterCoverage } from './intrusion';

/**
 * The journey (oasis ruleset, cities founded by the app only).
 *
 * Five chapters, checked in order at the month close, after growth, utilities and the oasis
 * updates. A completed chapter pays its grant into the treasury after the monthly budget.
 * The fourth chapter is a drought that starts one month after the third completes and draws
 * no random numbers. See docs/oasis-spec.md, "Journey".
 */

/** True while the drought cuts well and pump output. */
export function droughtActive(engine: SimulationEngine): boolean {
  return engine.ruleset === 'oasis' && (engine.oasis.journey?.droughtMonthsLeft ?? 0) > 0;
}

/** Well and pump output left by the drought; other sources keep their full output. */
export function droughtOutput(engine: SimulationEngine, b: BuildingRecord, supply: number): number {
  if (supply <= 0 || (b.kind !== 'well' && b.kind !== 'waterPump') || !droughtActive(engine))
    return supply;
  return Math.round(supply * OASIS_JOURNEY.droughtFactor);
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
      return engine.buildings.ofKind('caravanserai').some((b) => b.occupancy > 0);
    default:
      return false;
  }
}

/** Powered, online cisterns that hold some water. */
export function storingBanks(engine: SimulationEngine): number {
  let count = 0;
  for (const entry of engine.oasis.cisterns) {
    const b = engine.buildings.get(entry.buildingId);
    if (b && b.kind === 'cistern' && b.powered && b.offline === 0 && entry.charge > 0) count++;
  }
  return count;
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
  if (engine.ruleset !== 'oasis' || !journey || journey.chapter >= JOURNEY_CHAPTERS) return;
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
  // The warning month: the drought starts at the next close.
  if (finished === 2) journey.droughtStart = month + 1;
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
  };
}
