import { ZoneType } from '@city/shared';
import { buildCorridor, flatCity, run, type SimulationEngine } from '@city/simulation';
import { describe, it } from 'vitest';
import { Scenario } from './harness';

function meanResidentialAccess(engine: SimulationEngine): number {
  const w = engine.world;
  let total = 0;
  let count = 0;
  for (let i = 0; i < w.tileCount; i++) {
    if (w.zone[i] !== ZoneType.Residential) continue;
    total += w.influence.access[i] as number;
    count++;
  }
  return count === 0 ? 0 : total / count;
}

describe('scenario: disconnected roads', () => {
  it('homes that cannot reach jobs do not grow until the road is joined', () => {
    const joined = new Scenario('disconnected-roads-control', flatCity('corridor', 64));
    const split = new Scenario('disconnected-roads', flatCity('corridor', 64));
    buildCorridor(joined.engine);
    buildCorridor(split.engine, { gap: true });
    joined.run(24);
    split.run(24);

    const accessJoined = meanResidentialAccess(joined.engine);
    const accessSplit = meanResidentialAccess(split.engine);
    split.check(
      'job access is lower when split',
      accessSplit < accessJoined * 0.5,
      `${accessSplit} vs ${accessJoined}`,
    );
    split.check(
      'population is lower when split',
      split.last.population < joined.last.population * 0.2,
      `${split.last.population} vs ${joined.last.population}`,
    );
    split.check('joined corridor grows', joined.last.population > 300, joined.last.population);
    split.check(
      'no trips means no residential development',
      split.last.buildings.residential === 0,
      split.last.buildings.residential,
    );

    run(split.engine, { type: 'road', x0: 21, y0: 20, x1: 23, y1: 20 });
    split.run(24);
    split.check(
      'joining the road starts growth',
      split.last.population > 200,
      split.last.population,
    );
    split.check(
      'job access recovers',
      meanResidentialAccess(split.engine) > accessSplit,
      meanResidentialAccess(split.engine),
    );
    joined.finish();
    split.finish({ accessJoined, accessSplit });
  });

  it('zones without any road stagnate', () => {
    const s = new Scenario('no-roads', flatCity('no-roads', 64));
    const e = s.engine;
    run(e, {
      type: 'zone',
      zone: ZoneType.Residential,
      density: 1,
      x0: 10,
      y0: 10,
      x1: 20,
      y1: 14,
    });
    run(e, { type: 'zone', zone: ZoneType.Industrial, density: 1, x0: 10, y0: 16, x1: 20, y1: 18 });
    run(e, { type: 'place', kind: 'gasPlant', x: 22, y: 12 });
    s.run(24);
    s.check('no population without roads', s.last.population === 0, s.last.population);
    s.check('no jobs without roads', s.last.jobs.industrial === 0, s.last.jobs.industrial);
    s.finish();
  });
});
