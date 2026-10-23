import { describe, expect, it } from 'vitest';
import { oasis } from '../../packages/theme-oasis/src';
import { urbe } from '../../packages/theme-urbe/src';
import { drawBuilding } from '../../packages/view-city/src/sprites';

/**
 * Adobe buildings have to read as mud brick, not as the classic civic set repainted and not as
 * the neon glass bands. The check is the drawing-call signature: same counts means same shape.
 */
function recorder() {
  const fills: number[] = [];
  let ellipses = 0;
  let rects = 0;
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
    stroke() {
      return g;
    },
  };
  return {
    g: g as unknown as Parameters<typeof drawBuilding>[0],
    stats: () => ({ fills, ellipses, rects, points }),
  };
}

const CIVIC = ['policeStation', 'fireStation', 'school', 'hospital'] as const;
const UTILITY = [
  { kind: 'coalPlant', size: 3 },
  { kind: 'gasPlant', size: 2 },
  { kind: 'windTurbine', size: 1 },
  { kind: 'waterPump', size: 2 },
  { kind: 'well', size: 1 },
] as const;

function signature(theme: typeof oasis, kind: string, size: number): string {
  const r = recorder();
  drawBuilding(r.g, theme, kind, size, 1, 0, false);
  const s = r.stats();
  return `${s.points}:${s.rects}:${s.ellipses}`;
}

describe('adobe civic and utility sprites', () => {
  it('marks the oasis theme as adobe', () => {
    expect(oasis.style).toBe('adobe');
  });

  for (const kind of CIVIC) {
    it(`draws an adobe ${kind} that is not the classic silhouette`, () => {
      expect(signature(oasis, kind, 2)).not.toBe(signature(urbe, kind, 2));
      const drawn = recorder();
      drawBuilding(drawn.g, oasis, kind, 2, 1, 0, false);
      expect(drawn.stats().points).toBeGreaterThan(12);
    });
  }

  for (const { kind, size } of UTILITY) {
    it(`draws an adobe ${kind} that is not the classic silhouette`, () => {
      expect(signature(oasis, kind, size)).not.toBe(signature(urbe, kind, size));
    });
  }

  it('gives every adobe service and plant its own silhouette', () => {
    const signatures = [
      ...CIVIC.map((kind) => signature(oasis, kind, 2)),
      ...UTILITY.map(({ kind, size }) => signature(oasis, kind, size)),
    ];
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it('paints civic walls in clay, not the neon steel', () => {
    const r = recorder();
    drawBuilding(r.g, oasis, 'policeStation', 2, 1, 0, false);
    const clay = oasis.colors['police.wall'] ?? 0;
    const near = (a: number, b: number) => {
      const dr = ((a >> 16) & 255) - ((b >> 16) & 255);
      const dg = ((a >> 8) & 255) - ((b >> 8) & 255);
      const db = (a & 255) - (b & 255);
      return Math.hypot(dr, dg, db);
    };
    expect(r.stats().fills.some((c) => near(c, clay) < 90)).toBe(true);
    expect(r.stats().fills).not.toContain(0x232a38);
  });
});
