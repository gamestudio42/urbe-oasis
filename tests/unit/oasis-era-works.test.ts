import {
  ERA_WORK_KINDS,
  OASIS_ERA_WORKS,
  PLACEABLE_SPECS,
  RejectReason,
  type BuildingRecord,
  type PlaceableKind,
} from '@city/shared';
import {
  SimulationEngine,
  basinOperating,
  createEngine,
  eraQanatFactor,
  qanatDroughtFactor,
  shadeSupply,
} from '@city/simulation';
import { describe, expect, it } from 'vitest';
import { computeMonthlyReport } from '../../packages/simulation/src/systems/economy';

const flat = { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 };
const factors = { crisisRevenue: 1, epidemicCommercial: 1 };

/** An Oasis city whose journey is over, at era rank `rank`, with a road and a coal plant. */
function eraCity(rank: number): SimulationEngine {
  const e = createEngine({
    seed: 'works',
    size: 40,
    ruleset: 'oasis',
    terrain: flat,
    journey: true,
    funds: 500_000,
  });
  e.disastersEnabled = false;
  Object.assign(e.oasis.journey!, {
    chapter: 5,
    completedMonths: [0, 0, 0, 0, 0],
    droughtOutcome: 1,
  });
  e.runMonths(1);
  e.oasis.journey!.era!.rank = rank;
  expect(e.execute({ type: 'road', x0: 2, y0: 10, x1: 30, y1: 10 }).ok).toBe(true);
  expect(e.execute({ type: 'place', kind: 'coalPlant', x: 2, y: 11 }).ok).toBe(true);
  return e;
}

const place = (e: SimulationEngine, kind: PlaceableKind, x: number, y: number) =>
  e.execute({ type: 'place', kind, x, y });

describe('Oasis era works', () => {
  it('waits for each title, then allows one of each per city', () => {
    for (const kind of ERA_WORK_KINDS) {
      const need = OASIS_ERA_WORKS.rank[kind];
      const before = eraCity(need - 1);
      expect(place(before, kind, 5, 11)).toMatchObject({
        ok: false,
        reason: RejectReason.NeedsTitle,
      });
      const after = eraCity(need);
      const funds = after.economy.funds;
      expect(place(after, kind, 5, 11).ok).toBe(true);
      expect(after.economy.funds).toBe(funds - PLACEABLE_SPECS[kind].cost);
      expect(place(after, kind, 9, 11)).toMatchObject({
        ok: false,
        reason: RejectReason.OnePerCity,
      });
    }
  });

  it('stays locked in a city with no era and in a classic city', () => {
    const fresh = createEngine({ seed: 'works', size: 32, ruleset: 'oasis', terrain: flat });
    expect(place(fresh, 'rechargeBasin', 4, 4).reason).toBe(RejectReason.NeedsTitle);
    const classic = createEngine({ seed: 'works', size: 32, terrain: flat });
    expect(place(classic, 'rechargeBasin', 4, 4).reason).toBe(RejectReason.NeedsTitle);
  });

  it('spares qanats part of an era dry season cut while a recharge basin operates', () => {
    const e = eraCity(1);
    Object.assign(e.oasis.journey!.era!, { droughts: 7, droughtLength: 6, droughtMonthsLeft: 6 });
    expect(qanatDroughtFactor(e)).toBeCloseTo(eraQanatFactor(6), 9);
    expect(place(e, 'rechargeBasin', 5, 11).ok).toBe(true);
    e.refreshUtilities();
    expect(basinOperating(e)).toBe(true);
    expect(qanatDroughtFactor(e)).toBeCloseTo(eraQanatFactor(6, true), 9);
    expect(1 - eraQanatFactor(6, true)).toBeCloseTo(
      (1 - eraQanatFactor(6)) * OASIS_ERA_WORKS.basinQanatCut,
      9,
    );
    expect(e.stats().oasis!.journey!.era!.qanatFactor).toBe(
      Math.round(eraQanatFactor(6, true) * 100) / 100,
    );
    // A buried basin does nothing.
    e.buildings.ofKind('rechargeBasin')[0]!.offline = 5;
    expect(qanatDroughtFactor(e)).toBeCloseTo(eraQanatFactor(6), 9);
  });

  it('gives a powered palace garden deep shade, fuller with water', () => {
    const garden = {
      kind: 'palaceGarden',
      powered: true,
      watered: true,
      offline: 0,
    } as BuildingRecord;
    expect(shadeSupply(garden)).toBe(OASIS_ERA_WORKS.gardenShade);
    expect(shadeSupply({ ...garden, watered: false })).toBe(OASIS_ERA_WORKS.gardenShadeDry);
    expect(shadeSupply({ ...garden, powered: false })).toBe(0);
  });

  it('books the upkeep of every Oasis placeable', () => {
    const e = eraCity(3);
    const before = computeMonthlyReport(e, factors).expenses;
    const placed: [PlaceableKind, number, number][] = [
      ['qanat', 5, 11],
      ['cistern', 7, 11],
      ['windbreak', 8, 11],
      ['arcade', 9, 11],
      ['caravanserai', 11, 11],
      ['rechargeBasin', 13, 11],
      ['grandBazaar', 16, 11],
      ['palaceGarden', 19, 11],
    ];
    for (const [kind, x, y] of placed) expect(place(e, kind, x, y).ok, kind).toBe(true);
    const after = computeMonthlyReport(e, factors).expenses;
    const up = (...kinds: PlaceableKind[]) =>
      kinds.reduce((sum, kind) => sum + PLACEABLE_SPECS[kind].upkeep, 0);
    expect(after.water - before.water).toBe(up('qanat', 'cistern', 'rechargeBasin'));
    expect(after.parks - before.parks).toBe(up('windbreak', 'palaceGarden'));
    expect(after.transport - before.transport).toBe(up('arcade', 'caravanserai', 'grandBazaar'));
  });
});
