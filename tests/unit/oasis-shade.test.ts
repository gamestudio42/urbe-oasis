import {
  Infra,
  OASIS_SHADE,
  PLACEABLE_SPECS,
  ZoneDensity,
  ZoneType,
  type BuildingRecord,
} from '@city/shared';
import {
  SIM_PRESETS,
  SimulationEngine,
  createEngine,
  shadeSupply,
  flatCity,
  hashState,
  maxLevel,
  oasisShade,
  oasisMaxLevel,
  powerDemand,
} from '@city/simulation';
import { describe, expect, it } from 'vitest';

/** A small flat Oasis city. Power comes from a wind turbine placed per test. */
function city(seed = 'neon-data'): SimulationEngine {
  const e = createEngine({
    seed,
    size: 24,
    ruleset: 'oasis',
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    funds: 100_000,
  });
  e.disastersEnabled = false;
  return e;
}

/** A commercial lot with no data flag, so the solver is what sets `linked`. */
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

/** Wind turbine plus the palm on its east side. */
function feed(e: SimulationEngine, x: number, y: number): void {
  expect(e.execute({ type: 'place', kind: 'windTurbine', x, y }).ok).toBe(true);
  expect(e.execute({ type: 'place', kind: 'palm', x: x + 1, y }).ok).toBe(true);
}

describe('Oasis data network', () => {
  it('keeps the published costs and the level-5 demand table', () => {
    expect(PLACEABLE_SPECS.springHouse.cost).toBe(OASIS_SHADE.springCost);
    expect(PLACEABLE_SPECS.springHouse.upkeep).toBe(OASIS_SHADE.springUpkeep);
    expect(PLACEABLE_SPECS.springHouse.powerUse).toBe(OASIS_SHADE.springPowerUse);
    expect(PLACEABLE_SPECS.springHouse.jobs).toBe(OASIS_SHADE.springJobs);
    expect(PLACEABLE_SPECS.palm.cost).toBe(OASIS_SHADE.palmCost);
    expect(oasisShade('residential', 5)).toBe(14);
    expect(oasisShade('commercial', 5)).toBe(48);
    expect(oasisShade('industrial', 5)).toBe(24);
    // 48 * 1.4^2 = 94.08, rounded. One palm (80) cannot feed a level-7 shop.
    expect(oasisShade('commercial', 7)).toBe(94);
  });

  it('caps a Oasis lot at level 2 without data and leaves the classic cap alone', () => {
    expect(oasisMaxLevel(ZoneDensity.Dense, true, true, 5, false)).toBe(2);
    expect(oasisMaxLevel(ZoneDensity.Dense, true, true, 5, true)).toBe(5);
    expect(oasisMaxLevel(ZoneDensity.Light, true, true, 3, false)).toBe(2);
    expect(maxLevel(ZoneDensity.Dense, true, true, false)).toBe(2);
    expect(maxLevel(ZoneDensity.Dense, true, false, false)).toBe(5);
  });

  it('links a block through canal and drops it when the cable is cut', () => {
    const e = city();
    feed(e, 2, 5);
    expect(e.execute({ type: 'canal', x0: 4, y0: 5, x1: 8, y1: 5 }).ok).toBe(true);
    const block = shop(e, 8, 5, 1);
    e.execute({
      type: 'zone',
      zone: ZoneType.Commercial,
      density: ZoneDensity.Dense,
      x0: 9,
      y0: 5,
      x1: 9,
      y1: 5,
    });
    e.refreshUtilities();
    expect(block.linked).toBe(true);
    expect(e.world.linked[e.world.index(9, 5)]).toBe(1);
    expect(e.world.linked[e.world.index(10, 5)]).toBe(0);

    expect(
      e.execute({ type: 'demolish', underground: true, x0: 6, y0: 5, x1: 6, y1: 5 }).ok,
    ).toBe(true);
    expect(e.world.hasInfra(e.world.index(6, 5), Infra.Canal)).toBe(false);
    e.refreshUtilities();
    expect(block.linked).toBe(false);
    expect(e.world.linked[e.world.index(8, 5)]).toBe(0);
    expect(e.world.linked[e.world.index(9, 5)]).toBe(0);
  });

  it('lets one road tile pass the link and stops at two', () => {
    const e = city();
    feed(e, 2, 8);
    e.execute({ type: 'road', x0: 6, y0: 8, x1: 6, y1: 8 });
    e.execute({ type: 'canal', x0: 4, y0: 8, x1: 5, y1: 8 });
    e.execute({ type: 'canal', x0: 7, y0: 8, x1: 8, y1: 8 });
    const across = shop(e, 8, 8, 1);
    e.refreshUtilities();
    expect(across.linked).toBe(true);

    feed(e, 2, 12);
    e.execute({ type: 'road', x0: 6, y0: 12, x1: 7, y1: 12 });
    e.execute({ type: 'canal', x0: 4, y0: 12, x1: 5, y1: 12 });
    e.execute({ type: 'canal', x0: 8, y0: 12, x1: 9, y1: 12 });
    const blocked = shop(e, 9, 12, 1);
    e.refreshUtilities();
    expect(blocked.linked).not.toBe(true);
    expect(e.world.linked[e.world.index(9, 12)]).toBe(0);
  });

  it('drops springHouse supply without power and without water', () => {
    const dry = city('dry-hall');
    expect(dry.execute({ type: 'place', kind: 'springHouse', x: 5, y: 4 }).ok).toBe(true);
    dry.refreshUtilities();
    const unpowered = dry.buildings.ofKind('springHouse')[0];
    expect(unpowered).toBeDefined();
    expect(shadeSupply(unpowered!)).toBe(0);
    expect(dry.stats().oasis?.data.supply).toBe(0);

    const cooled = city('cooled-hall');
    expect(cooled.execute({ type: 'place', kind: 'windTurbine', x: 4, y: 4 }).ok).toBe(true);
    expect(cooled.execute({ type: 'place', kind: 'springHouse', x: 5, y: 4 }).ok).toBe(true);
    cooled.refreshUtilities();
    const house = cooled.buildings.ofKind('springHouse')[0];
    expect(house?.powered).toBe(true);
    expect(house?.watered).toBe(false);
    expect(cooled.stats().oasis?.data.supply).toBe(OASIS_SHADE.springSupplyDry);

    // The house is 2×2 at (5,4), so a well on its south edge waters it.
    expect(cooled.execute({ type: 'place', kind: 'well', x: 5, y: 6 }).ok).toBe(true);
    cooled.refreshUtilities();
    expect(cooled.buildings.ofKind('springHouse')[0]?.watered).toBe(true);
    expect(cooled.stats().oasis?.data.supply).toBe(OASIS_SHADE.springSupply);
  });

  it('refuses a level-7 shop on a single palm', () => {
    const e = city('tower');
    feed(e, 2, 4);
    e.execute({ type: 'canal', x0: 4, y0: 4, x1: 6, y1: 4 });
    const tower = shop(e, 6, 4, 7);
    e.refreshUtilities();
    expect(oasisShade('commercial', 7)).toBeGreaterThan(OASIS_SHADE.palmSupply);
    expect(tower.linked).not.toBe(true);
    expect(e.world.linked[e.world.index(6, 4)]).toBe(0);
    expect(e.stats().oasis?.data.supply).toBe(OASIS_SHADE.palmSupply);
    expect(e.stats().oasis?.data.served).toBe(0);
  });

  it('serves the nearer shop when shade is short', () => {
    const e = city('nearest');
    feed(e, 2, 4);
    e.execute({ type: 'canal', x0: 4, y0: 4, x1: 12, y1: 4 });
    const near = shop(e, 6, 4, 5);
    const far = shop(e, 11, 4, 5);
    e.refreshUtilities();
    expect(near.linked).toBe(true);
    expect(far.linked).not.toBe(true);
    expect(e.world.linked[e.world.index(6, 4)]).toBe(1);
    expect(e.world.linked[e.world.index(11, 4)]).toBe(0);
    expect(e.stats().oasis?.data.demand).toBe(96);
    expect(e.stats().oasis?.data.served).toBe(0.5);
  });

  it('rejects canal in a classic city and omits the link layer', () => {
    const e = flatCity('classic-canal', 16);
    const placed = e.execute({ type: 'place', kind: 'park', x: 2, y: 2 });
    expect(placed.ok).toBe(true);
    const canal = e.execute({ type: 'canal', x0: 1, y0: 1, x1: 4, y1: 1 });
    expect(canal.ok).toBe(false);
    expect(e.world.hasInfra(e.world.index(2, 1), Infra.Canal)).toBe(false);
    const snap = e.serialize();
    expect(snap.layers.linked).toBeUndefined();
    expect(snap.ruleset).toBe('classic');
    for (const b of snap.buildings) expect('linked' in b).toBe(false);
    expect(e.stats().oasis).toBeUndefined();
  });

  it('gives the Oasis preset two cooled springHouses on the canal spine', () => {
    const { engine } = SIM_PRESETS['oasis-balanced']!.create('preset-data', 64);
    engine.refreshUtilities();
    const houses = engine.buildings.ofKind('springHouse');
    expect(houses).toHaveLength(2);
    const north = houses.find((house) => house.x === 46 && house.y === 14);
    const south = houses.find((house) => house.x === 47 && house.y === 22);
    expect(north).toBeDefined();
    expect(south).toBeDefined();
    for (const house of houses) {
      expect(house.powered).toBe(true);
      expect(house.watered).toBe(true);
      expect(house.linked).toBe(true);
    }
    expect(engine.stats().oasis?.data.supply).toBe(2 * OASIS_SHADE.springSupply);
    let canals = 0;
    for (let i = 0; i < engine.world.tileCount; i++) {
      if (engine.world.hasInfra(i, Infra.Canal)) canals++;
    }
    expect(canals).toBeGreaterThan(40);
  });

  it('darkens the far shop when one of two houses goes offline', () => {
    const e = city('two-halls');
    expect(e.execute({ type: 'place', kind: 'windTurbine', x: 2, y: 2 }).ok).toBe(true);
    // South first, so a search with both online starts at the south house.
    expect(e.execute({ type: 'place', kind: 'springHouse', x: 3, y: 14 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'springHouse', x: 3, y: 2 }).ok).toBe(true);
    expect(e.execute({ type: 'powerLine', x0: 3, y0: 4, x1: 3, y1: 13 }).ok).toBe(true);
    expect(e.execute({ type: 'canal', x0: 5, y0: 2, x1: 8, y1: 2 }).ok).toBe(true);
    expect(e.execute({ type: 'canal', x0: 6, y0: 2, x1: 6, y1: 14 }).ok).toBe(true);
    expect(e.execute({ type: 'canal', x0: 5, y0: 14, x1: 8, y1: 14 }).ok).toBe(true);
    const northShop = shop(e, 8, 2, 7);
    const southShop = shop(e, 8, 14, 7);
    const demand = oasisShade('commercial', 7) * 2;
    expect(demand).toBeGreaterThan(OASIS_SHADE.springSupplyDry);
    expect(demand).toBeLessThanOrEqual(OASIS_SHADE.springSupplyDry * 2);

    e.refreshUtilities();
    expect(e.stats().oasis?.data.supply).toBe(OASIS_SHADE.springSupplyDry * 2);
    expect(northShop.linked).toBe(true);
    expect(southShop.linked).toBe(true);

    const south = e.buildings.ofKind('springHouse').find((house) => house.y === 14);
    const north = e.buildings.ofKind('springHouse').find((house) => house.y === 2);
    expect(south).toBeDefined();
    expect(north).toBeDefined();

    south!.offline = 60;
    e.refreshUtilities();
    expect(shadeSupply(south!)).toBe(0);
    expect(northShop.linked).toBe(true);
    expect(southShop.linked).not.toBe(true);

    south!.offline = 0;
    north!.offline = 60;
    e.refreshUtilities();
    expect(southShop.linked).toBe(true);
    expect(northShop.linked).not.toBe(true);
  });

  it('waters a shop on a pipe and leaves it unlinked without canal', () => {
    const e = city('pipe-only');
    expect(e.execute({ type: 'place', kind: 'windTurbine', x: 2, y: 5 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'well', x: 3, y: 5 }).ok).toBe(true);
    expect(e.execute({ type: 'pipe', x0: 4, y0: 5, x1: 8, y1: 5 }).ok).toBe(true);
    const block = shop(e, 8, 5, 1);
    e.refreshUtilities();
    expect(block.watered).toBe(true);
    expect(block.linked).not.toBe(true);
  });

  it('links a dry house at the dry supply', () => {
    const e = city('canal-dry');
    expect(e.execute({ type: 'place', kind: 'windTurbine', x: 2, y: 4 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'springHouse', x: 3, y: 4 }).ok).toBe(true);
    expect(e.execute({ type: 'canal', x0: 5, y0: 4, x1: 8, y1: 4 }).ok).toBe(true);
    const block = shop(e, 8, 4, 1);
    e.refreshUtilities();
    const house = e.buildings.ofKind('springHouse')[0];
    expect(house?.powered).toBe(true);
    expect(house?.watered).toBe(false);
    expect(house?.linked).toBe(true);
    expect(e.stats().oasis?.data.supply).toBe(OASIS_SHADE.springSupplyDry);
    expect(block.linked).toBe(true);
    expect(block.watered).toBe(false);
  });

  it('isolates a shop across one empty tile and links it when canal crosses', () => {
    const e = city('gap');
    feed(e, 2, 5);
    expect(e.execute({ type: 'canal', x0: 4, y0: 5, x1: 6, y1: 5 }).ok).toBe(true);
    const block = shop(e, 8, 5, 1);
    e.refreshUtilities();
    expect(block.linked).not.toBe(true);
    expect(e.execute({ type: 'canal', x0: 7, y0: 5, x1: 7, y1: 5 }).ok).toBe(true);
    e.refreshUtilities();
    expect(block.linked).toBe(true);
  });

  it('keeps a buried spring house on the power bill with no shade', () => {
    const e = city('muted-hall');
    expect(e.execute({ type: 'place', kind: 'windTurbine', x: 2, y: 4 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'springHouse', x: 3, y: 4 }).ok).toBe(true);
    e.refreshUtilities();
    const house = e.buildings.ofKind('springHouse')[0];
    expect(house).toBeDefined();
    house!.offline = 60;
    e.refreshUtilities();
    expect(shadeSupply(house!)).toBe(0);
    expect(e.stats().oasis?.data.supply).toBe(0);
    expect(powerDemand(house!)).toBe(OASIS_SHADE.springPowerUse);
    expect(e.stats().power.demand).toBe(OASIS_SHADE.springPowerUse);
  });

  it('hashes the same city twice and round-trips the link layer', () => {
    const script = (seed: string) => {
      const e = city(seed);
      feed(e, 2, 3);
      e.execute({ type: 'canal', x0: 4, y0: 3, x1: 8, y1: 3 });
      shop(e, 8, 3, 1);
      e.refreshUtilities();
      return e;
    };
    const a = script('same-data');
    const b = script('same-data');
    expect(hashState(a)).toBe(hashState(b));

    const snap = a.serialize();
    expect(snap.layers.linked).toBeDefined();
    const restored = SimulationEngine.fromSnapshot(snap);
    expect(hashState(restored)).toBe(hashState(a));
    expect(restored.world.linked[restored.world.index(8, 3)]).toBe(1);

    const stale = a.serialize();
    delete stale.layers.linked;
    stale.networksDirty = false;
    const loaded = SimulationEngine.fromSnapshot(stale);
    expect(loaded.networksDirty).toBe(true);
    expect(loaded.world.linked[loaded.world.index(8, 3)]).toBe(0);
  });
});
