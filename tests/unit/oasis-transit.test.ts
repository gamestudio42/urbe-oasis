import { OASIS_TRANSIT, PLACEABLE_SPECS, type BuildingRecord } from '@city/shared';
import {
  SIM_PRESETS,
  SimulationEngine,
  boardRiders,
  boardingStop,
  createEngine,
  pathEnd,
  type TransitCatchment,
} from '@city/simulation';
import { describe, expect, it } from 'vitest';
import { computeMonthlyReport } from '../../packages/simulation/src/systems/economy';

/** A path tree on a 1-D road 0 → 1 → … → n−1 whose single source is tile 0. */
function line(n: number) {
  const dist = new Float64Array(n);
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    dist[i] = i;
    parent[i] = i - 1;
  }
  return { dist, parent };
}

/** A catchment over `n` tiles: `served[i]` is the 1-based stop serving tile i, or 0. */
function catchment(served: number[], onRoute: number[]): TransitCatchment {
  const stops = onRoute.map((_, k) => ({ id: k + 1, occupancy: 0, capacity: 0 }) as BuildingRecord);
  return {
    stopOf: Int32Array.from(served),
    stops,
    onRoute: Uint8Array.from([0, ...onRoute]),
  };
}

/** The journey city once its caravan stops are built, and a copy without the stops. */
function routeCity(): { withStops: SimulationEngine; without: SimulationEngine } {
  const run = SIM_PRESETS['oasis-journey']!.create('1', 64);
  for (let m = 0; m < 120 && run.engine.buildings.ofKind('caravanStop').length === 0; m++) {
    run.engine.runMonths(1);
    run.onMonth(run.engine);
  }
  expect(run.engine.buildings.ofKind('caravanStop').length).toBe(6);
  const without = SimulationEngine.fromSnapshot(run.engine.serialize());
  for (const stop of without.buildings.ofKind('caravanStop')) without.buildings.remove(stop.id);
  return { withStops: run.engine, without };
}

describe('Oasis caravan routes', () => {
  it('follows a path back to its source', () => {
    const tree = line(6);
    expect(pathEnd(tree, 5)).toBe(0);
    expect(pathEnd(tree, 0)).toBe(0);
    tree.dist[3] = Number.POSITIVE_INFINITY;
    expect(pathEnd(tree, 3)).toBe(-1);
  });

  it('boards a trip only when both ends are served and the stop is on a route', () => {
    const tree = line(6);
    // Stop 1 serves the far end, stop 2 the source end.
    const both = catchment([2, 2, 0, 0, 1, 1], [1, 1]);
    expect(boardingStop(both, tree, 5)).toBe(1);
    // The source end is not served: the trip drives.
    expect(boardingStop(catchment([0, 0, 0, 0, 1, 1], [1, 1]), tree, 5)).toBe(0);
    // A lone stop is no route.
    expect(boardingStop(catchment([1, 1, 0, 0, 1, 1], [0]), tree, 5)).toBe(0);
    // Both ends beside the same stop ride when that stop is on a route.
    expect(boardingStop(catchment([1, 1, 0, 0, 1, 1], [1, 1]), tree, 5)).toBe(1);
  });

  it('boards a share of each trip, scaled down evenly past a stop capacity', () => {
    const e = createEngine({ seed: 'transit', size: 16, ruleset: 'oasis' });
    const tree = line(4);
    const c = catchment([1, 0, 0, 1], [1]);
    const share = OASIS_TRANSIT.riderShare;
    const small = boardRiders(e, c, [{ start: 3, tree, amount: 100, stop: 1 }]);
    expect(small[0]).toBeCloseTo(100 * share, 9);
    const huge = OASIS_TRANSIT.stopCapacity * 4;
    const full = boardRiders(e, c, [
      { start: 3, tree, amount: huge, stop: 1 },
      { start: 3, tree, amount: huge, stop: 1 },
    ]);
    expect(full[0]! + full[1]!).toBeCloseTo(OASIS_TRANSIT.stopCapacity, 6);
    expect(full[0]).toBeCloseTo(full[1]!, 9);
  });

  it('takes riders off the roads of a grown city and reports them', () => {
    const { withStops, without } = routeCity();
    withStops.runMonths(2);
    without.runMonths(2);
    const transit = withStops.stats().oasis!.transit;
    expect(transit.stops).toBe(6);
    expect(transit.capacity).toBe(6 * OASIS_TRANSIT.stopCapacity);
    expect(transit.riders).toBeGreaterThan(0);
    expect(transit.riders).toBeLessThanOrEqual(transit.capacity);
    for (const stop of withStops.buildings.ofKind('caravanStop'))
      expect(stop.occupancy).toBeLessThanOrEqual(OASIS_TRANSIT.stopCapacity);
    const congestion = (e: SimulationEngine) => e.stats().avgCongestion;
    expect(congestion(withStops)).toBeLessThan(congestion(without));
  });

  it('boards nobody at a buried stop and books the stop upkeep on transport', () => {
    const { withStops } = routeCity();
    const factors = { crisisRevenue: 1, epidemicCommercial: 1 };
    const stops = withStops.buildings.ofKind('caravanStop');
    const before = computeMonthlyReport(withStops, factors).expenses.transport;
    withStops.buildings.remove(stops[0]!.id);
    const after = computeMonthlyReport(withStops, factors).expenses.transport;
    expect(before - after).toBe(PLACEABLE_SPECS.caravanStop.upkeep);
    for (const stop of withStops.buildings.ofKind('caravanStop')) stop.offline = 200;
    withStops.runMonths(1);
    expect(withStops.stats().oasis!.transit).toMatchObject({ stops: 0, riders: 0 });
  });
});
