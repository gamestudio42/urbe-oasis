import { DEPARTMENTS, RejectReason } from '@city/shared';
import { addServices, buildTown, flatCity, maintainTown } from '@city/simulation';
import { describe, it } from 'vitest';
import { Scenario } from './harness';

describe('scenario: insufficient budget', () => {
  it('underfunded services cover less of the city and crime rises', () => {
    const full = new Scenario('underfunded-control', flatCity('funding', 64, 40000));
    const low = new Scenario('underfunded', flatCity('funding', 64, 40000));
    for (const s of [full, low]) addServices(s.engine, buildTown(s.engine));
    for (const department of DEPARTMENTS)
      low.engine.execute({ type: 'setFunding', department, value: 25 });
    full.run(24, maintainTown);
    low.run(24, maintainTown);

    for (const key of ['police', 'fire', 'health', 'education'] as const) {
      low.check(
        `${key} coverage drops`,
        low.last.coverage[key] < full.last.coverage[key] * 0.6,
        `${low.last.coverage[key]} vs ${full.last.coverage[key]}`,
      );
    }
    // One station at the west end of town reaches about a third of the buildings.
    low.check(
      'full funding covers a good share',
      full.last.coverage.police > 0.25,
      full.last.coverage.police,
    );
    low.check(
      'crime is higher',
      low.last.averages.crime > full.last.averages.crime,
      `${low.last.averages.crime} vs ${full.last.averages.crime}`,
    );
    low.check(
      'upkeep is lower',
      low.last.expenses < full.last.expenses,
      `${low.last.expenses} vs ${full.last.expenses}`,
    );
    full.finish();
    low.finish();
  });

  it('a city spending more than it earns goes bankrupt and can recover', () => {
    const s = new Scenario('bankruptcy', flatCity('bankruptcy', 64, 14000));
    const e = s.engine;
    addServices(e, buildTown(e));
    let bankruptAt = -1;
    let refused = false;
    s.run(30, (engine, month) => {
      if (engine.economy.bankrupt && bankruptAt < 0) {
        bankruptAt = month;
        refused =
          engine.execute({ type: 'road', x0: 0, y0: 30, x1: 3, y1: 30 }).reason ===
          RejectReason.Bankrupt;
      }
    });
    s.check(
      'goes into debt',
      s.metrics.some((m) => m.monthsInDebt > 0),
    );
    s.check('bankruptcy after twelve months in debt', bankruptAt >= 12, bankruptAt);
    s.check(
      'debt counter reaches twelve first',
      s.metrics.some((m) => m.monthsInDebt === 12),
    );
    s.check('construction is refused while bankrupt', refused);

    // Austerity: cut services, raise taxes, and wait for the books to balance.
    for (const department of DEPARTMENTS) e.execute({ type: 'setFunding', department, value: 30 });
    for (const zone of ['residential', 'commercial', 'industrial'] as const)
      e.execute({ type: 'setTax', zone, rate: 11 });
    s.run(48);
    s.check('recovers from bankruptcy', !s.last.bankrupt, s.last.funds);
    s.check('funds positive again', s.last.funds > 0, s.last.funds);
    s.finish({ bankruptAt });
  });
});
