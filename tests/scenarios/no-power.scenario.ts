import { ZoneType } from '@city/shared';
import { buildTown, flatCity, run } from '@city/simulation';
import { describe, it } from 'vitest';
import { Scenario } from './harness';

describe('scenario: city without power', () => {
  it('does not develop until a plant is connected', () => {
    const dark = new Scenario('no-power', flatCity('no-power', 64));
    const lit = new Scenario('no-power-control', flatCity('no-power', 64));
    buildTown(dark.engine, { power: false });
    buildTown(lit.engine);
    dark.run(24);
    lit.run(24);

    dark.check('no residents without power', dark.last.population === 0, dark.last.population);
    dark.check(
      'no buildings without power',
      dark.last.buildings.residential === 0,
      dark.last.buildings.residential,
    );
    dark.check('powered city grows meanwhile', lit.last.population > 500, lit.last.population);

    run(dark.engine, { type: 'place', kind: 'coalPlant', x: 44, y: 22 });
    run(dark.engine, { type: 'powerLine', x0: 36, y0: 23, x1: 43, y1: 23 });
    dark.run(24);
    dark.check('growth starts once powered', dark.last.population > 200, dark.last.population);
    dark.check(
      'every consumer served after connection',
      dark.last.powered === 1,
      dark.last.powered,
    );
    lit.finish();
    dark.finish({ controlPopulation: lit.last.population });
  });

  it('cutting a power line darkens the town and reconnecting restores it', () => {
    const s = new Scenario('power-cut', flatCity('power-cut', 64));
    buildTown(s.engine);
    s.run(18);
    const w = s.engine.world;
    const home = [...s.engine.buildings.values()].find((b) => b.kind === 'residential');
    s.check('town is powered before the cut', s.last.powered === 1, s.last.powered);
    s.check('there is a home to observe', home !== undefined);
    const homeTile = home ? w.index(home.x, home.y) : 0;

    run(s.engine, { type: 'demolish', x0: 40, y0: 23, x1: 40, y1: 23 });
    const cut = s.engine.stats().power.served;
    s.check('most consumers lose power right after the cut', cut < 0.1, cut);
    s.check('the observed home is dark', w.powered[homeTile] === 0);
    s.check(
      'zone tiles are dark',
      w.zone[homeTile] === ZoneType.Residential && w.powered[homeTile] === 0,
    );
    s.run(1);
    const populationDark = s.last.population;

    run(s.engine, { type: 'powerLine', x0: 40, y0: 23, x1: 40, y1: 23 });
    const restored = s.engine.stats().power.served;
    s.check('service is restored on reconnection', restored === 1, restored);
    s.check('the observed home is lit again', w.powered[homeTile] === 1);
    s.run(6);
    s.check(
      'population recovers after reconnection',
      s.last.population > populationDark,
      `${populationDark} -> ${s.last.population}`,
    );
    s.finish();
  });
});
