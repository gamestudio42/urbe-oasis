import { BALANCE, Infra, ZoneDensity, ZoneType } from '@city/shared';
import { roadDijkstra } from '@city/simulation';
import { describe, expect, it } from 'vitest';
import { addWater, flatEngine } from '../helpers/engine';

describe('road network', () => {
  it('labels components, edge connections and access roads', () => {
    const e = flatEngine(32);
    e.execute({ type: 'road', x0: 0, y0: 5, x1: 10, y1: 5 });
    e.execute({ type: 'road', x0: 20, y0: 20, x1: 25, y1: 20 });
    const r = e.roads;
    r.update();
    const w = e.world;
    expect(r.componentCount).toBe(2);
    const a = r.component[w.index(3, 5)] as number;
    const b = r.component[w.index(22, 20)] as number;
    expect(a).not.toBe(b);
    expect(r.edgeConnected[a]).toBe(1);
    expect(r.edgeConnected[b]).toBe(0);
    expect(r.hasAccess(w.index(4, 8))).toBe(true);
    expect(r.accessDistance[w.index(4, 8)]).toBe(3);
    expect(r.hasAccess(w.index(4, 9))).toBe(false);
  });

  it('reaches every road tile when edge costs are fractional', () => {
    const e = flatEngine(64);
    e.execute({ type: 'road', x0: 0, y0: 10, x1: 63, y1: 10 });
    const w = e.world;
    const congestion = new Float32Array(w.tileCount);
    for (let x = 0; x < 64; x++) congestion[w.index(x, 10)] = 0.6 + ((x * 37) % 100) / 73;
    const tree = roadDijkstra(w, [w.index(63, 10)], congestion);
    for (let x = 0; x < 64; x++) {
      const d = tree.dist[w.index(x, 10)] as number;
      if (d <= BALANCE.traffic.maxCommute * BALANCE.traffic.searchFactor - 10) {
        expect(Number.isFinite(d)).toBe(true);
      }
    }
    // Distances grow monotonically away from the source along a single road.
    for (let x = 1; x < 63; x++) {
      const here = tree.dist[w.index(x, 10)] as number;
      const next = tree.dist[w.index(x + 1, 10)] as number;
      if (Number.isFinite(here)) expect(here).toBeGreaterThan(next);
    }
    expect(Number.isFinite(tree.dist[w.index(40, 10)] as number)).toBe(true);
  });

  it('joins two shores with a single road component over water', () => {
    const e = flatEngine(32);
    addWater(e, 10, 0, 12, 31);
    e.execute({ type: 'road', x0: 0, y0: 8, x1: 20, y1: 8 });
    const r = e.roads;
    r.update();
    const w = e.world;
    expect(r.componentCount).toBe(1);
    expect(r.bridgeTiles).toBe(3);
    expect(r.component[w.index(0, 8)]).toBe(r.component[w.index(20, 8)]);
    expect(r.component[w.index(0, 8)]).not.toBe(0);
  });

  it('recomputes only when roads change', () => {
    const e = flatEngine(16);
    e.roads.update();
    expect(e.roads.componentCount).toBe(0);
    e.execute({ type: 'road', x0: 2, y0: 2, x1: 5, y1: 2 });
    e.roads.update();
    expect(e.roads.componentCount).toBe(1);
    expect(e.roads.roadTiles).toBe(4);
  });
});

describe('power network', () => {
  it('powers zones connected by lines and conducts across one road tile', () => {
    const e = flatEngine(32);
    e.execute({ type: 'place', kind: 'windTurbine', x: 2, y: 2 });
    e.execute({ type: 'powerLine', x0: 3, y0: 2, x1: 6, y1: 2 });
    e.execute({
      type: 'zone',
      zone: ZoneType.Residential,
      density: ZoneDensity.Light,
      x0: 7,
      y0: 2,
      x1: 8,
      y1: 2,
    });
    e.execute({ type: 'road', x0: 9, y0: 0, x1: 9, y1: 10 });
    e.execute({
      type: 'zone',
      zone: ZoneType.Residential,
      density: ZoneDensity.Light,
      x0: 10,
      y0: 2,
      x1: 11,
      y1: 2,
    });
    e.execute({ type: 'road', x0: 12, y0: 0, x1: 13, y1: 0 });
    e.execute({ type: 'road', x0: 12, y0: 2, x1: 13, y1: 2 });
    e.execute({
      type: 'zone',
      zone: ZoneType.Residential,
      density: ZoneDensity.Light,
      x0: 14,
      y0: 2,
      x1: 14,
      y1: 2,
    });
    const w = e.world;
    expect(w.powered[w.index(5, 2)]).toBe(1);
    expect(w.powered[w.index(8, 2)]).toBe(1);
    expect(w.powered[w.index(10, 2)]).toBe(1);
    // Two road tiles in a row break the connection.
    expect(w.powered[w.index(14, 2)]).toBe(0);
  });

  it('serves the nearest consumers first when supply is short', () => {
    const e = flatEngine(48);
    const w = e.world;
    e.execute({ type: 'place', kind: 'windTurbine', x: 0, y: 0 });
    e.execute({ type: 'powerLine', x0: 1, y0: 0, x1: 40, y1: 0 });
    // Ten level-1 commercial buildings (3 units each) along the line: 60 units serve 20 buildings.
    for (let x = 1; x <= 40; x++) {
      e.buildings.add({
        kind: 'commercial',
        x,
        y: 1,
        w: 1,
        h: 1,
        level: 1,
        capacity: 4,
        occupancy: 0,
        condition: 100,
        age: 0,
        abandoned: false,
        emptyMonths: 0,
        variant: 0,
        powered: false,
        watered: false,
        offline: 0,
        attractiveness: 0,
      });
    }
    e.refreshUtilities();
    expect(w.powered[w.index(2, 1)]).toBe(1);
    expect(w.powered[w.index(39, 1)]).toBe(0);
    const stats = e.stats();
    expect(stats.power.supply).toBe(60);
    expect(stats.power.served).toBeGreaterThan(0.4);
    expect(stats.power.served).toBeLessThan(0.6);
  });
});

describe('water network', () => {
  it('needs a powered pump and yields more next to water', () => {
    const e = flatEngine(32);
    addWater(e, 0, 0, 31, 0);
    const w = e.world;
    e.execute({ type: 'place', kind: 'waterPump', x: 4, y: 1 });
    expect(e.stats().water.supply).toBe(0);
    e.execute({ type: 'place', kind: 'windTurbine', x: 6, y: 1 });
    expect(e.stats().water.supply).toBe(400);
    e.execute({ type: 'pipe', x0: 5, y0: 3, x1: 5, y1: 10 });
    expect(w.watered[w.index(5, 10)]).toBe(1);
    expect(w.hasInfra(w.index(5, 10), Infra.Pipe)).toBe(true);
  });

  it('serves a powered 1×1 well next to water', () => {
    const e = flatEngine(32);
    addWater(e, 0, 0, 31, 0);
    const w = e.world;
    e.execute({ type: 'place', kind: 'well', x: 4, y: 1 });
    expect(e.stats().water.supply).toBe(0);
    e.execute({ type: 'place', kind: 'windTurbine', x: 5, y: 1 });
    expect(e.stats().water.supply).toBe(80);
    e.execute({ type: 'pipe', x0: 4, y0: 2, x1: 4, y1: 8 });
    expect(w.watered[w.index(4, 8)]).toBe(1);
  });
});
