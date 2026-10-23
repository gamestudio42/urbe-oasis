import { BALANCE, Infra, TICKS_PER_MONTH, type SimEvent } from '@city/shared';
import {
  buildTown,
  flatCity,
  hashState,
  SimulationEngine,
  type SimulationEngine as Engine,
} from '@city/simulation';
import { describe, expect, it } from 'vitest';

const ticksPerDay = BALANCE.clock.ticksPerDay;

/** A solid block of parks: every tile is a flammable building. */
function parkBlock(seed: string, size = 24, block = 8): Engine {
  const e = flatCity(seed, size);
  for (let y = 4; y < 4 + block; y++) {
    for (let x = 4; x < 4 + block; x++) e.execute({ type: 'place', kind: 'park', x, y });
  }
  return e;
}

function parks(e: Engine): number {
  return e.buildings.ofKind('park').length;
}

function rubble(e: Engine): number {
  let n = 0;
  for (let i = 0; i < e.world.tileCount; i++) if (e.world.hasInfra(i, Infra.Rubble)) n++;
  return n;
}

function drain(e: Engine): SimEvent[] {
  return e.takeEvents();
}

describe('fire', () => {
  it('spreads through adjacent buildings and leaves rubble without coverage', () => {
    const e = parkBlock('fire-spread');
    expect(e.triggerDisaster('fire', 8, 8)).toBe(true);
    expect(e.fireCount).toBe(1);
    e.runTicks(BALANCE.fire.burnout * 3);
    expect(e.losses.fire).toBeGreaterThan(3);
    expect(rubble(e)).toBe(64 - parks(e));
    expect(drain(e).some((ev) => ev.type === 'buildingDestroyed' && ev.cause === 'fire')).toBe(
      true,
    );
  });

  it('cannot start on bare land or on a tile already burning', () => {
    const e = parkBlock('fire-invalid');
    expect(e.triggerDisaster('fire', 20, 20)).toBe(false);
    expect(e.triggerDisaster('fire', 5, 5)).toBe(true);
    expect(e.triggerDisaster('fire', 5, 5)).toBe(false);
  });

  it('is put out sooner and spreads less under full fire coverage', () => {
    const burnt = (covered: boolean) => {
      let total = 0;
      for (let k = 0; k < 6; k++) {
        const e = parkBlock(`fire-cover-${k}`);
        // The monthly service update would reset a hand-written coverage map.
        if (covered) {
          e.registerSystem({ id: 'cover', update: (s) => s.world.influence.fireCover.fill(255) });
          e.world.influence.fireCover.fill(255);
        }
        e.triggerDisaster('fire', 7, 7);
        e.triggerDisaster('fire', 9, 9);
        e.runTicks(BALANCE.fire.burnout * 20);
        expect(e.fireCount).toBe(0);
        total += e.losses.fire;
      }
      return total;
    };
    const uncovered = burnt(false);
    const covered = burnt(true);
    expect(covered).toBeLessThan(uncovered / 3);
  });

  it('forests burn out quickly and do not consume the whole map', () => {
    const e = flatCity('forest-fire', 32);
    e.world.trees.fill(3);
    e.triggerDisaster('fire', 16, 16);
    e.runTicks(TICKS_PER_MONTH * 3);
    let bare = 0;
    for (let i = 0; i < e.world.tileCount; i++) if (e.world.trees[i] === 0) bare++;
    expect(e.fireCount).toBe(0);
    expect(bare).toBeGreaterThan(0);
    expect(bare).toBeLessThan(e.world.tileCount / 4);
  });

  it('restores mid-fire saves and continues identically', () => {
    const a = parkBlock('fire-save');
    a.triggerDisaster('fire', 6, 6);
    a.triggerDisaster('fire', 9, 10);
    a.runTicks(37);
    const b = SimulationEngine.fromSnapshot(a.serialize());
    expect(b.fireCount).toBe(a.fireCount);
    expect(hashState(b)).toBe(hashState(a));
    a.runTicks(200);
    b.runTicks(200);
    expect(hashState(b)).toBe(hashState(a));
  });

  it('random fires only start when disasters are enabled', () => {
    const quiet = parkBlock('random-fire', 24, 12);
    quiet.runMonths(36);
    expect(quiet.losses.fire + quiet.fireCount).toBe(0);
  });
});

describe('flood', () => {
  function shoreCity(seed: string): Engine {
    const e = flatCity(seed, 32);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 3; x++) e.world.terrain[e.world.index(x, y)] = 0;
    }
    e.world.terrainVersion++;
    return e;
  }

  it('rises from the shore, damages buildings and recedes after its duration', () => {
    const e = shoreCity('flood');
    for (let y = 10; y < 20; y++) e.execute({ type: 'place', kind: 'park', x: 4, y });
    expect(e.triggerDisaster('flood', 10, 15)).toBe(true);
    expect(e.triggerDisaster('flood', 10, 15)).toBe(false);
    const flood = e.world.flood;
    e.runTicks(BALANCE.disasters.floodSpreadDays * ticksPerDay);
    const flooded = flood.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);
    expect(flooded).toBeGreaterThan(10);
    expect(flooded).toBeLessThanOrEqual(BALANCE.disasters.floodMaxTiles);
    const damaged = e.buildings.ofKind('park').some((b) => b.condition < 100);
    expect(damaged || e.losses.flood > 0).toBe(true);

    e.runTicks(BALANCE.disasters.floodDays * ticksPerDay);
    expect(flood.every((v) => v === 0)).toBe(true);
    expect(e.disasters).toEqual([]);
    expect(drain(e).some((ev) => ev.type === 'disasterEnded' && ev.disaster === 'flood')).toBe(
      true,
    );
  });

  it('needs a shore', () => {
    const e = flatCity('no-shore', 32);
    expect(e.triggerDisaster('flood')).toBe(false);
  });
});

describe('earthquake, blackout, crisis and epidemic', () => {
  it('an earthquake destroys buildings and cuts networks near the epicentre', () => {
    const e = flatCity('quake', 64);
    const layout = buildTown(e);
    e.runMonths(8);
    const before = e.buildings.size;
    expect(e.triggerDisaster('earthquake', 20, layout.avenueY)).toBe(true);
    expect(e.buildings.size).toBeLessThan(before);
    expect(rubble(e)).toBeGreaterThan(0);
    expect(e.losses.earthquake).toBeGreaterThan(0);
  });

  it('a blackout takes a plant offline and restores it afterwards', () => {
    const e = flatCity('blackout', 64);
    buildTown(e);
    e.runMonths(4);
    const supply = e.stats().power.supply;
    expect(supply).toBeGreaterThan(0);
    expect(e.triggerDisaster('blackout')).toBe(true);
    expect(e.stats().power.supply).toBeLessThan(supply);
    e.runTicks(BALANCE.disasters.blackoutDays * ticksPerDay + ticksPerDay);
    expect(e.stats().power.supply).toBe(supply);
    expect(e.disasters).toEqual([]);
  });

  it('a blackout needs a power plant', () => {
    expect(flatCity('no-plant', 32).triggerDisaster('blackout')).toBe(false);
  });

  it('crisis and epidemic last a fixed time and do not stack', () => {
    const e = flatCity('timed', 32);
    expect(e.triggerDisaster('crisis')).toBe(true);
    expect(e.triggerDisaster('crisis')).toBe(false);
    expect(e.triggerDisaster('epidemic')).toBe(true);
    expect(e.stats().disasters.map((d) => d.kind)).toEqual(['crisis', 'epidemic']);
    e.runMonths(BALANCE.disasters.epidemicMonths);
    expect(e.disasters.map((d) => d.kind)).toEqual(['crisis']);
    e.runMonths(BALANCE.disasters.crisisMonths - BALANCE.disasters.epidemicMonths);
    expect(e.disasters).toEqual([]);
  });

  it('an economic crisis lowers industrial demand and tax revenue', () => {
    const base = flatCity('crisis-effect', 64);
    buildTown(base);
    base.runMonths(18);
    const hit = SimulationEngine.fromSnapshot(base.serialize());
    hit.triggerDisaster('crisis');
    base.runMonths(3);
    hit.runMonths(3);
    const revenue = (e: Engine) => {
      const r = e.economy.lastMonth.revenue;
      return r.residential + r.commercial + r.industrial;
    };
    expect(revenue(hit)).toBeLessThan(revenue(base));
    expect(hit.demand.industrial).toBeLessThan(base.demand.industrial);
  });
});
