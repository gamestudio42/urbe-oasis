import { ZoneDensity, ZoneType } from '@city/shared';
import {
  buildTown,
  createEngine,
  flatCity,
  hashState,
  type SimulationEngine,
} from '@city/simulation';
import { describe, expect, it } from 'vitest';
import { Scenario } from './harness';

function play(engine: SimulationEngine): Scenario {
  const s = new Scenario(`repeated-${engine.seed}`, engine);
  // Random fires and disasters consume the RNG too; they must replay identically.
  engine.execute({ type: 'setDisasters', enabled: true });
  buildTown(engine);
  s.run(12);
  engine.execute({ type: 'setTax', zone: 'commercial', rate: 9 });
  engine.execute({
    type: 'zone',
    zone: ZoneType.Residential,
    density: ZoneDensity.Light,
    x0: 1,
    y0: 21,
    x1: 5,
    y1: 23,
  });
  s.run(12, (e, m) => {
    if (m === 5) e.execute({ type: 'setFunding', department: 'transport', value: 80 });
  });
  return s;
}

describe('scenario: repeated simulation', () => {
  it('same seed and commands give the same hash and the same report', () => {
    const a = play(flatCity('repeat', 64));
    const b = play(flatCity('repeat', 64));
    const other = play(flatCity('repeat-other', 64));
    a.check(
      'identical final hash',
      hashState(a.engine) === hashState(b.engine),
      hashState(a.engine),
    );
    const strip = (s: Scenario) => s.metrics.map(({ msPerMonth: _ms, ...m }) => m);
    a.check('identical monthly metrics', JSON.stringify(strip(a)) === JSON.stringify(strip(b)));
    a.check('different seed diverges', hashState(other.engine) !== hashState(a.engine));
    a.finish();
  });

  it('generated terrain cities are reproducible too', () => {
    const make = () => {
      const e = createEngine({ seed: 'terrain-repeat', size: 64 });
      e.runMonths(6);
      return hashState(e);
    };
    expect(make()).toBe(make());
  });
});
