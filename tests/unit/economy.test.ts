import { BALANCE, PLACEABLE_SPECS, RejectReason } from '@city/shared';
import {
  buildTown,
  cityTotals,
  componentStats,
  demandTargets,
  diagnoseTile,
  flatCity,
  gatewayRoads,
  hubJobs,
  type CityTotals,
  type SimulationEngine,
} from '@city/simulation';
import { describe, expect, it } from 'vitest';
import { addWater, seedResidents } from '../helpers/engine';

const NEUTRAL_TAXES = { residential: 7, commercial: 7, industrial: 7 };

function totals(residents: number, commercialJobs: number, industrialJobs: number): CityTotals {
  return {
    residents,
    housing: residents,
    workforce: BALANCE.demand.laborRate * residents,
    commercialJobs,
    industrialJobs,
    commercialWorkers: 0,
    industrialWorkers: 0,
    hubCommercialMarket: 0,
    hubIndustrialMarket: 0,
    residentialQuality: 0.3,
    developedResidential: residents > 0 ? 10 : 0,
  };
}

describe('demand', () => {
  it('starts with residential and industrial demand in an empty city', () => {
    const d = demandTargets({
      totals: totals(0, 0, 0),
      taxes: NEUTRAL_TAXES,
      edgeConnected: false,
      crisis: 1,
    });
    expect(d.residential).toBeGreaterThan(0.3);
    expect(d.industrial).toBeGreaterThan(0.5);
  });

  it('falls with higher taxes and rises with available jobs', () => {
    const base = { totals: totals(500, 50, 80), edgeConnected: true, crisis: 1 };
    const normal = demandTargets({ ...base, taxes: NEUTRAL_TAXES });
    const high = demandTargets({
      ...base,
      taxes: { residential: 20, commercial: 20, industrial: 20 },
    });
    expect(high.residential).toBeLessThan(normal.residential);
    expect(high.commercial).toBeLessThan(normal.commercial);
    expect(high.industrial).toBeLessThan(normal.industrial);
    const moreJobs = demandTargets({
      ...base,
      totals: totals(500, 200, 300),
      taxes: NEUTRAL_TAXES,
    });
    expect(moreJobs.residential).toBeGreaterThan(normal.residential);
  });

  it('weakens industry during an economic crisis', () => {
    const base = { totals: totals(200, 20, 20), taxes: NEUTRAL_TAXES, edgeConnected: false };
    expect(demandTargets({ ...base, crisis: 0.6 }).industrial).toBeLessThan(
      demandTargets({ ...base, crisis: 1 }).industrial,
    );
  });
});

describe('economy', () => {
  it('collects more taxes at higher rates', () => {
    const revenueAt = (rate: number) => {
      const e = flatCity('tax', 64);
      buildTown(e);
      e.runMonths(18);
      for (const zone of ['residential', 'commercial', 'industrial'] as const)
        e.execute({ type: 'setTax', zone, rate });
      e.runMonths(1);
      const r = e.economy.lastMonth.revenue;
      return r.residential + r.commercial + r.industrial;
    };
    expect(revenueAt(12)).toBeGreaterThan(revenueAt(4));
  });

  it('declares bankruptcy after twelve months in debt and blocks construction', () => {
    const e = flatCity('debt', 32);
    e.execute({ type: 'road', x0: 0, y0: 5, x1: 31, y1: 5 });
    e.execute({ type: 'place', kind: 'hospital', x: 4, y: 7 });
    e.economy.funds = -1;
    e.runMonths(11);
    expect(e.economy.monthsInDebt).toBe(11);
    expect(e.economy.bankrupt).toBe(false);
    e.runMonths(1);
    expect(e.economy.bankrupt).toBe(true);
    expect(e.execute({ type: 'road', x0: 0, y0: 9, x1: 3, y1: 9 }).reason).toBe(
      RejectReason.Bankrupt,
    );
    e.economy.funds = 5000;
    e.runMonths(1);
    expect(e.economy.bankrupt).toBe(false);
    expect(e.economy.monthsInDebt).toBe(0);
  });

  it('scales department upkeep with funding', () => {
    const e = flatCity('funding', 32);
    e.execute({ type: 'place', kind: 'policeStation', x: 4, y: 4 });
    e.runMonths(1);
    expect(e.economy.lastMonth.expenses.police).toBe(PLACEABLE_SPECS.policeStation.upkeep);
    e.execute({ type: 'setFunding', department: 'police', value: 50 });
    e.runMonths(1);
    expect(e.economy.lastMonth.expenses.police).toBe(PLACEABLE_SPECS.policeStation.upkeep / 2);
  });
});

describe('transport hubs', () => {
  const taxes = { residential: 7, commercial: 7, industrial: 7 };
  const perJob = BALANCE.demand.hubMarketPerJob;

  /** Shore along the top row, an inland street (no map edge) and a marina, lit or dark. */
  function marinaCity(seed: string, powered: boolean, residents = 1000): SimulationEngine {
    const e = flatCity(seed, 32);
    addWater(e, 0, 0, 31, 0);
    e.execute({ type: 'road', x0: 1, y0: 4, x1: 8, y1: 4 });
    seedResidents(e, residents);
    expect(e.execute({ type: 'place', kind: 'marina', x: 2, y: 1 }).ok).toBe(true);
    if (powered)
      expect(e.execute({ type: 'place', kind: 'windTurbine', x: 5, y: 2 }).ok).toBe(true);
    return e;
  }

  function airportCity(seed: string, powered: boolean, residents = 2000): SimulationEngine {
    const e = flatCity(seed, 32);
    e.execute({ type: 'road', x0: 3, y0: 8, x1: 10, y1: 8 });
    seedResidents(e, residents);
    expect(e.execute({ type: 'place', kind: 'airport', x: 4, y: 4 }).ok).toBe(true);
    if (powered)
      expect(e.execute({ type: 'place', kind: 'windTurbine', x: 8, y: 5 }).ok).toBe(true);
    return e;
  }

  it('scales hub jobs with the city, shares them between hubs and caps them', () => {
    const spec = PLACEABLE_SPECS.airport;
    expect(hubJobs(spec, 0, 1)).toBe(spec.jobs);
    expect(hubJobs(spec, 4000, 1)).toBe(spec.jobs + 4 * spec.jobsPer1000);
    expect(hubJobs(spec, 4000, 2)).toBe(spec.jobs + 2 * spec.jobsPer1000);
    expect(hubJobs(spec, 1_000_000, 1)).toBe(spec.maxJobs);
  });

  it('gives industrial jobs and market when a marina is powered', () => {
    const dark = marinaCity('marina-dark', false);
    const lit = marinaCity('marina-lit', true);
    const jobs = hubJobs(PLACEABLE_SPECS.marina, 1000, 1);
    expect(jobs).toBeGreaterThan(PLACEABLE_SPECS.marina.jobs);
    expect(dark.stats().jobs.industrial).toBe(0);
    expect(lit.stats().jobs.industrial).toBe(jobs);
    expect(cityTotals(lit).hubIndustrialMarket).toBe(jobs * perJob);
    expect(cityTotals(dark).hubIndustrialMarket).toBe(0);
    const crowded = totals(500, 50, 80);
    expect(
      demandTargets({
        taxes,
        edgeConnected: false,
        crisis: 1,
        totals: { ...crowded, hubIndustrialMarket: jobs * perJob },
      }).industrial,
    ).toBeGreaterThan(
      demandTargets({ taxes, edgeConnected: false, crisis: 1, totals: crowded }).industrial,
    );
  });

  it('gives commercial jobs and market when an airport is powered', () => {
    const dark = airportCity('air-dark', false);
    const lit = airportCity('air-lit', true);
    const jobs = hubJobs(PLACEABLE_SPECS.airport, 2000, 1);
    expect(dark.stats().jobs.commercial).toBe(0);
    expect(lit.stats().jobs.commercial).toBe(jobs);
    expect(cityTotals(lit).hubCommercialMarket).toBe(jobs * perJob);
    expect(cityTotals(dark).hubCommercialMarket).toBe(0);
  });

  it('links the road network to the region while the hub operates', () => {
    for (const [lit, dark] of [
      [marinaCity('gate-lit', true), marinaCity('gate-dark', false)],
      [airportCity('gate-air-lit', true), airportCity('gate-air-dark', false)],
    ] as const) {
      for (const e of [lit, dark]) e.roads.update();
      expect(lit.roads.edgeRoads).toHaveLength(0);
      const gates = gatewayRoads(lit.world, lit.roads, lit.buildings.values());
      expect(gates).toHaveLength(1);
      const c = lit.roads.componentOf(gates[0] as number);
      expect(componentStats(lit, lit.roads).edge[c]).toBe(1);
      expect(componentStats(dark, dark.roads).edge[c]).toBe(0);
      expect(gatewayRoads(dark.world, dark.roads, dark.buildings.values())).toHaveLength(0);
      expect(lit.stats().edgeConnected).toBe(true);
      expect(dark.stats().edgeConnected).toBe(false);
    }
  });

  it('raises land value around a marina and lowers it around an airport', () => {
    const near = (e: SimulationEngine, x: number, y: number) => {
      e.runMonths(1);
      return e.world.influence.landValue[e.world.index(x, y)] as number;
    };
    expect(near(marinaCity('lv-lit', true), 3, 6)).toBeGreaterThan(
      near(marinaCity('lv-dark', false), 3, 6),
    );
    expect(near(airportCity('noise-lit', true), 5, 10)).toBeLessThan(
      near(airportCity('noise-dark', false), 5, 10),
    );
  });

  it('reports a hub cut off from its road', () => {
    const e = marinaCity('cut', true);
    e.execute({ type: 'demolish', x0: 1, y0: 4, x1: 8, y1: 4 });
    const problems = diagnoseTile(
      {
        world: e.world,
        building: (id) => e.buildings.get(id),
        demand: e.demand,
        taxes: e.economy.taxes,
        power: e.stats().power,
      },
      3,
      2,
    );
    expect(problems.map((p) => p.code)).toContain('NO_ROAD');
  });
});
