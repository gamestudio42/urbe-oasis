import { SIM_PRESETS, SimulationEngine, hashState } from '@city/simulation';
import { expect, it } from 'vitest';
import { Scenario, sum } from './harness';

it('trades long-term business income for conservation and resumes identically after a policy change', () => {
  const { engine, onMonth } = SIM_PRESETS['oasis-rationing']!.create('1', 64);
  const scenario = new Scenario('oasis-rationing', engine);
  scenario.run(36, onMonth);
  const normal = SIM_PRESETS['oasis-balanced']!.create('1', 64);
  const control = new Scenario('oasis-rationing-control', normal.engine);
  control.run(36, normal.onMonth);
  scenario.check('populated city', scenario.last.population > 500, scenario.last.population);
  scenario.check(
    'continuous use reduces receipts',
    sum(scenario.metrics.map((m) => m.revenue)) < sum(control.metrics.map((m) => m.revenue)),
  );
  scenario.check(
    'continuous use strains the treasury',
    scenario.last.funds < control.last.funds,
    `${scenario.last.funds} < ${control.last.funds}`,
  );
  scenario.check(
    'conservation saves water',
    engine.stats().oasis!.waterPolicy.rationedDemand <
      engine.stats().oasis!.waterPolicy.normalDemand,
  );
  engine.runTicks(61);
  engine.execute({ type: 'setWaterRationing', enabled: false });
  const resumed = SimulationEngine.fromSnapshot(engine.serialize());
  for (let month = 0; month < 12; month++) {
    engine.runMonths(1);
    resumed.runMonths(1);
    onMonth(engine);
    onMonth(resumed);
  }
  expect(hashState(resumed)).toBe(hashState(engine));
  scenario.finish();
});
