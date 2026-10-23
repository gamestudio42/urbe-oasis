import { buildTown, flatCity, maintainTown } from '@city/simulation';
import { describe, it } from 'vitest';
import { Scenario, sum } from './harness';

describe('scenario: very high taxes', () => {
  it('lowers demand and population compared with neutral taxes', () => {
    const neutral = new Scenario('high-taxes-control', flatCity('taxes', 64));
    const high = new Scenario('high-taxes', flatCity('taxes', 64));
    buildTown(neutral.engine);
    buildTown(high.engine);
    for (const zone of ['residential', 'commercial', 'industrial'] as const) {
      high.engine.execute({ type: 'setTax', zone, rate: 20 });
    }
    neutral.run(36, maintainTown);
    high.run(36, maintainTown);

    const meanDemand = (s: Scenario, key: 'residential' | 'commercial' | 'industrial') =>
      sum(s.metrics.map((m) => m.demand[key])) / s.metrics.length;
    for (const key of ['residential', 'commercial', 'industrial'] as const) {
      high.check(
        `${key} demand is lower`,
        meanDemand(high, key) < meanDemand(neutral, key),
        `${meanDemand(high, key)} vs ${meanDemand(neutral, key)}`,
      );
    }
    high.check(
      'population is much lower',
      high.last.population < neutral.last.population * 0.6,
      `${high.last.population} vs ${neutral.last.population}`,
    );
    high.check('neutral city grows', neutral.last.population > 1000, neutral.last.population);
    neutral.finish();
    high.finish({ controlPopulation: neutral.last.population });
  });
});
