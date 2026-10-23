import { BALANCE, Infra, PLACEABLE_SPECS, RejectReason, ZoneDensity, ZoneType } from '@city/shared';
import { Connection, connectionMask, createEngine, hashState, lPath } from '@city/simulation';
import { describe, expect, it } from 'vitest';
import {
  addHill,
  addWater,
  flatEngine,
  seedResidents,
  slopeConstraintHolds,
} from '../helpers/engine';

describe('lPath', () => {
  it('walks the longer axis first', () => {
    expect(lPath({ x0: 0, y0: 0, x1: 3, y1: 1 })).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [3, 1],
    ]);
    expect(lPath({ x0: 2, y0: 3, x1: 1, y1: 0 })).toEqual([
      [2, 3],
      [2, 2],
      [2, 1],
      [2, 0],
      [1, 0],
    ]);
    expect(lPath({ x0: 5, y0: 5, x1: 5, y1: 5 })).toEqual([[5, 5]]);
  });
});

describe('road tool', () => {
  it('builds roads, charges the cost and clears trees', () => {
    const e = flatEngine();
    const w = e.world;
    w.trees[w.index(2, 1)] = 2;
    const result = e.execute({ type: 'road', x0: 1, y0: 1, x1: 5, y1: 1 });
    expect(result.ok).toBe(true);
    expect(result.applied).toBe(5);
    expect(result.cost).toBe(5 * BALANCE.costs.road + BALANCE.costs.clearTrees);
    expect(e.economy.funds).toBe(BALANCE.startingFunds - result.cost);
    expect(w.hasInfra(w.index(3, 1), Infra.Road)).toBe(true);
    expect(w.trees[w.index(2, 1)]).toBe(0);
  });

  it('auto-tiles roads from orthogonal neighbours', () => {
    const e = flatEngine();
    e.execute({ type: 'road', x0: 2, y0: 5, x1: 8, y1: 5 });
    e.execute({ type: 'road', x0: 5, y0: 2, x1: 5, y1: 8 });
    const w = e.world;
    expect(connectionMask(w, 5, 5, Infra.Road)).toBe(
      Connection.North | Connection.East | Connection.South | Connection.West,
    );
    expect(connectionMask(w, 3, 5, Infra.Road)).toBe(Connection.East | Connection.West);
    expect(connectionMask(w, 2, 5, Infra.Road)).toBe(Connection.East);
    expect(connectionMask(w, 5, 2, Infra.Road)).toBe(Connection.South);
    expect(connectionMask(w, 0, 0, Infra.Road)).toBe(0);
  });

  it('builds bridges over water at a higher cost', () => {
    const e = flatEngine();
    addWater(e, 3, 0, 4, 10);
    const result = e.execute({ type: 'road', x0: 1, y0: 2, x1: 6, y1: 2 });
    expect(result.ok).toBe(true);
    expect(result.cost).toBe(4 * BALANCE.costs.road + 2 * BALANCE.costs.bridge);
  });

  it('skips steep tiles and reports the slope', () => {
    const e = flatEngine();
    addHill(e, 10, 10, 6);
    const result = e.execute({ type: 'road', x0: 2, y0: 9, x1: 18, y1: 9 });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBeGreaterThan(0);
    expect(result.reason).toBe(RejectReason.Slope);
  });

  it('does not charge existing roads and reports already built when nothing is new', () => {
    const e = flatEngine();
    e.execute({ type: 'road', x0: 0, y0: 0, x1: 4, y1: 0 });
    const funds = e.economy.funds;
    const again = e.execute({ type: 'road', x0: 0, y0: 0, x1: 4, y1: 0 });
    expect(again.ok).toBe(false);
    expect(again.reason).toBe(RejectReason.AlreadyBuilt);
    expect(e.economy.funds).toBe(funds);
  });

  it('refuses the whole command when funds are insufficient and never goes negative', () => {
    const e = flatEngine();
    e.economy.funds = 25;
    const result = e.execute({ type: 'road', x0: 0, y0: 0, x1: 9, y1: 0 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(RejectReason.InsufficientFunds);
    expect(e.economy.funds).toBe(25);
    expect(e.world.hasInfra(0, Infra.Road)).toBe(false);
  });

  it('refuses construction in a bankrupt city', () => {
    const e = flatEngine();
    e.economy.bankrupt = true;
    expect(e.execute({ type: 'road', x0: 0, y0: 0, x1: 2, y1: 0 }).reason).toBe(
      RejectReason.Bankrupt,
    );
  });

  it('reports out of bounds drags', () => {
    const e = flatEngine(16);
    expect(e.execute({ type: 'road', x0: 20, y0: 20, x1: 25, y1: 20 }).reason).toBe(
      RejectReason.OutOfBounds,
    );
  });
});

describe('power lines and pipes', () => {
  it('shares tiles with roads and crosses water', () => {
    const e = flatEngine();
    addWater(e, 5, 0, 5, 31);
    e.execute({ type: 'road', x0: 0, y0: 3, x1: 4, y1: 3 });
    const result = e.execute({ type: 'powerLine', x0: 0, y0: 3, x1: 8, y1: 3 });
    expect(result.ok).toBe(true);
    expect(result.cost).toBe(8 * BALANCE.costs.powerLine + BALANCE.costs.powerLineOverWater);
    const i = e.world.index(2, 3);
    expect(e.world.hasInfra(i, Infra.Road | Infra.PowerLine)).toBe(true);
    expect(e.world.infra[i]).toBe(Infra.Road | Infra.PowerLine);
  });

  it('treats zones and buildings as conductors', () => {
    const e = flatEngine();
    e.execute({
      type: 'zone',
      zone: ZoneType.Residential,
      density: ZoneDensity.Light,
      x0: 2,
      y0: 0,
      x1: 3,
      y1: 0,
    });
    const result = e.execute({ type: 'powerLine', x0: 0, y0: 0, x1: 5, y1: 0 });
    expect(result.applied).toBe(4);
    expect(result.skipped).toBe(2);
  });

  it('lays pipes underground anywhere, independent of the surface', () => {
    const e = flatEngine();
    e.execute({ type: 'road', x0: 0, y0: 0, x1: 5, y1: 0 });
    const result = e.execute({ type: 'pipe', x0: 0, y0: 0, x1: 5, y1: 0 });
    expect(result.ok).toBe(true);
    expect(e.world.infra[2]).toBe(Infra.Road | Infra.Pipe);
  });
});

describe('zone tool', () => {
  it('zones flat land and skips water and roads', () => {
    const e = flatEngine();
    addWater(e, 4, 0, 4, 31);
    e.execute({ type: 'road', x0: 0, y0: 1, x1: 3, y1: 1 });
    const result = e.execute({
      type: 'zone',
      zone: ZoneType.Industrial,
      density: ZoneDensity.Dense,
      x0: 0,
      y0: 0,
      x1: 4,
      y1: 2,
    });
    // 15 tiles: 3 water, 4 road.
    expect(result.applied).toBe(8);
    expect(result.skipped).toBe(7);
    expect(result.cost).toBe(8 * BALANCE.costs.zoneDense);
    expect(e.world.zone[0]).toBe(ZoneType.Industrial);
    expect(e.world.zoneDensity[0]).toBe(ZoneDensity.Dense);
  });

  it('rejects sloped tiles', () => {
    const e = flatEngine();
    addHill(e, 10, 10, 3);
    const result = e.execute({
      type: 'zone',
      zone: ZoneType.Residential,
      density: ZoneDensity.Light,
      x0: 9,
      y0: 9,
      x1: 10,
      y1: 10,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(RejectReason.Slope);
  });

  it('re-zones and de-zones empty tiles', () => {
    const e = flatEngine();
    e.execute({
      type: 'zone',
      zone: ZoneType.Residential,
      density: ZoneDensity.Light,
      x0: 0,
      y0: 0,
      x1: 1,
      y1: 0,
    });
    expect(
      e.execute({
        type: 'zone',
        zone: ZoneType.Commercial,
        density: ZoneDensity.Light,
        x0: 0,
        y0: 0,
        x1: 0,
        y1: 0,
      }).ok,
    ).toBe(true);
    expect(e.world.zone[0]).toBe(ZoneType.Commercial);
    expect(
      e.execute({
        type: 'zone',
        zone: ZoneType.None,
        density: ZoneDensity.None,
        x0: 0,
        y0: 0,
        x1: 1,
        y1: 0,
      }).applied,
    ).toBe(2);
    expect(e.world.zone[1]).toBe(ZoneType.None);
  });
});

describe('placing buildings', () => {
  it('places a building on a flat footprint and stamps the building id', () => {
    const e = flatEngine();
    const result = e.execute({ type: 'place', kind: 'coalPlant', x: 4, y: 4 });
    expect(result.ok).toBe(true);
    expect(result.cost).toBe(PLACEABLE_SPECS.coalPlant.cost);
    const id = e.world.buildingId[e.world.index(6, 6)] as number;
    expect(id).toBeGreaterThan(0);
    expect(e.buildings.get(id)?.kind).toBe('coalPlant');
    expect(e.world.buildingId[e.world.index(7, 6)]).toBe(0);
  });

  it('refuses invalid footprints as a whole', () => {
    const e = flatEngine();
    addHill(e, 10, 10, 2);
    expect(e.execute({ type: 'place', kind: 'school', x: 9, y: 9 }).reason).toBe(
      RejectReason.NotFlatFootprint,
    );
    addWater(e, 0, 0, 0, 0);
    expect(e.execute({ type: 'place', kind: 'park', x: 0, y: 0 }).reason).toBe(RejectReason.Water);
    expect(e.execute({ type: 'place', kind: 'coalPlant', x: 30, y: 30 }).reason).toBe(
      RejectReason.OutOfBounds,
    );
    e.execute({ type: 'road', x0: 20, y0: 20, x1: 20, y1: 20 });
    expect(e.execute({ type: 'place', kind: 'hospital', x: 19, y: 19 }).reason).toBe(
      RejectReason.Occupied,
    );
    expect(e.buildings.size).toBe(0);
  });
});

describe('demolish tool', () => {
  it('removes a whole building from any of its tiles', () => {
    const e = flatEngine();
    e.execute({ type: 'place', kind: 'coalPlant', x: 4, y: 4 });
    const result = e.execute({ type: 'demolish', x0: 6, y0: 6, x1: 6, y1: 6 });
    expect(result.ok).toBe(true);
    expect(result.applied).toBe(9);
    expect(e.buildings.size).toBe(0);
    expect(e.world.buildingId[e.world.index(4, 4)]).toBe(0);
  });

  it('peels one layer per tile: surface, zone, trees; pipes only underground', () => {
    const e = flatEngine();
    const w = e.world;
    e.execute({ type: 'road', x0: 0, y0: 0, x1: 0, y1: 0 });
    e.execute({
      type: 'zone',
      zone: ZoneType.Residential,
      density: ZoneDensity.Light,
      x0: 1,
      y0: 0,
      x1: 1,
      y1: 0,
    });
    w.trees[2] = 3;
    e.execute({ type: 'pipe', x0: 0, y0: 0, x1: 3, y1: 0 });
    expect(e.execute({ type: 'demolish', x0: 0, y0: 0, x1: 3, y1: 0 }).applied).toBe(3);
    expect(w.infra[0]).toBe(Infra.Pipe);
    expect(w.zone[1]).toBe(ZoneType.None);
    expect(w.trees[2]).toBe(0);
    expect(
      e.execute({ type: 'demolish', underground: true, x0: 0, y0: 0, x1: 3, y1: 0 }).applied,
    ).toBe(4);
    expect(w.infra[0]).toBe(0);
  });

  it('cannot demolish burning tiles', () => {
    const e = flatEngine();
    e.execute({ type: 'road', x0: 0, y0: 0, x1: 0, y1: 0 });
    e.world.fire[0] = 50;
    expect(e.execute({ type: 'demolish', x0: 0, y0: 0, x1: 0, y1: 0 }).reason).toBe(
      RejectReason.OnFire,
    );
  });
});

describe('level tool', () => {
  it('flattens to the start tile height and keeps the slope constraint', () => {
    const e = flatEngine();
    addHill(e, 16, 16, 6);
    const start = { x: 16, y: 16 };
    const target = e.world.elevation(start.x, start.y);
    const result = e.execute({
      type: 'level',
      x0: start.x,
      y0: start.y,
      x1: start.x + 3,
      y1: start.y + 3,
    });
    expect(result.ok).toBe(true);
    for (let y = 16; y <= 19; y++) {
      for (let x = 16; x <= 19; x++) {
        expect(e.world.isFlat(x, y)).toBe(true);
        expect(e.world.elevation(x, y)).toBe(target);
      }
    }
    expect(slopeConstraintHolds(e)).toBe(true);
    expect(result.cost % BALANCE.costs.levelPerUnit).toBe(0);
    expect(e.world.heightsDirty).toBe(true);
  });

  it('refuses when the change would affect construction', () => {
    const e = flatEngine();
    const w = e.world;
    for (let vy = 10; vy <= 20; vy++)
      for (let vx = 10; vx <= 20; vx++) w.heights[w.vertex(vx, vy)] = 1;
    expect(e.execute({ type: 'road', x0: 12, y0: 12, x1: 14, y1: 12 }).ok).toBe(true);
    const before = hashState(e);
    const result = e.execute({ type: 'level', x0: 5, y0: 5, x1: 12, y1: 12 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(RejectReason.LevelAffectsConstruction);
    expect(hashState(e)).toBe(before);
  });

  it('turns raised water tiles into land', () => {
    const e = flatEngine();
    addHill(e, 10, 10, 3);
    addWater(e, 14, 10, 16, 10);
    e.execute({ type: 'level', x0: 10, y0: 10, x1: 13, y1: 10 });
    expect(slopeConstraintHolds(e)).toBe(true);
    expect(e.world.isWater(e.world.index(14, 10))).toBe(false);
  });
});

describe('raise and lower tools', () => {
  it('raises a rectangle by one and keeps the slope constraint', () => {
    const e = flatEngine();
    const result = e.execute({ type: 'raise', x0: 8, y0: 8, x1: 10, y1: 10 });
    expect(result.ok).toBe(true);
    expect(e.world.elevation(9, 9)).toBe(1);
    expect(e.world.isFlat(9, 9)).toBe(true);
    expect(slopeConstraintHolds(e)).toBe(true);
    expect(result.cost).toBeGreaterThan(0);
    expect(result.cost % BALANCE.costs.levelPerUnit).toBe(0);
  });

  it('refuses when raising would affect a road', () => {
    const e = flatEngine();
    expect(e.execute({ type: 'road', x0: 8, y0: 8, x1: 10, y1: 8 }).ok).toBe(true);
    const before = hashState(e);
    const result = e.execute({ type: 'raise', x0: 8, y0: 8, x1: 10, y1: 8 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(RejectReason.LevelAffectsConstruction);
    expect(hashState(e)).toBe(before);
  });

  it('turns raised water tiles into land', () => {
    const e = flatEngine();
    addWater(e, 6, 6, 8, 6);
    expect(e.execute({ type: 'raise', x0: 6, y0: 6, x1: 8, y1: 6 }).ok).toBe(true);
    expect(e.world.isWater(e.world.index(7, 6))).toBe(false);
    expect(slopeConstraintHolds(e)).toBe(true);
  });

  it('does nothing when lowering already-flat land', () => {
    const e = flatEngine();
    const before = hashState(e);
    const result = e.execute({ type: 'lower', x0: 4, y0: 4, x1: 6, y1: 6 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(RejectReason.NothingToDo);
    expect(result.cost).toBe(0);
    expect(hashState(e)).toBe(before);
  });
});

describe('preview and replay', () => {
  it('previews without mutating the state and matches execution', () => {
    const e = flatEngine();
    const command = {
      type: 'zone',
      zone: ZoneType.Commercial,
      density: ZoneDensity.Light,
      x0: 0,
      y0: 0,
      x1: 3,
      y1: 3,
    } as const;
    const before = hashState(e);
    const preview = e.preview(command);
    expect(hashState(e)).toBe(before);
    const result = e.execute(command);
    expect(preview.ok).toBe(result.ok);
    expect(preview.cost).toBe(result.cost);
    expect(preview.valid.length).toBe(result.applied);
  });

  it('replays the command log to the same state', () => {
    const a = createEngine({ seed: 'replay', size: 48 });
    a.execute({ type: 'road', x0: 2, y0: 20, x1: 40, y1: 24 });
    a.execute({
      type: 'zone',
      zone: ZoneType.Residential,
      density: ZoneDensity.Light,
      x0: 2,
      y0: 21,
      x1: 12,
      y1: 23,
    });
    a.execute({ type: 'place', kind: 'park', x: 30, y: 30 });
    a.execute({ type: 'level', x0: 10, y0: 10, x1: 14, y1: 12 });
    a.execute({ type: 'setTax', zone: 'commercial', rate: 9 });
    a.execute({ type: 'demolish', x0: 5, y0: 20, x1: 8, y1: 20 });
    const b = createEngine({ seed: 'replay', size: 48 });
    for (const { command } of a.commandLog) b.execute(command);
    expect(hashState(b)).toBe(hashState(a));
  });
});

describe('marina and airport hubs', () => {
  it('refuses a marina while the city is too small, inland or without a road', () => {
    const e = flatEngine();
    e.execute({ type: 'road', x0: 10, y0: 10, x1: 16, y1: 10 });
    const locked = e.preview({ type: 'place', kind: 'marina', x: 12, y: 11 });
    expect(locked.reason).toBe(RejectReason.Locked);
    expect(locked.invalid).toHaveLength(9);
    seedResidents(e, 1000);
    expect(e.execute({ type: 'place', kind: 'marina', x: 12, y: 11 }).reason).toBe(
      RejectReason.NeedsWater,
    );
    addWater(e, 0, 0, 31, 0);
    expect(e.execute({ type: 'place', kind: 'marina', x: 2, y: 1 }).reason).toBe(
      RejectReason.NeedsRoad,
    );
    e.execute({ type: 'road', x0: 1, y0: 4, x1: 8, y1: 4 });
    expect(e.execute({ type: 'place', kind: 'marina', x: 2, y: 1 }).ok).toBe(true);
  });

  it('places a 4×4 airport on flat land with a road once unlocked', () => {
    const e = flatEngine();
    e.execute({ type: 'road', x0: 3, y0: 8, x1: 10, y1: 8 });
    expect(e.execute({ type: 'place', kind: 'airport', x: 4, y: 4 }).reason).toBe(
      RejectReason.Locked,
    );
    seedResidents(e, 2000);
    expect(e.execute({ type: 'place', kind: 'airport', x: 4, y: 4 }).ok).toBe(true);
    expect(e.buildings.ofKind('airport')[0]?.w).toBe(4);
  });

  it('refuses an airport that is not flat', () => {
    const e = flatEngine();
    addHill(e, 6, 6, 3);
    e.execute({ type: 'road', x0: 3, y0: 8, x1: 10, y1: 8 });
    seedResidents(e, 2000);
    expect(e.execute({ type: 'place', kind: 'airport', x: 4, y: 4 }).reason).toBe(
      RejectReason.NotFlatFootprint,
    );
  });
});

describe('policy commands', () => {
  it('clamps taxes and funding and renames the city', () => {
    const e = flatEngine();
    e.execute({ type: 'setTax', zone: 'residential', rate: 99 });
    expect(e.economy.taxes.residential).toBe(BALANCE.economy.taxMax);
    e.execute({ type: 'setFunding', department: 'police', value: -5 });
    expect(e.economy.funding.police).toBe(0);
    expect(e.execute({ type: 'rename', name: '   ' }).ok).toBe(false);
    e.execute({ type: 'rename', name: '  Vila Nova ' });
    expect(e.name).toBe('Vila Nova');
  });
});
