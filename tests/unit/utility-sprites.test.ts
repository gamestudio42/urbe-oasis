import { describe, expect, it } from 'vitest';
import { urbe } from '../../packages/theme-urbe/src';
import {
  drawCoalPlant,
  drawGasPlant,
  drawWaterPump,
  drawWell,
  drawWindTurbine,
} from '../../packages/view-city/src/utilitySprites';

/**
 * Records drawing calls instead of rasterising them. These sprites are pure geometry, so the
 * primitive count and the palette they read prove each utility building draws its own site.
 */
function recorder() {
  const fills: number[] = [];
  const strokes: number[] = [];
  let ellipses = 0;
  let rects = 0;
  let roundRects = 0;
  let points = 0;

  const g = {
    poly(values: number[]) {
      points += values.length / 2;
      return g;
    },
    rect() {
      rects += 1;
      return g;
    },
    roundRect() {
      roundRects += 1;
      return g;
    },
    ellipse() {
      ellipses += 1;
      return g;
    },
    circle() {
      ellipses += 1;
      return g;
    },
    moveTo() {
      return g;
    },
    lineTo() {
      return g;
    },
    closePath() {
      return g;
    },
    fill(arg: { color: number } | number) {
      if (typeof arg === 'number') fills.push(arg);
      else if (typeof arg.color === 'number') fills.push(arg.color);
      return g;
    },
    stroke(arg: { color: number }) {
      if (typeof arg.color === 'number') strokes.push(arg.color);
      return g;
    },
  };
  return {
    g: g as unknown as Parameters<typeof drawCoalPlant>[0],
    stats: () => ({ fills, strokes, ellipses, rects, roundRects, points }),
  };
}

const SITES = {
  coalPlant: { draw: drawCoalPlant, size: 3 },
  gasPlant: { draw: drawGasPlant, size: 2 },
  windTurbine: { draw: drawWindTurbine, size: 1 },
  waterPump: { draw: drawWaterPump, size: 2 },
  well: { draw: drawWell, size: 1 },
} as const;

function channels(c: number): [number, number, number] {
  return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
}

const PALETTE = Object.values(urbe.colors);

function nearest(color: number): number {
  const [r, g, b] = channels(color);
  let best = Infinity;
  for (const p of PALETTE) {
    const [pr, pg, pb] = channels(p);
    const d = Math.hypot(r - pr, g - pg, b - pb);
    if (d < best) best = d;
  }
  return best;
}

describe('utility sprites', () => {
  type Draw = (g: Parameters<typeof drawCoalPlant>[0], theme: typeof urbe, size: number) => void;

  for (const [kind, site] of Object.entries(SITES)) {
    it(`draws ${kind} with its own geometry in theme colours`, () => {
      const r = recorder();
      (site.draw as Draw)(r.g, urbe, site.size);
      const s = r.stats();
      expect(s.points + s.rects + s.ellipses).toBeGreaterThan(6);
      expect(s.fills.length).toBeGreaterThan(2);
      // Tints of theme colours only: no literal RGB in the drawing code.
      for (const c of [...s.fills, ...s.strokes]) expect(nearest(c)).toBeLessThan(48);
    });
  }

  it('gives every utility its own silhouette', () => {
    const signature = Object.values(SITES).map((site) => {
      const r = recorder();
      (site.draw as Draw)(r.g, urbe, site.size);
      const s = r.stats();
      return `${s.points}:${s.fills.length}:${s.ellipses}:${s.rects}:${s.roundRects}`;
    });
    expect(new Set(signature).size).toBe(signature.length);
  });

  it('keeps a wind turbine recognisable by its three blades', () => {
    const r = recorder();
    drawWindTurbine(r.g, urbe);
    // Three blade quads plus the tapered tower faces.
    expect(r.stats().points).toBeGreaterThanOrEqual(3 * 4 + 2 * 4);
  });
});
