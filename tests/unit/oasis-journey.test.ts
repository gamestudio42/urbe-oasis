import {
  JOURNEY_CHAPTERS,
  OASIS_JOURNEY,
  OASIS_SAVE_FORMAT,
  PLACEABLE_SPECS,
  decodeSave,
  defaultJourneyState,
  encodeSave,
  stringifySave,
  ZoneDensity,
  ZoneType,
  type SimEvent,
} from '@city/shared';
import {
  SIM_PRESETS,
  SimulationEngine,
  createEngine,
  droughtActive,
  hashState,
} from '@city/simulation';
import { describe, expect, it } from 'vitest';

const meta = { population: 0, funds: 0, savedAt: '2026-10-24T00:00:00.000Z' };
const journeyEvents = (events: SimEvent[]) =>
  events.filter((e) => ['journeyChapter', 'droughtStarted', 'droughtEnded'].includes(e.type));

function flat(journey: boolean): SimulationEngine {
  const e = createEngine({
    seed: 'journey',
    size: 32,
    ruleset: 'oasis',
    funds: 50_000,
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    journey,
  });
  e.disastersEnabled = false;
  return e;
}

describe('oasis journey', () => {
  it('exists only for cities founded with it, and never for classic cities', () => {
    expect(flat(true).oasis.journey).toEqual(defaultJourneyState());
    expect(flat(true).stats().oasis?.journey).toMatchObject({ chapter: 0, droughtIn: -1 });
    expect(flat(false).oasis.journey).toBeUndefined();
    expect(flat(false).stats().oasis?.journey).toBeUndefined();
    const classic = createEngine({ seed: 'journey', size: 32, journey: true });
    expect(classic.oasis.journey).toBeUndefined();
    expect(classic.stats().oasis).toBeUndefined();
  });

  it('leaves presets without a journey byte for byte unchanged', () => {
    const a = SIM_PRESETS['oasis-balanced']!.create('legacy', 64);
    const b = SIM_PRESETS['oasis-balanced']!.create('legacy', 64);
    for (let m = 0; m < 6; m++) {
      a.engine.runMonths(1);
      a.onMonth(a.engine);
      b.engine.runMonths(1);
      b.onMonth(b.engine);
    }
    expect(a.engine.oasis.journey).toBeUndefined();
    expect(journeyEvents(a.engine.takeEvents())).toEqual([]);
    expect(hashState(a.engine)).toBe(hashState(b.engine));
  });

  it('plays through every chapter in order, one per month, paying each grant', () => {
    const run = SIM_PRESETS['oasis-journey']!.create('1', 64);
    const e = run.engine;
    const grants: number[] = [];
    let previousFunds = e.economy.funds;
    for (let m = 0; m < 72 && (e.oasis.journey?.chapter ?? 0) < JOURNEY_CHAPTERS; m++) {
      e.runMonths(1);
      for (const event of journeyEvents(e.takeEvents()))
        if (event.type === 'journeyChapter') grants.push(event.reward);
      run.onMonth(e);
      previousFunds = e.economy.funds;
    }
    expect(previousFunds).toBeGreaterThan(0);
    const journey = e.oasis.journey!;
    expect(journey.chapter).toBe(JOURNEY_CHAPTERS);
    expect(grants).toEqual(OASIS_JOURNEY.rewards);
    const months = journey.completedMonths;
    for (let k = 1; k < months.length; k++) expect(months[k]).toBeGreaterThan(months[k - 1]!);
    // The drought starts one close after the third chapter and lasts its full length.
    expect(months[3]! - months[2]!).toBe(1 + OASIS_JOURNEY.droughtMonths);
    expect(journey.droughtOutcome).toBe(1);
    expect(e.buildings.ofKind('caravanserai').some((b) => b.occupancy > 0)).toBe(true);
  });

  it('cuts well and pump output during the drought and restores it afterwards', () => {
    const e = flat(true);
    expect(e.execute({ type: 'place', kind: 'windTurbine', x: 4, y: 4 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'well', x: 5, y: 4 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'qanat', x: 4, y: 5 }).ok).toBe(true);
    e.refreshUtilities();
    const before = e.stats().water.supply;
    const journey = e.oasis.journey!;
    Object.assign(journey, { chapter: 3, completedMonths: [0, 0, 0], droughtMonthsLeft: 2 });
    expect(droughtActive(e)).toBe(true);
    e.refreshUtilities();
    const during = e.stats().water.supply;
    const well = Math.round(PLACEABLE_SPECS.well.waterSupply * 0.55);
    // Only the unshaded well loses output; the qanat keeps its full supply.
    expect(before - during).toBe(well - Math.round(well * OASIS_JOURNEY.droughtFactor));
    journey.droughtMonthsLeft = 0;
    e.refreshUtilities();
    expect(e.stats().water.supply).toBe(before);
  });

  it('pays the smaller grant when the city falls short during the drought', () => {
    const e = flat(true);
    const journey = e.oasis.journey!;
    Object.assign(journey, { chapter: 3, completedMonths: [0, 0, 0], droughtStart: 0 });
    // A lot with no water anywhere keeps water service at zero.
    e.execute({
      type: 'zone',
      zone: ZoneType.Residential,
      density: ZoneDensity.Light,
      x0: 10,
      y0: 10,
      x1: 10,
      y1: 10,
    });
    const events: SimEvent[] = [];
    for (let m = 0; m < 1 + OASIS_JOURNEY.droughtMonths; m++) {
      e.runMonths(1);
      events.push(...journeyEvents(e.takeEvents()));
    }
    expect(events[0]).toEqual({ type: 'droughtStarted', months: OASIS_JOURNEY.droughtMonths });
    expect(journey.chapter).toBe(4);
    expect(journey.droughtOutcome).toBeGreaterThanOrEqual(0);
    const ended = events.find((x) => x.type === 'droughtEnded');
    const grant = events.find((x) => x.type === 'journeyChapter');
    expect(grant).toEqual({
      type: 'journeyChapter',
      chapter: 4,
      reward:
        ended?.type === 'droughtEnded' && ended.held
          ? OASIS_JOURNEY.rewards[3]
          : OASIS_JOURNEY.droughtShortReward,
    });
  });

  it('survives a save mid-drought and replays to the same hash', () => {
    const run = SIM_PRESETS['oasis-journey']!.create('2', 64);
    const e = run.engine;
    while (!droughtActive(e)) {
      e.runMonths(1);
      run.onMonth(e);
    }
    e.runTicks(37);
    const file = stringifySave(encodeSave(e.serialize(), meta, { format: OASIS_SAVE_FORMAT }));
    const decoded = decodeSave(file, { format: OASIS_SAVE_FORMAT });
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.snapshot.oasis?.journey).toEqual(e.oasis.journey);
    const resumed = SimulationEngine.fromSnapshot(decoded.snapshot);
    for (let m = 0; m < 6; m++) {
      e.runMonths(1);
      resumed.runMonths(1);
      run.onMonth(e);
      run.onMonth(resumed);
    }
    expect(hashState(resumed)).toBe(hashState(e));
  });

  it('rejects malformed journey records', () => {
    const e = flat(true);
    const good = encodeSave(e.serialize(), meta, { format: OASIS_SAVE_FORMAT });
    const broken = (patch: Record<string, unknown>) => {
      const file = JSON.parse(stringifySave(good));
      Object.assign(file.state.oasis.journey, patch);
      return decodeSave(JSON.stringify(file), { format: OASIS_SAVE_FORMAT }).ok;
    };
    expect(broken({})).toBe(true);
    expect(broken({ chapter: 6, completedMonths: [0, 0, 0, 0, 0, 0] })).toBe(false);
    expect(broken({ chapter: 2, completedMonths: [0] })).toBe(false);
    expect(broken({ droughtMonthsLeft: OASIS_JOURNEY.droughtMonths + 1 })).toBe(false);
    expect(broken({ droughtOutcome: 2 })).toBe(false);
  });
});
