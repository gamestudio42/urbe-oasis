import {
  ERA_RANKS,
  OASIS_ERA,
  OASIS_SAVE_FORMAT,
  decodeSave,
  encodeSave,
  stringifySave,
  type SimEvent,
} from '@city/shared';
import {
  SIM_PRESETS,
  SimulationEngine,
  createEngine,
  droughtFactor,
  eraDroughtFactor,
  eraDroughtLength,
  eraDroughtReward,
  hashState,
  qanatDroughtFactor,
  qanatFactor,
} from '@city/simulation';
import { describe, expect, it } from 'vitest';

const flat = { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 };
const meta = { population: 0, funds: 0, savedAt: '2026-10-26T00:00:00.000Z' };

/** A finished journey, so the era runs from the next close. */
function finished(): SimulationEngine {
  const e = createEngine({ seed: 'era', size: 32, ruleset: 'oasis', terrain: flat, journey: true });
  e.disastersEnabled = false;
  Object.assign(e.oasis.journey!, {
    chapter: 5,
    completedMonths: [0, 0, 0, 0, 0],
    droughtOutcome: 1,
  });
  return e;
}

const eraEvents = (events: SimEvent[]) =>
  events.filter((x) => ['droughtStarted', 'droughtEnded', 'eraRank'].includes(x.type));

describe('the Oasis era after the journey', () => {
  it('escalates dry seasons to a floor and a longest length, with growing grants', () => {
    expect(eraDroughtFactor(0)).toBeCloseTo(OASIS_ERA.droughtFactorStart, 9);
    expect(eraDroughtFactor(1)).toBeLessThan(eraDroughtFactor(0));
    expect(eraDroughtFactor(99)).toBe(OASIS_ERA.droughtFactorFloor);
    expect(eraDroughtLength(0)).toBe(OASIS_ERA.droughtShortest);
    expect(eraDroughtLength(2)).toBeGreaterThan(eraDroughtLength(0));
    expect(eraDroughtLength(99)).toBe(OASIS_ERA.droughtLongest);
    expect(eraDroughtReward(1)).toBeGreaterThan(eraDroughtReward(0));
    // Qanats take part of the cut, never more than wells.
    expect(qanatFactor(0.4)).toBeGreaterThan(0.4);
    expect(qanatFactor(0.4)).toBeLessThan(1);
  });

  it('starts for a journey finished before the era existed and schedules the first dry season', () => {
    const e = finished();
    e.runMonths(1);
    const era = e.oasis.journey!.era!;
    expect(era).toMatchObject({ rank: 0, droughts: 0, droughtMonthsLeft: 0, held: 0 });
    // Started at this close; the first dry season begins `firstDroughtAfter + 1` closes later.
    expect(e.stats().oasis!.journey!.era!.droughtIn).toBe(OASIS_ERA.firstDroughtAfter + 1);
  });

  it('runs the dry-season calendar, cutting wells fully and qanats in part', () => {
    const e = finished();
    e.runMonths(1);
    const era = e.oasis.journey!.era!;
    era.nextDrought = Math.floor(e.tick / 120) + 1;
    const events: SimEvent[] = [];
    e.runMonths(1);
    events.push(...eraEvents(e.takeEvents()));
    expect(events).toEqual([{ type: 'droughtStarted', months: eraDroughtLength(0) }]);
    expect(droughtFactor(e)).toBeCloseTo(eraDroughtFactor(0), 9);
    expect(qanatDroughtFactor(e)).toBeCloseTo(qanatFactor(eraDroughtFactor(0)), 9);
    e.runMonths(eraDroughtLength(0));
    events.push(...eraEvents(e.takeEvents()));
    const ended = events.find((x) => x.type === 'droughtEnded');
    expect(ended).toBeDefined();
    expect(droughtFactor(e)).toBe(1);
    expect(qanatDroughtFactor(e)).toBe(1);
    // An empty city has no consumers, so it holds and earns the first grant.
    expect(ended).toMatchObject({ held: true, reward: eraDroughtReward(0) });
    expect(era.held).toBe(1);
    expect(era.nextDrought).toBe(Math.floor(e.tick / 120) + OASIS_ERA.droughtEvery);
  });

  it('awards ranks in order, one per close, only when every goal holds', () => {
    const run = SIM_PRESETS['oasis-journey']!.create('1', 64);
    const ranks: number[] = [];
    for (let m = 0; m < 60; m++) {
      run.engine.runMonths(1);
      for (const ev of run.engine.takeEvents()) if (ev.type === 'eraRank') ranks.push(ev.rank);
      run.onMonth(run.engine);
    }
    expect(ranks).toEqual([1, 2]);
    const era = run.engine.oasis.journey!.era!;
    expect(era.rank).toBe(2);
    expect(new Set(era.rankMonths).size).toBe(era.rankMonths.length);
    expect(ERA_RANKS).toBe(3);
  });

  it('saves and replays a city mid dry season, and rejects malformed era records', () => {
    const e = finished();
    e.runMonths(1);
    e.oasis.journey!.era!.nextDrought = Math.floor(e.tick / 120) + 1;
    e.runMonths(2);
    expect(e.oasis.journey!.era!.droughtMonthsLeft).toBeGreaterThan(0);
    const text = stringifySave(encodeSave(e.serialize(), meta, { format: OASIS_SAVE_FORMAT }));
    const decoded = decodeSave(text, { format: OASIS_SAVE_FORMAT });
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const resumed = SimulationEngine.fromSnapshot(decoded.snapshot);
    e.runMonths(6);
    resumed.runMonths(6);
    expect(hashState(resumed)).toBe(hashState(e));
    const broken = (patch: Record<string, unknown>) => {
      const file = JSON.parse(text);
      Object.assign(file.state.oasis.journey.era, patch);
      return decodeSave(JSON.stringify(file), { format: OASIS_SAVE_FORMAT }).ok;
    };
    expect(broken({})).toBe(true);
    expect(broken({ rank: 4, rankMonths: [0, 0, 0, 0] })).toBe(false);
    expect(broken({ rank: 1, rankMonths: [] })).toBe(false);
    expect(broken({ droughtMonthsLeft: OASIS_ERA.droughtLongest + 1 })).toBe(false);
    expect(broken({ held: 5, droughts: 1 })).toBe(false);
  });
});
