import { buildTown, flatCity, maintainTown } from '@city/simulation';
import { describe, it } from 'vitest';
import { Scenario, sum } from './harness';

describe('scenario: balanced city', () => {
  it('grows steadily without going bankrupt', () => {
    const s = new Scenario('balanced', flatCity('balanced', 64));
    buildTown(s.engine);
    let expansions = 0;
    s.run(48, (e) => {
      expansions += maintainTown(e);
    });
    s.check('the player expanded utilities', expansions > 0, expansions);
    const pop = (monthsAgo: number) => s.at(monthsAgo).population;

    s.check('population after 4 years', s.last.population > 1500, s.last.population);
    s.check(
      'growth in every year',
      pop(36) < pop(24) && pop(24) < pop(12) && pop(12) < pop(0),
      [pop(36), pop(24), pop(12), pop(0)].join(' < '),
    );
    s.check(
      'never bankrupt',
      s.metrics.every((m) => !m.bankrupt),
    );
    s.check(
      'never in debt',
      s.metrics.every((m) => m.monthsInDebt === 0),
    );
    s.check(
      'positive budget in the last year',
      sum(s.metrics.slice(-12).map((m) => m.net)) > 0,
      sum(s.metrics.slice(-12).map((m) => m.net)),
    );
    s.check(
      'power keeps up',
      s.metrics.slice(-12).every((m) => m.powered >= 0.95),
    );
    s.check('water mostly served', s.last.watered >= 0.8, s.last.watered);
    s.check(
      'demand stays bounded',
      s.metrics.every((m) => Object.values(m.demand).every((d) => d >= -1 && d <= 1)),
    );
    s.check('unemployment under 30%', s.last.unemployment < 0.3, s.last.unemployment);
    s.check('jobs exist in both sectors', s.last.jobs.commercial > 0 && s.last.jobs.industrial > 0);
    s.check('few abandoned buildings', s.last.buildings.abandoned <= 5, s.last.buildings.abandoned);
    s.finish({ expansions });
  });
});
