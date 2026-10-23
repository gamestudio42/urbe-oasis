import { ZoneDensity, ZoneType } from '@city/shared';
import { flatCity, hashState, SimulationEngine, buildTown } from '@city/simulation';
import { describe, expect, it } from 'vitest';

function smallTown(power: boolean) {
  const e = flatCity('growth', 32);
  e.execute({ type: 'road', x0: 0, y0: 10, x1: 20, y1: 10 });
  e.execute({
    type: 'zone',
    zone: ZoneType.Residential,
    density: ZoneDensity.Light,
    x0: 2,
    y0: 7,
    x1: 18,
    y1: 9,
  });
  e.execute({
    type: 'zone',
    zone: ZoneType.Industrial,
    density: ZoneDensity.Light,
    x0: 2,
    y0: 11,
    x1: 18,
    y1: 12,
  });
  if (power) {
    e.execute({ type: 'place', kind: 'gasPlant', x: 22, y: 11 });
    e.execute({ type: 'powerLine', x0: 19, y0: 11, x1: 21, y1: 11 });
  }
  return e;
}

describe('zone growth', () => {
  it('develops powered zones with road access', () => {
    const e = smallTown(true);
    e.runMonths(12);
    const s = e.stats();
    expect(s.counts.residential).toBeGreaterThan(5);
    expect(s.counts.industrial).toBeGreaterThan(2);
    expect(s.population).toBeGreaterThan(30);
  });

  it('does not develop without power', () => {
    const e = smallTown(false);
    e.runMonths(12);
    expect(e.stats().counts.residential).toBe(0);
  });

  it('abandons buildings that lose power', () => {
    const e = smallTown(true);
    e.runMonths(12);
    const plant = e.buildings.ofKind('gasPlant')[0];
    expect(plant).toBeDefined();
    e.execute({ type: 'demolish', x0: plant!.x, y0: plant!.y, x1: plant!.x, y1: plant!.y });
    e.runMonths(14);
    const s = e.stats();
    expect(s.population).toBe(0);
    expect(s.counts.abandoned).toBeGreaterThan(0);
  });

  it('keeps light zones at level 2 at most', () => {
    const e = smallTown(true);
    e.runMonths(36);
    for (const b of e.buildings.values())
      if (b.kind === 'residential') expect(b.level).toBeLessThanOrEqual(2);
  });
});

describe('determinism', () => {
  it('produces the same state for the same seed and commands', () => {
    const a = flatCity('det', 64);
    const b = flatCity('det', 64);
    buildTown(a);
    buildTown(b);
    a.runMonths(24);
    b.runMonths(24);
    expect(hashState(a)).toBe(hashState(b));
  });

  it('continues identically after save and load mid-month', () => {
    const a = flatCity('save', 64);
    buildTown(a);
    a.runMonths(10);
    a.runTicks(37);
    const snapshot = JSON.parse(
      JSON.stringify(a.serialize(), (_k, v: unknown) =>
        v instanceof Uint8Array ? Array.from(v) : v,
      ),
    );
    for (const key of Object.keys(snapshot.layers))
      snapshot.layers[key] = Uint8Array.from(snapshot.layers[key]);
    snapshot.heights = Uint8Array.from(snapshot.heights);
    const b = SimulationEngine.fromSnapshot(snapshot);
    expect(hashState(b)).toBe(hashState(a));
    a.runMonths(14);
    b.runMonths(14);
    expect(hashState(b)).toBe(hashState(a));
  });

  it('replays the command log including commands issued between months', () => {
    const a = flatCity('replay', 64);
    buildTown(a);
    a.runMonths(6);
    a.execute({ type: 'setTax', zone: 'residential', rate: 10 });
    a.execute({
      type: 'zone',
      zone: ZoneType.Commercial,
      density: ZoneDensity.Light,
      x0: 41,
      y0: 21,
      x1: 43,
      y1: 23,
    });
    a.runMonths(6);
    const b = flatCity('replay', 64);
    let next = 0;
    while (b.tick < a.tick) {
      while (next < a.commandLog.length && (a.commandLog[next]?.tick ?? Infinity) === b.tick) {
        b.execute(a.commandLog[next]!.command);
        next++;
      }
      b.step();
    }
    expect(hashState(b)).toBe(hashState(a));
  });
});
