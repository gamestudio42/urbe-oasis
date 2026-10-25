import {
  BALANCE,
  OASIS_SAVE_FORMAT,
  OASIS_SHADE,
  OASIS_WATER,
  ZoneDensity,
  ZoneType,
  decodeSave,
  encodeSave,
  stringifySave,
} from '@city/shared';
import { SIM_PRESETS, createEngine, type SimulationEngine } from '@city/simulation';
import { describe, expect, it } from 'vitest';

const flat = { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 };

function city(seed: string, size = 64, ruleset: 'oasis' | 'classic' = 'oasis'): SimulationEngine {
  const e = createEngine({ seed, size, ruleset, terrain: flat, funds: 200_000 });
  e.disastersEnabled = false;
  return e;
}

const fromCentre = (e: SimulationEngine) => {
  const c = Math.floor(e.world.size / 2);
  return Math.max(Math.abs(e.oasis.springX - c), Math.abs(e.oasis.springY - c));
};

describe('the spring wanders around its birthplace', () => {
  it('stays within springRange of the centre for twenty years on every seed', () => {
    for (const seed of ['1', '2', '3', 'wander']) {
      const e = city(seed, 32);
      let far = 0;
      let moves = 0;
      let last = `${e.oasis.springX},${e.oasis.springY}`;
      for (let m = 0; m < 240; m++) {
        e.runMonths(1);
        far = Math.max(far, fromCentre(e));
        const now = `${e.oasis.springX},${e.oasis.springY}`;
        if (now !== last) moves++;
        last = now;
      }
      expect(far).toBeLessThanOrEqual(OASIS_SHADE.springRange);
      // Still a wandering spring, not a fixed one.
      expect(moves).toBeGreaterThan(10);
    }
  });

  it('only brings a far spring from an older save closer', () => {
    const e = city('legacy-far', 32);
    e.oasis.springX = 31;
    e.oasis.springY = 31;
    let distance = fromCentre(e);
    for (let m = 0; m < 240; m++) {
      e.runMonths(1);
      const now = fromCentre(e);
      expect(now).toBeLessThanOrEqual(Math.max(distance, OASIS_SHADE.springRange));
      distance = now;
    }
    expect(distance).toBeLessThanOrEqual(OASIS_SHADE.springRange);
  });

  it('keeps spring houses near the centre in reach, so the reference town keeps its shade', () => {
    const run = SIM_PRESETS['oasis-balanced']!.create('1', 64);
    for (let m = 0; m < 120; m++) {
      run.engine.runMonths(1);
      run.onMonth(run.engine);
    }
    expect(fromCentre(run.engine)).toBeLessThanOrEqual(OASIS_SHADE.springRange);
    // Before the bound, the spring had drifted 35 tiles away and shade served 44%.
    expect(run.engine.stats().oasis!.data.served).toBeGreaterThanOrEqual(0.8);
  });
});

describe('cisterns charge by elapsed days', () => {
  function bank() {
    const e = city('cistern-days', 24);
    expect(e.execute({ type: 'place', kind: 'windTurbine', x: 4, y: 4 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'qanat', x: 5, y: 4 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'cistern', x: 7, y: 4 }).ok).toBe(true);
    e.refreshUtilities();
    const entry = e.oasis.cisterns[0]!;
    return { e, entry };
  }

  it('fills a spare bank at cisternChargePerDay for each day since its last settlement', () => {
    const { e, entry } = bank();
    const start = entry.charge;
    expect(entry.settledTick).toBe(e.tick);
    e.runTicks(BALANCE.clock.ticksPerDay * 10);
    e.refreshUtilities();
    expect(entry.charge - start).toBeCloseTo(OASIS_WATER.cisternChargePerDay * 10, 6);
    // About eight months of surplus fill a bank.
    e.runTicks(BALANCE.clock.ticksPerDay * 240);
    e.refreshUtilities();
    expect(entry.charge).toBe(1);
  });

  it('adds nothing for repeated refreshes on the same day, such as repeated construction', () => {
    const { e, entry } = bank();
    const before = entry.charge;
    for (let k = 0; k < 20; k++) {
      e.execute({ type: 'pipe', x0: 10, y0: 10 + k, x1: 10, y1: 10 + k });
      e.refreshUtilities();
    }
    expect(entry.charge).toBe(before);
  });

  it('caps one settlement at a month and counts one day for a bank from an older save', () => {
    const { e, entry } = bank();
    e.runTicks(BALANCE.clock.ticksPerDay * 10);
    e.refreshUtilities();
    entry.charge = 0;
    entry.settledTick = e.tick - BALANCE.clock.ticksPerDay * 90;
    e.refreshUtilities();
    expect(entry.charge).toBeCloseTo(
      OASIS_WATER.cisternChargePerDay * OASIS_WATER.cisternChargeDaysCap,
      6,
    );
    const legacy = entry.charge;
    delete entry.settledTick;
    e.refreshUtilities();
    expect(entry.charge - legacy).toBeCloseTo(OASIS_WATER.cisternChargePerDay, 6);
  });

  it('saves the settlement tick and rejects a malformed one', () => {
    const { e, entry } = bank();
    const meta = { population: 0, funds: 0, savedAt: '2026-10-25T00:00:00.000Z' };
    const text = stringifySave(encodeSave(e.serialize(), meta, { format: OASIS_SAVE_FORMAT }));
    const decoded = decodeSave(text, { format: OASIS_SAVE_FORMAT });
    expect(decoded.ok).toBe(true);
    if (decoded.ok)
      expect(decoded.snapshot.oasis?.cisterns[0]?.settledTick).toBe(entry.settledTick);
    const broken = JSON.parse(text);
    broken.state.oasis.cisterns[0].settledTick = -5;
    expect(decodeSave(JSON.stringify(broken), { format: OASIS_SAVE_FORMAT }).ok).toBe(false);
  });
});

describe('empty Oasis lots carry water and shade', () => {
  /** A pipe, then an empty zoned lot, then a shop that needs water. */
  function strip(ruleset: 'oasis' | 'classic') {
    const e = city(`strip-${ruleset}`, 24, ruleset);
    expect(e.execute({ type: 'place', kind: 'windTurbine', x: 2, y: 8 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'waterPump', x: 2, y: 9 }).ok).toBe(true);
    expect(e.execute({ type: 'pipe', x0: 4, y0: 10, x1: 6, y1: 10 }).ok).toBe(true);
    const zone = { type: 'zone', zone: ZoneType.Commercial, density: ZoneDensity.Light } as const;
    expect(e.execute({ ...zone, x0: 7, y0: 10, x1: 8, y1: 10 }).ok).toBe(true);
    const shop = e.buildings.add({
      kind: 'commercial',
      x: 8,
      y: 10,
      w: 1,
      h: 1,
      level: 1,
      capacity: 10,
      occupancy: 4,
      condition: 100,
      age: 0,
      abandoned: false,
      emptyMonths: 0,
      variant: 0,
      powered: false,
      watered: false,
      offline: 0,
      attractiveness: 0,
    });
    e.refreshUtilities();
    return shop;
  }

  it('reaches a shop through an empty lot in Oasis and leaves classic water unchanged', () => {
    expect(strip('oasis').watered).toBe(true);
    expect(strip('classic').watered).toBe(false);
  });
});
