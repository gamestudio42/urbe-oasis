import { OASIS_CARAVAN, isZoneKind } from '@city/shared';
import {
  buildTown,
  createEngine,
  initCaravans,
  ownerOf,
  type SimulationEngine,
} from '@city/simulation';
import { describe, expect, it } from 'vitest';

/** A flat Oasis city with the standard grown town, so there are lots and services for the caravans. */
function corpTown(): SimulationEngine {
  const e = createEngine({
    seed: 'neon-corp',
    size: 64,
    ruleset: 'oasis',
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    funds: 400_000,
  });
  e.disastersEnabled = false;
  buildTown(e);
  const road = e.execute({ type: 'road', x0: 40, y0: 20, x1: 48, y1: 20 });
  const house = e.execute({ type: 'place', kind: 'caravanserai', x: 47, y: 21 });
  if (!road.ok || !house.ok) {
    throw new Error(`road ${road.reason ?? 'ok'} house ${house.reason ?? 'ok'}`);
  }
  return e;
}

describe('Oasis caravans', () => {
  it('founds exactly one set of caravans and never duplicates it', () => {
    const e = corpTown();
    expect(initCaravans(e)).toBe(OASIS_CARAVAN.count);
    expect(initCaravans(e)).toBe(0);
    expect(e.oasis.caravans).toHaveLength(OASIS_CARAVAN.count);
    expect(e.oasis.caravans.map((c) => c.quadrant)).toEqual([0, 1, 2, 3]);
  });

  it('gives every caravan house cash and a preferred quadrant', () => {
    const e = corpTown();
    initCaravans(e);
    for (const corp of e.oasis.caravans) {
      expect(corp.capital).toBe(OASIS_CARAVAN.startingCapital);
      expect(corp.quadrant).toBeGreaterThanOrEqual(0);
      expect(corp.quadrant).toBeLessThan(4);
      expect(corp.name.length).toBeGreaterThan(0);
    }
  });

  it('only takes over zoned land, never the city network', () => {
    const e = corpTown();
    e.runMonths(24);
    for (const b of e.buildings.values()) {
      if (b.owner === undefined) continue;
      expect(isZoneKind(b.kind)).toBe(true);
    }
  });

  it('only moves treasury cash when a purchase happens', () => {
    const e = corpTown();
    e.runMonths(24);
    const bought = e.oasis.caravans.reduce((sum, c) => sum + c.holdings, 0);
    if (bought === 0) expect(e.oasis.trade).toBe(0);
    else expect(e.oasis.trade).toBeGreaterThan(0);
  });

  it('spends corporate capital on every holding it reports', () => {
    const e = corpTown();
    e.runMonths(24);
    for (const corp of e.oasis.caravans) {
      expect(corp.capital).toBeLessThanOrEqual(OASIS_CARAVAN.startingCapital);
      if (corp.holdings > 0) expect(corp.capital).toBeLessThan(OASIS_CARAVAN.startingCapital);
    }
  });

  it('reports the owning caravan house by name', () => {
    const e = corpTown();
    e.runMonths(24);
    const owned = [...e.buildings.values()].find((b) => b.owner !== undefined);
    expect(owned).toBeDefined();
    if (!owned) return;
    const name = ownerOf(e, owned);
    expect(name).not.toBeNull();
    expect(e.oasis.caravans.map((c) => c.name)).toContain(name);
  });

  it('is deterministic for the same seed', () => {
    const a = corpTown();
    const b = corpTown();
    a.runMonths(18);
    b.runMonths(18);
    expect(a.oasis.caravans).toEqual(b.oasis.caravans);
    expect(a.oasis.trade).toBe(b.oasis.trade);
  });

  it('does not buy without an operating caravanserai', () => {
    const e = createEngine({
      seed: 'neon-corp',
      size: 64,
      ruleset: 'oasis',
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
      funds: 400_000,
    });
    e.disastersEnabled = false;
    buildTown(e);
    e.runMonths(24);
    expect(e.oasis.caravans).toHaveLength(OASIS_CARAVAN.count);
    expect(e.oasis.trade).toBe(0);
    expect([...e.buildings.values()].some((b) => b.owner !== undefined)).toBe(false);
  });

  it('leaves a classic city without caravans', () => {
    const e = createEngine({
      seed: 'classic-corp',
      size: 64,
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
      funds: 400_000,
    });
    e.disastersEnabled = false;
    buildTown(e);
    e.runMonths(18);
    expect(e.oasis.caravans).toHaveLength(0);
    expect(e.oasis.trade).toBe(0);
  });
});
