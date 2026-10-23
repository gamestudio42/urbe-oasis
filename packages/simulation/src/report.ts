import type { RciValues } from '@city/shared';
import type { SimulationEngine } from './engine';
import { monthIndex } from './time';

/** One row of a headless or scenario report, sampled after a month closes. */
export interface MonthMetrics {
  month: number;
  year: number;
  population: number;
  housing: number;
  jobs: RciValues;
  employed: RciValues;
  unemployment: number;
  demand: RciValues;
  funds: number;
  revenue: number;
  expenses: number;
  net: number;
  /** Residents / housing capacity, 0..1. */
  occupancy: number;
  /** Share of consumer buildings with power and water, 0..1. */
  powered: number;
  watered: number;
  powerSupply: number;
  powerDemand: number;
  waterSupply: number;
  waterDemand: number;
  avgCongestion: number;
  coverage: { police: number; fire: number; health: number; education: number };
  averages: { pollution: number; crime: number; landValue: number };
  buildings: { residential: number; commercial: number; industrial: number; abandoned: number };
  monthsInDebt: number;
  bankrupt: boolean;
  activeFires: number;
  /** Neon bandwidth. Absent in a classic report so the classic row stays the same shape. */
  shadeSupply?: number;
  shadeDemand?: number;
  shadeServed?: number;
  /** Wall-clock milliseconds spent simulating the month (filled by the caller). */
  msPerMonth?: number;
}

const round = (v: number, digits = 4): number => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

export function collectMetrics(engine: SimulationEngine): MonthMetrics {
  const s = engine.stats();
  const r = s.lastMonth.revenue;
  const revenue = r.residential + r.commercial + r.industrial;
  const expenses = Object.values(s.lastMonth.expenses).reduce((a, b) => a + b, 0);
  return {
    month: monthIndex(engine.tick),
    year: s.year,
    population: s.population,
    housing: s.housingCapacity,
    jobs: { ...s.jobs },
    employed: { ...s.employed },
    unemployment: round(s.unemployment),
    demand: { ...s.demand },
    funds: s.funds,
    revenue,
    expenses,
    net: s.lastMonth.net,
    occupancy: s.housingCapacity === 0 ? 0 : round(s.population / s.housingCapacity),
    powered: round(s.power.served),
    watered: round(s.water.served),
    powerSupply: s.power.supply,
    powerDemand: s.power.demand,
    waterSupply: s.water.supply,
    waterDemand: s.water.demand,
    avgCongestion: round(s.avgCongestion),
    coverage: { ...s.coverage },
    averages: { ...s.averages },
    buildings: {
      residential: s.counts.residential,
      commercial: s.counts.commercial,
      industrial: s.counts.industrial,
      abandoned: s.counts.abandoned,
    },
    monthsInDebt: s.monthsInDebt,
    bankrupt: s.bankrupt,
    activeFires: s.activeFires,
    ...(s.oasis
      ? {
          shadeSupply: s.oasis.data.supply,
          shadeDemand: s.oasis.data.demand,
          shadeServed: round(s.oasis.data.served),
        }
      : {}),
  };
}
