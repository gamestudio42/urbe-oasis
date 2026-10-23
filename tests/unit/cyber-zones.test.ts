import { describe, expect, it } from 'vitest';
import { neon } from '../../packages/theme-neon/src';
import { urbe } from '../../packages/theme-urbe/src';
import {
  drawCyberCommercial,
  drawCyberIndustrial,
  drawCyberResidential,
} from '../../packages/view-city/src/cyberZoneSprites';
import { drawBuilding } from '../../packages/view-city/src/sprites';
import {
  drawCommercial,
  drawIndustrial,
  drawResidential,
} from '../../packages/view-city/src/zoneSprites';

/**
 * Cyberpunk lots have to read as blocks of light, not as recoloured houses. The geometry must
 * differ from the classic lot, and every painted colour has to come from the theme.
 */

function recorder() {
  const fills: number[] = [];
  const strokes: number[] = [];
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
    stroke(arg: { color: number }) {
      if (typeof arg.color === 'number') strokes.push(arg.color);
      return g;
    },
  };

  return {
    g: g as unknown as Graphics,
    stats: () => ({ fills, strokes, ellipses, rects, points }),
  };
}

type Graphics = Parameters<typeof drawCyberResidential>[0];
type Theme = Parameters<typeof drawCyberResidential>[1];
type Draw = (g: Graphics, theme: Theme, level: number, variant: number, abandoned: boolean) => void;

const KINDS: { kind: 'residential' | 'commercial' | 'industrial'; cyber: Draw; classic: Draw }[] = [
  { kind: 'residential', cyber: drawCyberResidential, classic: drawResidential },
  { kind: 'commercial', cyber: drawCyberCommercial, classic: drawCommercial },
  { kind: 'industrial', cyber: drawCyberIndustrial, classic: drawIndustrial },
];

function signature(draw: Draw, theme: Theme, level: number, variant: number, abandoned = false): string {
  const r = recorder();
  draw(r.g, theme, level, variant, abandoned);
  const s = r.stats();
  return `${s.points}:${s.rects}:${s.ellipses}:${s.fills.length}`;
}

function channels(c: number): [number, number, number] {
  return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
}

function distance(a: number, b: number): number {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  return Math.hypot(ar - br, ag - bg, ab - bb);
}

function paletteOf(theme: Theme): number[] {
  const lots = [
    ...theme.housePalettes,
    ...theme.towerPalettes,
    ...theme.commercialPalettes,
    ...theme.industrialPalettes,
    theme.abandoned,
  ];
  const fromLots = lots.flatMap((p) => [p.wall, p.roof, p.accent, ...(p.window === undefined ? [] : [p.window])]);
  return [...Object.values(theme.colors), ...fromLots];
}

const NEON_PALETTE = paletteOf(neon);

function nearest(c: number): number {
  let best = Infinity;
  for (const p of NEON_PALETTE) {
    const d = distance(c, p);
    if (d < best) best = d;
  }
  return best;
}

describe('cyberpunk zone lots', () => {
  for (const { kind, cyber, classic } of KINDS) {
    for (const level of [1, 2, 4, 6]) {
      for (const variant of [0, 1, 2, 3]) {
        it(`draws a cyberpunk ${kind} level ${level} variant ${variant} unlike the classic lot`, () => {
          const cyberSig = signature(cyber, neon, level, variant);
          const classicSig = signature(classic, urbe, level, variant);
          expect(cyberSig).not.toBe(classicSig);
          expect(cyberSig.startsWith('0:')).toBe(false);
        });
      }
    }

    for (const level of kind === 'industrial' ? [1, 4] : [1, 5]) {
      it(`gives ${kind} level ${level} four different silhouettes`, () => {
        const sigs = [0, 1, 2, 3].map((variant) => signature(cyber, neon, level, variant));
        expect(new Set(sigs).size).toBe(4);
      });
    }
  }

  it('paints only theme colours', () => {
    for (const { cyber } of KINDS) {
      for (let level = 1; level <= 6; level++) {
        for (const variant of [0, 1, 2, 3]) {
          for (const abandoned of [false, true]) {
            const r = recorder();
            cyber(r.g, neon, level, variant, abandoned);
            for (const c of [...r.stats().fills, ...r.stats().strokes]) {
              expect(nearest(c), `#${c.toString(16)}`).toBeLessThan(48);
            }
          }
        }
      }
    }
  });

  it('lights a shop with a facade sign and a factory with the amber glow', () => {
    const shop = recorder();
    drawCyberCommercial(shop.g, neon, 1, 0, false);
    expect(shop.stats().fills).toContain(neon.commercialPalettes[0]?.accent);

    const plant = recorder();
    drawCyberIndustrial(plant.g, neon, 3, 0, false);
    const glow = neon.colors['fire.glow'];
    expect(glow).toBeDefined();
    expect([...plant.stats().fills, ...plant.stats().strokes].some((c) => distance(c, glow as number) < 24)).toBe(true);
  });

  it('routes zone lots through the theme style', () => {
    for (const { kind, cyber, classic } of KINDS) {
      const level = kind === 'industrial' ? 3 : 4;
      const routed = recorder();
      drawBuilding(routed.g, neon, kind, 1, level, 1, false);
      expect(signatureFrom(routed)).toBe(signature(cyber, neon, level, 1));

      const classicRouted = recorder();
      drawBuilding(classicRouted.g, urbe, kind, 1, level, 2, false);
      expect(signatureFrom(classicRouted)).toBe(signature(classic, urbe, level, 2));
    }
  });
});

function signatureFrom(r: ReturnType<typeof recorder>): string {
  const s = r.stats();
  return `${s.points}:${s.rects}:${s.ellipses}:${s.fills.length}`;
}
