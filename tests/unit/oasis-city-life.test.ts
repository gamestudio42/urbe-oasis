import { Infra, type BuildingRecord } from '@city/shared';
import { createEngine, type SimulationEngine } from '@city/simulation';
import { describe, expect, it } from 'vitest';
import { canalPalm } from '../../packages/view-city/src/chunkDraw';
import { caravanRoutes, streetLife } from '../../packages/view-city/src/animation/AnimationLayer';
import {
  CAMEL_SPACING,
  CaravanSim,
  caravanRoute,
} from '../../packages/view-city/src/animation/caravans';
import { createRandom } from '../../packages/view-city/src/animation/random';
import { worldRoadView, type RoadView } from '../../packages/view-city/src/animation/roads';
import {
  MAX_WALKERS,
  WalkerSim,
  walkerDensity,
  type StreetLife,
} from '../../packages/view-city/src/animation/walkers';

function city(): SimulationEngine {
  const e = createEngine({
    seed: 'city-life',
    size: 24,
    ruleset: 'oasis',
    funds: 100_000,
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
  });
  e.disastersEnabled = false;
  return e;
}

function lot(e: SimulationEngine, kind: 'residential' | 'commercial', x: number, y: number) {
  return e.buildings.add({
    kind,
    x,
    y,
    w: 1,
    h: 1,
    level: 1,
    capacity: 10,
    occupancy: 6,
    condition: 100,
    age: 0,
    abandoned: false,
    emptyMonths: 0,
    variant: 0,
    powered: true,
    watered: true,
    offline: 0,
    attractiveness: 0,
  });
}

const buildings = (e: SimulationEngine) =>
  new Map<number, BuildingRecord>([...e.buildings.values()].map((b) => [b.id, b]));

/** A straight east-west street from x0 to x1 on row y. */
function street(size: number, y: number, x0: number, x1: number): StreetLife {
  const roads = new Set<number>();
  for (let x = x0; x <= x1; x++) roads.add(y * size + x);
  const footfall = new Float32Array(size * size);
  const stalls = new Uint8Array(size * size);
  for (const i of roads) footfall[i] = 0.9;
  return {
    size,
    hasRoad: (i) => roads.has(i),
    traffic: new Uint8Array(size * size),
    footfall,
    stalls,
  };
}

describe('oasis street life', () => {
  it('draws more people to streets that front shops than to quiet ones', () => {
    const e = city();
    expect(e.execute({ type: 'road', x0: 2, y0: 10, x1: 20, y1: 10 }).ok).toBe(true);
    lot(e, 'residential', 4, 9);
    lot(e, 'commercial', 12, 9);
    const roads = worldRoadView(e.world);
    const life = streetLife(e.world, roads, buildings(e));
    const home = e.world.index(4, 10);
    const shop = e.world.index(12, 10);
    expect(life.footfall[home]).toBeGreaterThan(0);
    expect(life.footfall[shop]).toBeGreaterThan(life.footfall[home] as number);
    expect(life.stalls[shop]).toBe(1);
    expect(life.stalls[home]).toBe(0);
    expect(life.footfall[e.world.index(18, 10)]).toBe(0);
    expect(walkerDensity(0)).toBe(0);
    expect(walkerDensity(5)).toBeLessThan(1);
  });

  it('walks pedestrians along the street, freezes them while paused and caps the crowd', () => {
    const view = street(24, 10, 2, 20);
    const sim = new WalkerSim(createRandom(7));
    const tiles = [...Array(19).keys()].map((k) => 10 * 24 + 2 + k);
    for (let k = 0; k < 30; k++) sim.populate(view, tiles);
    expect(sim.walkers.length).toBeGreaterThan(0);
    expect(sim.walkers.length).toBeLessThanOrEqual(MAX_WALKERS);
    const before = sim.walkers.map((w) => [w.tile, w.t]);
    sim.step(view, 0, () => true);
    expect(sim.walkers.map((w) => [w.tile, w.t])).toEqual(before);
    for (let k = 0; k < 40; k++) sim.step(view, 0.25, () => true);
    for (const w of sim.walkers) expect(view.hasRoad(w.tile)).toBe(true);
  });

  it('routes caravans from the far end of the street network to a staffed caravanserai', () => {
    const e = city();
    expect(e.execute({ type: 'road', x0: 0, y0: 10, x1: 20, y1: 10 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'windTurbine', x: 14, y: 8 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'caravanserai', x: 15, y: 8 }).ok).toBe(true);
    e.refreshUtilities();
    const roads = worldRoadView(e.world);
    const routes = caravanRoutes(e.world, roads, buildings(e));
    expect(routes).toHaveLength(1);
    const path = routes[0]!.path;
    // The map-edge road is where a caravan arrives from the desert.
    expect(path[0]).toBe(e.world.index(0, 10));
    expect([e.world.index(15, 10), e.world.index(16, 10)]).toContain(path[path.length - 1]);
    const serai = e.buildings.ofKind('caravanserai')[0]!;
    serai.occupancy = 0;
    expect(caravanRoutes(e.world, roads, buildings(e))).toEqual([]);
  });

  it('sends a pack line along the route, lets it finish during an outage and fades it out', () => {
    const view: RoadView = street(24, 10, 0, 12);
    const route = caravanRoute(view, [10 * 24 + 12])!;
    expect(route.path.length).toBe(13);
    const sim = new CaravanSim(createRandom(3));
    sim.setRoutes([route]);
    sim.step(0.1);
    expect(sim.caravans).toHaveLength(1);
    sim.step(4);
    const poses = sim.poses();
    expect(poses.length).toBeGreaterThanOrEqual(3);
    expect(poses.every((p) => p.alpha > 0 && p.alpha <= 1)).toBe(true);
    // The camels keep their spacing along the route.
    expect(poses[0]!.tile - poses[poses.length - 1]!.tile).toBeLessThanOrEqual(
      Math.ceil(CAMEL_SPACING * poses.length),
    );
    sim.setRoutes([]);
    sim.step(1);
    expect(sim.caravans).toHaveLength(1);
    for (let k = 0; k < 80; k++) sim.step(1);
    expect(sim.caravans).toHaveLength(0);
  });

  it('sends no caravan while paused, even when a reopened caravanserai has one due', () => {
    const route = caravanRoute(street(24, 10, 0, 12), [10 * 24 + 12])!;
    const sim = new CaravanSim(createRandom(3));
    sim.setRoutes([route]);
    sim.setRoutes([]);
    sim.setRoutes([route]);
    sim.step(0);
    expect(sim.caravans).toHaveLength(0);
    sim.step(0.1);
    expect(sim.caravans).toHaveLength(1);
  });

  it('lines only shaded canals with palms, chosen by tile so they never flicker', () => {
    const e = city();
    expect(e.execute({ type: 'canal', x0: 2, y0: 5, x1: 20, y1: 5 }).ok).toBe(true);
    const w = e.world;
    const dry = [...Array(19).keys()].filter((k) => canalPalm(w, 2 + k, 5));
    expect(dry).toEqual([]);
    expect(e.execute({ type: 'place', kind: 'palm', x: 21, y: 5 }).ok).toBe(true);
    e.refreshUtilities();
    const shaded = [...Array(19).keys()].filter((k) => canalPalm(w, 2 + k, 5));
    expect(shaded.length).toBeGreaterThan(0);
    expect(shaded.length).toBeLessThan(19);
    expect([...Array(19).keys()].filter((k) => canalPalm(w, 2 + k, 5))).toEqual(shaded);
    expect(canalPalm(w, 10, 12)).toBe(false);
    expect(w.hasInfra(w.index(10, 5), Infra.Canal)).toBe(true);
  });
});
