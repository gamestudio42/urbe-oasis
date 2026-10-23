import { Infra } from '@city/shared';
import { describe, expect, it } from 'vitest';
import {
  BRIDGE_DECK,
  BRIDGE_INSET,
  isBridgeTile,
  isLandRoad,
  roadSurfaceLift,
} from '../../packages/view-city/src/bridge';
import { addWater, flatEngine } from '../helpers/engine';

function road(world: ReturnType<typeof flatEngine>['world'], x: number, y: number): void {
  world.setInfra(world.index(x, y), Infra.Road, true);
}

describe('bridge deck lift', () => {
  it('keeps land roads on the ground and raises a mid-span tile', () => {
    const e = flatEngine(12);
    addWater(e, 4, 5, 8, 5);
    for (let x = 2; x <= 10; x++) road(e.world, x, 5);
    expect(isLandRoad(e.world, 2, 5)).toBe(true);
    expect(isBridgeTile(e.world, 6, 5)).toBe(true);
    expect(roadSurfaceLift(e.world, 2, 5, 0.5, 0.5)).toBe(0);
    expect(roadSurfaceLift(e.world, 6, 5, 0.5, 0.5)).toBe(BRIDGE_DECK);
  });

  it('ramps down to the land road at the shore', () => {
    const e = flatEngine(12);
    addWater(e, 4, 5, 8, 5);
    for (let x = 2; x <= 10; x++) road(e.world, x, 5);
    // West edge of the first water tile meets land at x=3.
    expect(roadSurfaceLift(e.world, 4, 5, 0, 0.5)).toBe(0);
    expect(roadSurfaceLift(e.world, 4, 5, BRIDGE_INSET, 0.5)).toBe(BRIDGE_DECK);
    expect(roadSurfaceLift(e.world, 4, 5, BRIDGE_INSET / 2, 0.5)).toBeCloseTo(BRIDGE_DECK / 2, 5);
    expect(roadSurfaceLift(e.world, 4, 5, 0.5, 0.5)).toBe(BRIDGE_DECK);
  });
});
