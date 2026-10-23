import { buildTown, flatCity, maintainTown, type SimulationEngine } from '@city/simulation';
import { describe, it } from 'vitest';
import { Scenario } from './harness';

/** Means over developed residential buildings. */
function residentialMeans(engine: SimulationEngine) {
  const inf = engine.world.influence;
  let n = 0;
  let pollution = 0;
  let land = 0;
  let attract = 0;
  for (const b of engine.buildings.values()) {
    if (b.kind !== 'residential' || b.abandoned) continue;
    const i = engine.world.index(b.x, b.y);
    pollution += inf.pollution[i] as number;
    land += inf.landValue[i] as number;
    attract += b.attractiveness;
    n++;
  }
  const d = Math.max(n, 1);
  return { pollution: pollution / d, landValue: land / d, attractiveness: attract / d, count: n };
}

describe('scenario: industry next to homes', () => {
  it('lowers residential land value and attractiveness', () => {
    const apart = new Scenario('industry-near-homes-control', flatCity('industry', 64));
    const near = new Scenario('industry-near-homes', flatCity('industry', 64));
    buildTown(apart.engine, { industry: 'far' });
    buildTown(near.engine, { industry: 'near' });
    apart.run(36, maintainTown);
    near.run(36, maintainTown);

    const a = residentialMeans(apart.engine);
    const n = residentialMeans(near.engine);
    near.check(
      'homes exist in both cities',
      a.count > 20 && n.count > 20,
      `${n.count} vs ${a.count}`,
    );
    const perIndustry = (m: { pollution: number }, s: Scenario) =>
      m.pollution / Math.max(1, s.last.buildings.industrial);
    near.check(
      'more pollution on homes',
      n.pollution > a.pollution,
      `${n.pollution} vs ${a.pollution}`,
    );
    near.check(
      'each industrial building pollutes homes more',
      perIndustry(n, near) > perIndustry(a, apart) * 1.3,
      `${perIndustry(n, near)} vs ${perIndustry(a, apart)}`,
    );
    near.check(
      'lower land value on homes',
      n.landValue < a.landValue,
      `${n.landValue} vs ${a.landValue}`,
    );
    near.check(
      'lower attractiveness',
      n.attractiveness < a.attractiveness,
      `${n.attractiveness} vs ${a.attractiveness}`,
    );
    near.check(
      'lower population',
      near.last.population < apart.last.population,
      `${near.last.population} vs ${apart.last.population}`,
    );
    apart.finish({ residential: a });
    near.finish({ residential: n, control: a });
  });
});
