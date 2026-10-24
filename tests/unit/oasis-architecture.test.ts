import { describe, expect, it, vi } from 'vitest';
import { createEngine, hashState, tileVariant } from '@city/simulation';
import { oasis } from '../../packages/theme-oasis/src';
import { urbe } from '../../packages/theme-urbe/src';
import { neon } from '../../packages/theme-neon/src';
import { drawBuilding, SpriteFactory } from '../../packages/view-city/src/sprites';
import { adobeIndustrialVent, adobeVariant } from '../../packages/view-city/src/oasisArchitecture';
import { smokeVents } from '../../packages/view-city/src/animation/smoke';

function record() {
  const geometry: unknown[] = [];
  const fills: number[] = [];
  const g: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ['poly', 'rect', 'ellipse', 'moveTo', 'lineTo'])
    g[method] = (...args) => {
      geometry.push([method, args]);
      return g;
    };
  for (const method of ['fill', 'stroke'])
    g[method] = (arg) => {
      fills.push(typeof arg === 'number' ? arg : (arg as { color: number }).color);
      return g;
    };
  return { g: g as unknown as Parameters<typeof drawBuilding>[0], geometry, fills };
}

describe('oasis architecture', () => {
  it('uses all eight stable appearances without altering saves or engine RNG', () => {
    const engine = createEngine({ seed: 'architecture', size: 32, ruleset: 'oasis' });
    const before = hashState(engine);
    const styles = new Set<number>();
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const v = tileVariant(x, y);
        styles.add(adobeVariant(v, x, y));
        expect(adobeVariant(v, x, y) & 3).toBe(v);
        expect(adobeVariant(v, x, y)).toBe(adobeVariant(v, x, y));
      }
    expect(styles.size).toBe(8);
    expect(hashState(engine)).toBe(before);
  });

  for (const kind of ['residential', 'commercial', 'industrial'] as const) {
    it(`gives ${kind} eight distinct bounded geometries, including abandoned lots`, () => {
      for (const dead of [false, true])
        for (const level of [1, 2, 5]) {
          const signatures = new Set<string>();
          for (let variant = 0; variant < 8; variant++) {
            const r = record();
            drawBuilding(r.g, oasis, kind, 1, level, variant, dead);
            signatures.add(JSON.stringify(r.geometry));
            expect(r.geometry.length).toBeLessThan(160);
            expect(r.geometry.length).toBeGreaterThan(5);
            const numbers = (r.geometry as unknown[])
              .flat(Infinity)
              .filter((v) => typeof v === 'number') as number[];
            expect(numbers.every((v) => Number.isFinite(v) && Math.abs(v) < 120)).toBe(true);
          }
          expect(signatures.size).toBe(8);
        }
    });
  }

  it('takes every new color from the injected theme and removes market cloth on abandonment', () => {
    const black = { wall: 0, roof: 0, accent: 0, window: 0 };
    const theme = {
      ...oasis,
      colors: Object.fromEntries(Object.keys(oasis.colors).map((k) => [k, 0])),
      housePalettes: [black, black, black, black],
      commercialPalettes: [black, black, black, black],
      industrialPalettes: [black, black, black, black],
      abandoned: black,
    };
    for (const kind of ['residential', 'commercial', 'industrial'])
      for (let variant = 0; variant < 8; variant++) {
        const r = record();
        drawBuilding(r.g, theme, kind, 1, 2, variant, false);
        expect(r.fills.every((c) => c === 0)).toBe(true);
      }
    const alive = record(),
      dead = record();
    drawBuilding(alive.g, oasis, 'commercial', 1, 2, 4, false);
    drawBuilding(dead.g, oasis, 'commercial', 1, 2, 4, true);
    expect(dead.geometry.length).toBeLessThan(alive.geometry.length);
  });

  it('caches by appearance instead of coordinates and keeps classic and cyber caches unchanged', () => {
    const generateTexture = vi.fn(() => ({}));
    const b = { kind: 'residential' as const, w: 1, level: 2, variant: 0, abandoned: false };
    for (const theme of [oasis, urbe, neon]) {
      generateTexture.mockClear();
      const factory = new SpriteFactory(
        { generateTexture } as unknown as ConstructorParameters<typeof SpriteFactory>[0],
        theme,
      );
      const appearances = new Map<number, ReturnType<SpriteFactory['building']>>();
      for (let x = 0; x < 32; x++) {
        const texture = factory.building({ ...b, x, y: 10 });
        const variant = theme === oasis ? adobeVariant(0, x, 10) : 0;
        if (appearances.has(variant)) expect(texture).toBe(appearances.get(variant));
        appearances.set(variant, texture);
      }
      expect(generateTexture).toHaveBeenCalledTimes(theme === oasis ? 2 : 1);
    }
  });

  it('places workshop smoke at visible vents and leaves open work yards smoke-free', () => {
    for (let variant = 0; variant < 4; variant++)
      for (let x = 0; x < 12; x++) {
        const b = {
          id: 1,
          kind: 'industrial' as const,
          x,
          y: 10,
          w: 1,
          h: 1,
          level: 4,
          variant,
          abandoned: false,
          powered: true,
          occupancy: 10,
          offline: 0,
        };
        const tip = adobeIndustrialVent(4, adobeVariant(variant, x, 10));
        const vents = smokeVents([b], oasis);
        if (tip) expect(vents[0]).toMatchObject({ offsetX: tip.x, offsetY: tip.y });
        else expect(vents).toEqual([]);
        expect(smokeVents([{ ...b, abandoned: true }], oasis)).toEqual([]);
      }
  });
});
