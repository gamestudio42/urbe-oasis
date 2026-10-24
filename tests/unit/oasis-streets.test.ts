import { Infra, ZoneDensity } from '@city/shared';
import { hashState } from '@city/simulation';
import { describe, expect, it } from 'vitest';
import { oasis } from '../../packages/theme-oasis/src';
import { urbe } from '../../packages/theme-urbe/src';
import { drawGround, drawRoads, type DrawContext } from '../../packages/view-city/src/chunkDraw';
import {
  drawOasisParcel,
  drawOasisStreet,
  oasisRoadCells,
} from '../../packages/view-city/src/oasisStreets';
import { ROAD_INSET } from '../../packages/view-city/src/bridge';
import { lanePoint, reverse, type Dir } from '../../packages/view-city/src/animation/roads';
import { tileQuad } from '../../packages/view-city/src/iso';
import { ChunkGrid } from '../../packages/view-iso/src/chunks';
import { addWater, flatEngine } from '../helpers/engine';

function recorder() {
  const calls: unknown[][] = [];
  const g: Record<string, (...args: unknown[]) => unknown> = {};
  for (const name of [
    'poly',
    'fill',
    'stroke',
    'moveTo',
    'lineTo',
    'circle',
    'ellipse',
    'quadraticCurveTo',
  ])
    g[name] = (...args) => {
      calls.push([name, ...args]);
      return g;
    };
  return { calls, g: g as unknown as Parameters<typeof drawGround>[0] };
}

describe('oasis streets and parcels', () => {
  it('keeps every existing vehicle path inside the road surface for all 16 connections', () => {
    const cuts = [0, ROAD_INSET, 1 - ROAD_INSET, 1];
    for (let mask = 0; mask < 16; mask++) {
      const cells = oasisRoadCells(mask);
      for (let entry = 0; entry < 4; entry++)
        for (let exit = 0; exit < 4; exit++) {
          if (!(mask & (1 << entry)) || !(mask & (1 << exit))) continue;
          for (let step = 0; step <= 20; step++) {
            const p = lanePoint(reverse(entry as Dir), exit as Dir, step / 20);
            expect(
              cells.some(
                ({ col, row }) =>
                  p.u >= cuts[col]! &&
                  p.u <= cuts[col + 1]! &&
                  p.v >= cuts[row]! &&
                  p.v <= cuts[row + 1]!,
              ),
            ).toBe(true);
          }
        }
    }
  });

  it('paves urban edges but leaves exposed desert and canal crossings clear', () => {
    const e = flatEngine();
    const q = tileQuad(e.world, 4, 4),
      outline = q.flatMap((p) => [p.x, p.y]);
    e.world.setInfra(e.world.index(4, 4), Infra.Road, true);
    const draw = () => {
      const r = recorder();
      drawOasisStreet(r.g, oasis, e.world, 4, 4, q, 15, true);
      return r.calls;
    };
    expect(draw()).not.toContainEqual(['poly', outline]);
    e.world.zone[e.world.index(4, 3)] = 1;
    expect(draw()).toContainEqual(['poly', outline]);
    // A four-way junction has roads on every side, with parcels only at its corners.
    e.world.zone[e.world.index(4, 3)] = 0;
    e.world.zone[e.world.index(3, 3)] = 1;
    expect(draw()).toContainEqual(['poly', outline]);
    expect(draw().filter(([name]) => name === 'poly')).toHaveLength(22);
    e.world.setInfra(e.world.index(4, 4), Infra.Canal, true);
    expect(draw()).not.toContainEqual(['poly', outline]);
  });

  it('refreshes diagonal street chunks at all four parcel corners without changing classic invalidation', () => {
    const grid = new ChunkGrid();
    grid.rebuild(48, (area) => ({
      area,
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      dirty: false,
      overlayDirty: false,
    }));
    const clear = () => {
      for (const c of grid.chunks) c.dirty = c.overlayDirty = false;
    };
    for (const x of [16, 31])
      for (const y of [16, 31]) {
        clear();
        const diagonal = grid.chunkAt(x === 16 ? 15 : 32, y === 16 ? 15 : 32, 48)!;
        grid.invalidateTiles([y * 48 + x], 48);
        expect(diagonal.dirty).toBe(false);
        expect(grid.chunks.filter((c) => c.dirty)).toHaveLength(3);
        clear();
        grid.invalidateTiles([y * 48 + x], 48, true);
        expect(diagonal.dirty).toBe(true);
        expect(diagonal.overlayDirty).toBe(true);
        expect(grid.chunks.filter((c) => c.dirty)).toHaveLength(4);
      }
    clear();
    grid.invalidateTiles([20 * 48 + 20], 48, true);
    expect(grid.chunks.filter((c) => c.dirty)).toHaveLength(1);
    clear();
    grid.invalidateTiles([0], 48, true);
    expect(grid.chunks.filter((c) => c.dirty)).toHaveLength(1);
  });

  it('renders every connection deterministically without modifying terrain, infrastructure or RNG', () => {
    const e = flatEngine();
    e.world.zone[e.world.index(4, 3)] = 1;
    const before = hashState(e);
    for (let mask = 0; mask < 16; mask++) {
      const a = recorder(),
        b = recorder();
      const q = tileQuad(e.world, 4, 4);
      drawOasisStreet(a.g, oasis, e.world, 4, 4, q, mask, true);
      drawOasisStreet(b.g, oasis, e.world, 4, 4, q, mask, true);
      expect(a.calls).toEqual(b.calls);
      expect(a.calls.length).toBeLessThan(160);
    }
    expect(hashState(e)).toBe(before);
  });

  it('merges quiet parcel borders and restores density markings while planning', () => {
    const e = flatEngine();
    for (let y = 3; y <= 5; y++)
      for (let x = 3; x <= 5; x++) {
        const i = e.world.index(x, y);
        e.world.zone[i] = 1;
        e.world.zoneDensity[i] = ZoneDensity.Dense;
      }
    const before = hashState(e),
      q = tileQuad(e.world, 4, 4);
    const quiet = recorder(),
      planning = recorder();
    drawOasisParcel(quiet.g, oasis, e.world, 4, 4, q, false);
    drawOasisParcel(planning.g, oasis, e.world, 4, 4, q, true);
    expect(quiet.calls.filter(([name]) => name === 'stroke')).toHaveLength(0);
    expect(quiet.calls.filter(([name]) => name === 'circle')).toHaveLength(2);
    expect(planning.calls.filter(([name]) => name === 'stroke')).toHaveLength(8);
    expect(hashState(e)).toBe(before);
  });

  it('preserves classic ground rendering and the existing raised bridge geometry', () => {
    const e = flatEngine();
    const area = { x0: 4, y0: 4, x1: 5, y1: 5 };
    const ctx: DrawContext = {
      world: e.world,
      buildings: new Map(),
      grid: false,
      underground: false,
      overlay: 'none',
      animationFrame: 0,
    };
    e.world.zone[e.world.index(4, 4)] = 1;
    const a = recorder(),
      b = recorder();
    drawGround(a.g, urbe, { ...ctx, planning: false }, area);
    drawGround(b.g, urbe, { ...ctx, planning: true }, area);
    expect(a.calls).toEqual(b.calls);
    addWater(e, 4, 4, 4, 4);
    for (let x = 3; x <= 5; x++) e.world.setInfra(e.world.index(x, 4), Infra.Road, true);
    const bridge = recorder(),
      urbanBridge = recorder();
    drawRoads(bridge.g, oasis, ctx, area);
    e.world.zone[e.world.index(4, 3)] = 2;
    drawRoads(urbanBridge.g, oasis, ctx, area);
    expect(bridge.calls).toEqual(urbanBridge.calls);
  });
});
