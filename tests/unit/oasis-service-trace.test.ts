import {
  OASIS_SHADE,
  OASIS_WATER,
  PLACEABLE_SPECS,
  ZoneDensity,
  ZoneType,
  isZoneKind,
  type BuildingRecord,
} from '@city/shared';
import {
  SIM_PRESETS,
  SimulationEngine,
  createEngine,
  explainService,
  serviceNetworkOf,
  traceService,
  type ServiceContext,
  type ServiceNetwork,
} from '@city/simulation';
import { describe, expect, it } from 'vitest';

function city(): SimulationEngine {
  const e = createEngine({
    seed: 'service-trace',
    size: 24,
    ruleset: 'oasis',
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    funds: 100_000,
  });
  e.disastersEnabled = false;
  return e;
}

function context(e: SimulationEngine): ServiceContext {
  const stats = e.stats();
  return {
    world: e.world,
    building: (id) => e.buildings.get(id),
    spring: stats.oasis?.spring ?? null,
    cisternCharge: stats.oasis?.cisterns.charge ?? 0,
  };
}

function shop(e: SimulationEngine, x: number, y: number, level: number): BuildingRecord {
  return e.buildings.add({
    kind: 'commercial',
    x,
    y,
    w: 1,
    h: 1,
    level,
    capacity: 20,
    occupancy: 4,
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

const run = (e: SimulationEngine, command: Parameters<SimulationEngine['execute']>[0]) =>
  expect(e.execute(command).ok).toBe(true);

describe('oasis service trace', () => {
  it('maps construction tools to the network they extend', () => {
    expect(serviceNetworkOf('canal')).toBe('shade');
    expect(serviceNetworkOf('palm')).toBe('shade');
    expect(serviceNetworkOf('springHouse')).toBe('shade');
    expect(serviceNetworkOf('pipe')).toBe('water');
    expect(serviceNetworkOf('well')).toBe('water');
    expect(serviceNetworkOf('qanat')).toBe('water');
    expect(serviceNetworkOf('cistern')).toBe('water');
    expect(serviceNetworkOf('powerLine')).toBe('power');
    expect(serviceNetworkOf('windTurbine')).toBe('power');
    expect(serviceNetworkOf('fireStation')).toBeNull();
    expect(serviceNetworkOf('road')).toBeNull();
  });

  it('reports a lot with no shade source in reach as disconnected', () => {
    const e = city();
    shop(e, 5, 5, 1);
    e.refreshUtilities();
    const result = explainService(context(e), 'shade', 5, 5);
    expect(result.status).toBe('disconnected');
    expect(result.trace.sources).toEqual([]);
  });

  it('follows a canal from a planted palm to the lot it shades', () => {
    const e = city();
    shop(e, 5, 5, 1);
    run(e, { type: 'place', kind: 'palm', x: 9, y: 5 });
    run(e, { type: 'canal', x0: 6, y0: 5, x1: 8, y1: 5 });
    e.refreshUtilities();
    const result = explainService(context(e), 'shade', 5, 5);
    expect(result.status).toBe('served');
    expect(result.trace.sources).toMatchObject([
      { kind: 'palm', supply: OASIS_SHADE.palmSupply, issue: null, planned: false },
    ]);
    for (const x of [5, 6, 7, 8, 9]) expect(result.trace.tiles).toContain(e.world.index(x, 5));
    expect(result.trace.consumers).toBe(1);
    expect(result.trace.served).toBe(1);
  });

  it('names an unpowered spring house as the idle source', () => {
    const e = city();
    shop(e, 5, 5, 1);
    run(e, { type: 'canal', x0: 6, y0: 5, x1: 8, y1: 5 });
    run(e, { type: 'place', kind: 'springHouse', x: 9, y: 5 });
    e.refreshUtilities();
    const result = explainService(context(e), 'shade', 5, 5);
    expect(result.status).toBe('sourcesIdle');
    expect(result.issues).toEqual(['NO_POWER']);
  });

  it('separates a supplied network that is short from a disconnected one', () => {
    const e = city();
    // A level-7 shop asks for more shade than one palm gives.
    shop(e, 5, 5, 7);
    run(e, { type: 'place', kind: 'palm', x: 6, y: 5 });
    e.refreshUtilities();
    const result = explainService(context(e), 'shade', 5, 5);
    expect(result.status).toBe('shortage');
    expect(result.trace.supply).toBe(OASIS_SHADE.palmSupply);
    expect(result.trace.demand).toBeGreaterThan(result.trace.supply);
  });

  it('explains wells that lack power or lose water to the sun', () => {
    const e = city();
    shop(e, 5, 5, 1);
    run(e, { type: 'place', kind: 'well', x: 6, y: 5 });
    e.refreshUtilities();
    expect(explainService(context(e), 'water', 5, 5)).toMatchObject({
      status: 'sourcesIdle',
      issues: ['NO_POWER'],
    });
    run(e, { type: 'place', kind: 'windTurbine', x: 7, y: 5 });
    e.refreshUtilities();
    const result = explainService(context(e), 'water', 5, 5);
    expect(result.status).toBe('served');
    expect(result.issues).toEqual(['UNSHADED']);
    expect(result.trace.supply).toBe(
      Math.round(PLACEABLE_SPECS.well.waterSupply * OASIS_WATER.evaporation),
    );
  });

  it('lets an empty zoned lot borrow service from a neighbour, like the solver', () => {
    const e = city();
    run(e, { type: 'place', kind: 'palm', x: 6, y: 5 });
    run(e, {
      type: 'zone',
      zone: ZoneType.Residential,
      density: ZoneDensity.Light,
      x0: 5,
      y0: 5,
      x1: 5,
      y1: 5,
    });
    e.refreshUtilities();
    expect(explainService(context(e), 'shade', 5, 5).status).toBe('served');
    expect(explainService(context(e), 'shade', 2, 2).status).toBe('none');
  });

  it('predicts the network a planned canal or building would join', () => {
    const e = city();
    shop(e, 5, 5, 1);
    run(e, { type: 'place', kind: 'palm', x: 9, y: 5 });
    e.refreshUtilities();
    const ctx = context(e);
    const canal = [6, 7, 8].map((x) => e.world.index(x, 5));
    const joined = traceService(ctx, 'shade', canal, { tiles: canal });
    expect(joined.sources.map((s) => s.kind)).toEqual(['palm']);
    expect(joined.consumers).toBe(1);
    const alone = traceService(ctx, 'shade', [e.world.index(5, 9)], {
      tiles: [e.world.index(5, 9)],
    });
    expect(alone.sources).toEqual([]);

    const house = { kind: 'springHouse' as const, x: 12, y: 12 };
    const start = [e.world.index(12, 12)];
    const planned = traceService(ctx, 'shade', start, { tiles: start, building: house });
    expect(planned.sources).toMatchObject([{ planned: true, supply: 0, issue: 'NO_POWER' }]);
    run(e, { type: 'place', kind: 'windTurbine', x: 14, y: 12 });
    e.refreshUtilities();
    const powered = traceService(context(e), 'shade', start, { tiles: start, building: house });
    expect(powered.sources).toMatchObject([
      { planned: true, supply: OASIS_SHADE.springSupplyDry, issue: 'NO_WATER' },
    ]);
    // Planning reads the mirror only.
    expect(e.buildings.ofKind('springHouse')).toHaveLength(0);
  });

  it('agrees with the solver on every lot of a grown oasis city', () => {
    const { engine } = SIM_PRESETS['oasis-balanced']!.create('trace-preset', 64);
    engine.runMonths(18);
    engine.refreshUtilities();
    const ctx = context(engine);
    const networks: ServiceNetwork[] = ['power', 'water', 'shade'];
    let checked = 0;
    for (const b of engine.buildings.values()) {
      if (!isZoneKind(b.kind) || b.abandoned) continue;
      for (const network of networks) {
        const result = explainService(ctx, network, b.x, b.y);
        const served =
          network === 'power' ? b.powered : network === 'water' ? b.watered : b.linked === true;
        expect(result.status === 'served').toBe(served);
        if (served) expect(result.trace.sources.length).toBeGreaterThan(0);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(30);
  });
});
