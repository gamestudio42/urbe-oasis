import { OASIS_ARCADE } from '@city/shared';
import {
  buildTown,
  createEngine,
  ARCADE_LANE_CAP,
  arcadeCapacity,
  arcadeLanes,
  arcadeRelief,
  arcadeCount,
  type SimulationEngine,
} from '@city/simulation';
import { describe, expect, it } from 'vitest';

/**
 * Flat oasis city with the standard town and room for an arcade beside the avenue at y = 20.
 * The footprint is 2x2, so (38,21) hugs the road and satisfies `requiresRoad`.
 */
function droneTown(seed = 'neon-drone'): SimulationEngine {
  const e = createEngine({
    seed,
    size: 64,
    ruleset: 'oasis',
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    funds: 400_000,
  });
  e.disastersEnabled = false;
  buildTown(e);
  return e;
}

describe('neon drone traffic', () => {
  it('has no capacity and no relief without a port', () => {
    const e = droneTown();
    e.refreshUtilities();
    expect(arcadeCount(e)).toBe(0);
    expect(arcadeCapacity(e)).toBe(0);
    expect(arcadeRelief(e, 100)).toBe(0);
    expect(arcadeLanes(e)).toEqual([]);
  });

  it('adds capacity and relief once a port is online', () => {
    const e = droneTown();
    expect(e.execute({ type: 'place', kind: 'arcade', x: 38, y: 21 }).ok).toBe(true);
    e.refreshUtilities();
    expect(arcadeCount(e)).toBe(1);
    expect(arcadeCapacity(e)).toBe(OASIS_ARCADE.perPort);
    expect(arcadeRelief(e, 100)).toBeGreaterThan(0);
  });

  it('never exceeds the configured relief cap', () => {
    const e = droneTown();
    e.execute({ type: 'place', kind: 'arcade', x: 38, y: 21 });
    e.refreshUtilities();
    expect(arcadeRelief(e, 1)).toBeLessThanOrEqual(OASIS_ARCADE.relief);
    expect(arcadeRelief(e, 10_000)).toBeLessThanOrEqual(OASIS_ARCADE.relief);
  });

  it('scales relief with the number of online ports', () => {
    const e = droneTown();
    e.execute({ type: 'place', kind: 'arcade', x: 38, y: 21 });
    e.refreshUtilities();
    const one = arcadeRelief(e, 400);
    expect(e.execute({ type: 'place', kind: 'arcade', x: 22, y: 13 }).ok).toBe(true);
    e.refreshUtilities();
    const two = arcadeRelief(e, 400);
    expect(two).toBeGreaterThanOrEqual(one);
  });

  it('takes an offline port out of service', () => {
    const e = droneTown();
    e.execute({ type: 'place', kind: 'arcade', x: 38, y: 21 });
    e.refreshUtilities();
    expect(arcadeCount(e)).toBe(1);
    const port = e.buildings.ofKind('arcade')[0];
    expect(port).toBeDefined();
    if (!port) return;
    port.offline = 20;
    expect(arcadeCount(e)).toBe(0);
    expect(arcadeCapacity(e)).toBe(0);
  });

  it('derives a lane along the avenue beside the port', () => {
    const e = droneTown();
    e.execute({ type: 'place', kind: 'arcade', x: 38, y: 21 });
    e.refreshUtilities();
    const lanes = arcadeLanes(e);
    expect(lanes).toHaveLength(1);
    // The port sits south of the avenue at y = 20. The corridor runs west along that street,
    // not one tile north into the block.
    expect(lanes[0]).toMatchObject({ x: 38, y: 20, length: ARCADE_LANE_CAP, heading: 2 });
  });

  it('leaves the classic ruleset without drone relief', () => {
    const e = createEngine({
      seed: 'classic-drone',
      size: 64,
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
      funds: 400_000,
    });
    e.disastersEnabled = false;
    buildTown(e);
    e.runMonths(6);
    expect(e.stats().oasis).toBeUndefined();
  });

  it('is deterministic for the same seed', () => {
    const a = droneTown('drone-same');
    const b = droneTown('drone-same');
    a.execute({ type: 'place', kind: 'arcade', x: 38, y: 21 });
    b.execute({ type: 'place', kind: 'arcade', x: 38, y: 21 });
    a.runMonths(6);
    b.runMonths(6);
    expect(arcadeLanes(a)).toEqual(arcadeLanes(b));
    expect(a.stats().avgCongestion).toBe(b.stats().avgCongestion);
  });
});
