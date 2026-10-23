import { describe, expect, it } from 'vitest';
import { urbe } from '../../packages/theme-urbe/src';
import {
  drawFireStation,
  drawHospital,
  drawPoliceStation,
  drawSchool,
} from '../../packages/view-city/src/civicSprites';

/**
 * Records every drawing call instead of rasterising it. The civic sprites are pure geometry, so
 * counting the primitives they emit proves each service draws its own silhouette rather than the
 * shared box the four buildings used to be.
 */
function recorder() {
  const fills: number[] = [];
  const strokes: number[] = [];
  const ellipses: number[] = [];
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
    ellipse() {
      ellipses.push(1);
      return g;
    },
    circle() {
      ellipses.push(1);
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
    fill(arg: { color: number }) {
      if (typeof arg.color === 'number') fills.push(arg.color);
      return g;
    },
    stroke(arg: { color: number }) {
      if (typeof arg.color === 'number') strokes.push(arg.color);
      return g;
    },
  };

  return {
    g: g as unknown as Parameters<typeof drawPoliceStation>[0],
    stats: () => ({ fills, strokes, ellipses, rects, points }),
  };
}

const BUILDERS = {
  policeStation: drawPoliceStation,
  fireStation: drawFireStation,
  school: drawSchool,
  hospital: drawHospital,
} as const;

describe('civic sprites', () => {
  for (const [kind, draw] of Object.entries(BUILDERS)) {
    it(`draws ${kind} with geometry and theme colours`, () => {
      const r = recorder();
      draw(r.g, urbe);
      const stats = r.stats();
      expect(stats.points).toBeGreaterThan(20);
      expect(stats.fills.length).toBeGreaterThan(3);
      // Colours may be shaded variants, so each one must be a tint of a theme colour.
      for (const c of [...stats.fills, ...stats.strokes]) {
        expect(nearestThemeDistance(c)).toBeLessThan(48);
      }
    });
  }

  it('gives each service a distinct silhouette', () => {
    const signatures = Object.values(BUILDERS).map((draw) => {
      const r = recorder();
      draw(r.g, urbe);
      const s = r.stats();
      return `${s.points}:${s.fills.length}:${s.ellipses.length}:${s.rects}`;
    });
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it('gives each service its own paint, not the shared box palette', () => {
    const family = {
      policeStation: 'police',
      fireStation: 'fire',
      school: 'school',
      hospital: 'hospital',
    } as const;
    const painted = Object.entries(BUILDERS).map(([kind, draw]) => {
      const r = recorder();
      draw(r.g, urbe);
      const fills = r.stats().fills;
      const familyColors = Object.entries(urbe.colors)
        .filter(([token]) => token.startsWith(`${family[kind as keyof typeof family]}.`))
        .map(([, value]) => value);
      return fills.some((c) => familyColors.some((f) => distance(c, f) < 48));
    });
    expect(painted.every(Boolean)).toBe(true);
  });
});

function channels(color: number): [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
}

function distance(a: number, b: number): number {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  return Math.hypot(ar - br, ag - bg, ab - bb);
}

const PALETTE = Object.values(urbe.colors);

function nearestThemeDistance(color: number): number {
  return Math.min(...PALETTE.map((p) => distance(color, p)));
}
