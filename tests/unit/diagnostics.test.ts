import { ZoneDensity, ZoneType } from '@city/shared';
import { buildCorridor, diagnoseTile, flatCity, type SimulationEngine } from '@city/simulation';
import { describe, expect, it } from 'vitest';

function codes(engine: SimulationEngine, x: number, y: number): string[] {
  const s = engine.stats();
  return diagnoseTile(
    {
      world: engine.world,
      building: (id) => engine.buildings.get(id),
      demand: s.demand,
      taxes: s.taxes,
      power: s.power,
    },
    x,
    y,
  ).map((p) => p.code);
}

describe('diagnoseTile', () => {
  it('reports an unzoned empty tile', () => {
    const e = flatCity('diag', 32);
    expect(codes(e, 5, 5)).toEqual(['NO_ZONE']);
  });

  it('lists blocking problems first for a zone without road or power', () => {
    const e = flatCity('diag', 32);
    e.execute({
      type: 'zone',
      zone: ZoneType.Residential,
      density: ZoneDensity.Dense,
      x0: 10,
      y0: 10,
      x1: 12,
      y1: 12,
    });
    const list = codes(e, 11, 11);
    expect(list.slice(0, 2)).toEqual(['NO_ROAD', 'NO_POWER']);
    expect(list).toContain('NO_WATER_FOR_LEVEL');
    expect(list).not.toContain('GROWING');
  });

  it('explains a split road network as missing job access', () => {
    const e = flatCity('diag', 64);
    buildCorridor(e, { gap: true });
    e.runMonths(2);
    expect(codes(e, 10, 18)[0]).toBe('NO_JOB_ACCESS');
    expect(codes(e, 30, 22)[0]).toBe('NO_WORKERS');
  });

  it('says a healthy connected tile can grow', () => {
    const e = flatCity('diag', 64);
    buildCorridor(e);
    e.runMonths(3);
    expect(codes(e, 10, 18)).toContain('GROWING');
  });

  it('flags high taxes and an unpowered service building', () => {
    const e = flatCity('diag', 32);
    e.execute({ type: 'setTax', zone: 'industrial', rate: 15 });
    e.execute({
      type: 'zone',
      zone: ZoneType.Industrial,
      density: ZoneDensity.Light,
      x0: 2,
      y0: 2,
      x1: 3,
      y1: 3,
    });
    expect(codes(e, 2, 2)).toContain('HIGH_TAXES');
    e.execute({ type: 'place', kind: 'school', x: 20, y: 20 });
    expect(codes(e, 20, 20)).toEqual(['NO_POWER']);
  });
});

describe('diagnoseTile neon hints', () => {
  it('reports the neon-only problems when the context supplies them', () => {
    const e = flatCity('diag-neon', 48);
    e.execute({ type: 'road', x0: 2, y0: 10, x1: 20, y1: 10 });
    const s = e.stats();
    const problems = diagnoseTile(
      {
        world: e.world,
        building: (id) => e.buildings.get(id),
        demand: s.demand,
        taxes: s.taxes,
        power: s.power,
        oasis: { parched: true, owner: '#2', hacked: true, unguarded: true, drones: true },
      },
      5,
      9,
    ).map((p) => p.code);
    expect(problems).toContain('WATER_STRESS');
    expect(problems).toContain('CARAVAN_LOT');
    expect(problems).toContain('BURIED');
    expect(problems).toContain('NO_WINDBREAK');
  });

  it('keeps the classic diagnosis free of neon codes', () => {
    const e = flatCity('diag-classic', 48);
    const s = e.stats();
    const problems = diagnoseTile(
      {
        world: e.world,
        building: (id) => e.buildings.get(id),
        demand: s.demand,
        taxes: s.taxes,
        power: s.power,
      },
      5,
      9,
    ).map((p) => p.code);
    for (const code of ['WATER_STRESS', 'CARAVAN_LOT', 'BURIED', 'NO_WINDBREAK', 'ARCADE'])
      expect(problems).not.toContain(code);
  });
});
