import { Infra, isZoneKind } from '@city/shared';
import { addServices, buildTown, flatCity, maintainTown, SimulationEngine } from '@city/simulation';
import { describe, it } from 'vitest';
import { Scenario } from './harness';

function rubbleTiles(e: SimulationEngine): number {
  let n = 0;
  for (let i = 0; i < e.world.tileCount; i++) if (e.world.hasInfra(i, Infra.Rubble)) n++;
  return n;
}

describe('scenario: fire near a fire station', () => {
  it('the same fires burn less where firefighters can reach', () => {
    const base = flatCity('fire-station', 64);
    const layout = buildTown(base, { pumps: 8 });
    addServices(base, layout);
    for (let m = 0; m < 24; m++) {
      base.runMonths(1);
      maintainTown(base);
    }

    // Zone buildings around the fire station (2×2 at x = 4, avenue + 2).
    const station = base.buildings.ofKind('fireStation')[0];
    if (!station) throw new Error('fire station missing');
    const targets = base.buildings
      .list()
      .filter(
        (b) =>
          isZoneKind(b.kind) &&
          Math.max(Math.abs(b.x - station.x), Math.abs(b.y - station.y)) <= 12,
      )
      .filter((_, k) => k % 3 === 0)
      .slice(0, 8);

    const snapshot = base.serialize();
    const covered = SimulationEngine.fromSnapshot(snapshot);
    const uncovered = SimulationEngine.fromSnapshot(snapshot);
    // Without funding the station provides no coverage; apply that before the next month.
    uncovered.execute({ type: 'setFunding', department: 'fire', value: 0 });
    uncovered.world.influence.fireCover.fill(0);

    const cover = covered.world.influence.fireCover;
    const coveredTargets = targets.filter(
      (b) => (cover[covered.world.index(b.x, b.y)] as number) >= 128,
    ).length;

    const withStation = new Scenario('fire-near-station', covered);
    const withoutStation = new Scenario('fire-without-coverage', uncovered);
    for (const e of [covered, uncovered]) {
      for (const b of targets) e.triggerDisaster('fire', b.x, b.y);
    }
    withStation.run(4);
    withoutStation.run(4);

    const lostWith = covered.losses.fire;
    const lostWithout = uncovered.losses.fire;
    const s = withStation;
    s.check('fires were started', targets.length >= 6, targets.length);
    s.check(
      'targets lie inside the station coverage',
      coveredTargets >= targets.length / 2,
      coveredTargets,
    );
    s.check(
      'all fires are out after four months',
      covered.fireCount === 0 && uncovered.fireCount === 0,
    );
    s.check('uncovered fires destroy buildings', lostWithout >= targets.length / 2, lostWithout);
    s.check(
      'coverage limits the damage to under half',
      lostWith < lostWithout / 2,
      `${lostWith} vs ${lostWithout}`,
    );
    s.check(
      'less burnt area with the station',
      rubbleTiles(covered) < rubbleTiles(uncovered),
      `${rubbleTiles(covered)} vs ${rubbleTiles(uncovered)} rubble tiles`,
    );
    s.check(
      'more population survives with the station',
      withStation.last.population >= withoutStation.last.population,
      `${withStation.last.population} vs ${withoutStation.last.population}`,
    );
    withoutStation.check('control ran', withoutStation.metrics.length === 4);
    withoutStation.finish({ destroyed: lostWithout, rubble: rubbleTiles(uncovered) });
    s.finish({
      targets: targets.map((b) => ({ x: b.x, y: b.y, kind: b.kind })),
      destroyed: { withStation: lostWith, withoutCoverage: lostWithout },
      rubble: { withStation: rubbleTiles(covered), withoutCoverage: rubbleTiles(uncovered) },
    });
  });
});
