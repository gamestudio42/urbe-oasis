import { describe, expect, it } from 'vitest';
import { oasis } from '../../packages/theme-oasis/src';
import { drawBuilding } from '../../packages/view-city/src/sprites';

/**
 * Adobe houses, the palm and the spring house have to read as one flat terracotta city:
 * more than one mass, a tall crown, and a square tower on a courtyard.
 */

function recorder() {
  const fills: number[] = [];
  const strokes: number[] = [];
  let ellipses = 0;
  let points = 0;
  const g = {
    poly(values: number[]) {
      points += values.length / 2;
      return g;
    },
    rect() {
      return g;
    },
    roundRect() {
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
    g: g as unknown as Parameters<typeof drawBuilding>[0],
    stats: () => ({ fills, strokes, ellipses, points }),
  };
}

function near(a: number, b: number): number {
  const dr = ((a >> 16) & 255) - ((b >> 16) & 255);
  const dg = ((a >> 8) & 255) - ((b >> 8) & 255);
  const db = (a & 255) - (b & 255);
  return Math.hypot(dr, dg, db);
}

describe('adobe houses, palm and spring house', () => {
  it('gives the four house variants different roofs', () => {
    const signatures = [0, 1, 2, 3].map((variant) => {
      const drawn = recorder();
      drawBuilding(drawn.g, oasis, 'residential', 1, 2, variant, false);
      const s = drawn.stats();
      return `${s.points}:${s.strokes.length}:${s.ellipses}`;
    });
    expect(new Set(signatures).size).toBeGreaterThanOrEqual(3);
    const plain = recorder();
    drawBuilding(plain.g, oasis, 'residential', 1, 2, 0, false);
    expect(plain.stats().points).toBeGreaterThan(12);
  });

  it('draws the palm as a tall crown', () => {
    const drawn = recorder();
    drawBuilding(drawn.g, oasis, 'palm', 1, 1, 0, false);
    const leaf = oasis.colors['tree.leafMid'] ?? 0;
    expect(drawn.stats().points).toBeGreaterThan(12);
    expect(drawn.stats().fills.some((c) => near(c, leaf) < 40)).toBe(true);
  });

  it('draws the spring house as a flat court with a square tower', () => {
    const drawn = recorder();
    drawBuilding(drawn.g, oasis, 'springHouse', 2, 1, 0, false);
    const water = oasis.colors['qanat.arc'] ?? 0;
    expect(drawn.stats().points).toBeGreaterThan(24);
    expect(drawn.stats().fills.some((c) => near(c, water) < 24)).toBe(true);
  });
});
