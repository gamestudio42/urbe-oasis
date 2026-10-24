import { Infra } from '@city/shared';
import { createEngine, hashState } from '@city/simulation';
import { oasis } from '../../packages/theme-oasis/src';
import { desertTone, drawDesertSurface } from '../../packages/view-city/src/desertSurface';
import { tileQuad } from '../../packages/view-city/src/iso';
import { expect, it } from 'vitest';

it('keeps broad desert tones continuous and bounded at patch boundaries', () => {
  for (let y = -8; y <= 64; y++)
    for (let x = -8; x <= 64; x++) {
      const tone = desertTone(x, y);
      expect(tone).toBeGreaterThanOrEqual(0.965);
      expect(tone).toBeLessThanOrEqual(1.035);
      expect(Math.abs(tone - desertTone(x + 1, y))).toBeLessThan(0.016);
      expect(Math.abs(tone - desertTone(x, y + 1))).toBeLessThan(0.016);
    }
});
it('decorates actual water margins without changing the world or covering construction', () => {
  const e = createEngine({
    seed: 'desert-surface',
    size: 32,
    ruleset: 'oasis',
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
  });
  e.world.terrain[e.world.index(5, 4)] = 0;
  const calls: unknown[] = [];
  const g: Record<string, (...args: unknown[]) => unknown> = {};
  for (const key of ['poly', 'fill', 'ellipse', 'moveTo', 'lineTo', 'stroke', 'quadraticCurveTo']) {
    g[key] = (...args) => {
      calls.push([key, ...args]);
      return g;
    };
  }
  const render = () =>
    drawDesertSurface(
      g as unknown as Parameters<typeof drawDesertSurface>[0],
      oasis,
      e.world,
      4,
      4,
      tileQuad(e.world, 4, 4),
    );
  const before = hashState(e);
  render();
  expect(calls.length).toBeGreaterThan(0);
  expect(hashState(e)).toBe(before);
  const initial = [...calls];
  calls.length = 0;
  render();
  expect(calls).toEqual(initial);
  for (const layer of ['road', 'zone', 'building'] as const) {
    e.world.infra[e.world.index(4, 4)] = layer === 'road' ? Infra.Road : 0;
    e.world.zone[e.world.index(4, 4)] = layer === 'zone' ? 1 : 0;
    e.world.buildingId[e.world.index(4, 4)] = layer === 'building' ? 1 : 0;
    calls.length = 0;
    render();
    expect(calls).toEqual([]);
  }
});
