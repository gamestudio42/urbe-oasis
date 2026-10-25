import {
  BALANCE,
  DEPARTMENTS,
  EXPENSE_CATEGORIES,
  Infra,
  OASIS_SHADE,
  PLACEABLE_SPECS,
  isZoneKind,
  type EconomyState,
  type MonthlyReport,
} from '@city/shared';
import type { SimulationEngine } from '../engine';
import { rationingPenalty } from './oasis/rationing';

export function emptyReport(): MonthlyReport {
  return {
    revenue: { residential: 0, commercial: 0, industrial: 0 },
    expenses: Object.fromEntries(
      EXPENSE_CATEGORIES.map((c) => [c, 0]),
    ) as MonthlyReport['expenses'],
    construction: 0,
    net: 0,
  };
}

export function defaultEconomy(): EconomyState {
  const tax = BALANCE.economy.taxDefault;
  return {
    funds: BALANCE.startingFunds,
    constructionThisMonth: 0,
    taxes: { residential: tax, commercial: tax, industrial: tax },
    funding: Object.fromEntries(DEPARTMENTS.map((d) => [d, 100])) as EconomyState['funding'],
    lastMonth: emptyReport(),
    monthsInDebt: 0,
    bankrupt: false,
  };
}

export interface EconomyFactors {
  /** Revenue multiplier during an economic crisis. */
  crisisRevenue: number;
  /** Commercial revenue multiplier during an epidemic. */
  epidemicCommercial: number;
}

/** Monthly budget: tax revenue minus upkeep scaled by department funding. */
export function computeMonthlyReport(
  engine: SimulationEngine,
  factors: EconomyFactors,
): MonthlyReport {
  const w = engine.world;
  const e = BALANCE.economy;
  const econ = engine.economy;
  const report = emptyReport();
  const lv = w.influence.landValue;

  let resBase = 0;
  let comBase = 0;
  let indBase = 0;
  for (const b of engine.buildings.values()) {
    if (!isZoneKind(b.kind) || b.abandoned || b.occupancy <= 0) continue;
    const land = e.landValueBase + (lv[w.index(b.x, b.y)] as number) / 255;
    if (b.kind === 'residential') resBase += b.occupancy * land;
    else if (b.kind === 'commercial') comBase += b.occupancy * land;
    else indBase += b.occupancy;
  }
  const t = econ.taxes;
  const businessFactor = 1 - rationingPenalty(engine);
  report.revenue.residential = Math.round(
    resBase * (t.residential / 100) * e.residentialTax * factors.crisisRevenue,
  );
  report.revenue.commercial = Math.round(
    comBase *
      (t.commercial / 100) *
      e.commercialTax *
      factors.crisisRevenue *
      factors.epidemicCommercial *
      businessFactor,
  );
  report.revenue.industrial = Math.round(
    indBase * (t.industrial / 100) * e.industrialTax * factors.crisisRevenue * businessFactor,
  );

  let roads = 0;
  let bridges = 0;
  let lines = 0;
  let pipes = 0;
  let canals = 0;
  for (let i = 0; i < w.tileCount; i++) {
    const infra = w.infra[i] as number;
    if (infra === 0) continue;
    if (infra & Infra.Road) {
      if (w.isWater(i)) bridges++;
      else roads++;
    }
    if (infra & Infra.PowerLine) lines++;
    if (infra & Infra.Pipe) pipes++;
    if (infra & Infra.Canal) canals++;
  }
  const f = econ.funding;
  const up = e.upkeep;
  const ex = report.expenses;
  ex.transport = (roads * up.road + bridges * up.bridge) * (f.transport / 100);
  ex.power = lines * up.powerLine;
  // Canal upkeep only exists in an Oasis city. A classic map never sets the bit, and adding zero
  // would still be a no-op, but the branch keeps the classic assignment byte-identical.
  if (engine.ruleset === 'oasis' && canals > 0) ex.power += canals * OASIS_SHADE.canalUpkeep;
  ex.water = pipes * up.pipe;
  for (const b of engine.buildings.values()) {
    if (isZoneKind(b.kind)) continue;
    const spec = PLACEABLE_SPECS[b.kind];
    switch (b.kind) {
      case 'coalPlant':
      case 'gasPlant':
      case 'windTurbine':
        ex.power += spec.upkeep;
        break;
      case 'waterPump':
      case 'well':
        ex.water += spec.upkeep;
        break;
      case 'policeStation':
        ex.police += spec.upkeep * (f.police / 100);
        break;
      case 'fireStation':
        ex.fire += spec.upkeep * (f.fire / 100);
        break;
      case 'hospital':
        ex.health += spec.upkeep * (f.health / 100);
        break;
      case 'school':
        ex.education += spec.upkeep * (f.education / 100);
        break;
      case 'park':
        ex.parks += spec.upkeep;
        break;
      case 'marina':
      case 'airport':
        ex.transport += spec.upkeep;
        break;
      case 'springHouse':
      case 'palm':
        ex.power += spec.upkeep;
        break;
    }
  }
  let expenses = 0;
  for (const key of Object.keys(ex) as Array<keyof MonthlyReport['expenses']>) {
    ex[key] = Math.round(ex[key]);
    expenses += ex[key];
  }
  const revenue =
    report.revenue.residential + report.revenue.commercial + report.revenue.industrial;
  report.net = revenue - expenses;
  report.construction = econ.constructionThisMonth;
  return report;
}

/** Applies the monthly report and the debt / bankruptcy rules. */
export function applyMonthlyBudget(engine: SimulationEngine, report: MonthlyReport): void {
  const econ = engine.economy;
  econ.funds += report.net;
  econ.lastMonth = report;
  econ.constructionThisMonth = 0;
  if (econ.funds < 0) {
    econ.monthsInDebt++;
    engine.emit({ type: 'debt', months: econ.monthsInDebt });
    if (!econ.bankrupt && econ.monthsInDebt >= BALANCE.economy.bankruptcyMonths) {
      econ.bankrupt = true;
      engine.emit({ type: 'bankrupt' });
    }
  } else {
    econ.monthsInDebt = 0;
    if (econ.bankrupt) {
      econ.bankrupt = false;
      engine.emit({ type: 'recovered' });
    }
  }
}
