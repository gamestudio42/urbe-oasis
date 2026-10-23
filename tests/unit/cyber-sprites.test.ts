import { describe, expect, it } from 'vitest';
import { neon } from '../../packages/theme-neon/src';
import { urbe } from '../../packages/theme-urbe/src';
import {
  drawCyberCivic,
  drawCyberPole,
  drawCyberUtility,
} from '../../packages/view-city/src/cyberSprites';
import { drawCivic } from '../../packages/view-city/src/civicSprites';
import { drawBuilding, drawVehicle } from '../../packages/view-city/src/sprites';
import { drawUtility } from '../../packages/view-city/src/utilitySprites';

/**
 * The cyberpunk variants have to read as a different architecture, not as a recoloured classic
 * building. These tests record the drawing calls and check the two things that matter: the cyber
 * set is geometrically distinct from the classic one, and every colour it paints comes from the
 * theme palette.
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
    g: g as unknown as Parameters<typeof drawCyberCivic>[0],
    stats: () => ({ fills, strokes, ellipses, rects, roundRects, points }),
  };
}

const CIVIC = ['policeStation', 'fireStation', 'school', 'hospital'] as const;
const UTILITY: { kind: string; size: number }[] = [
  { kind: 'coalPlant', size: 3 },
  { kind: 'gasPlant', size: 2 },
  { kind: 'windTurbine', size: 1 },
  { kind: 'waterPump', size: 2 },
  { kind: 'well', size: 1 },
];

function channels(c: number): [number, number, number] {
  return [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
}

function distance(a: number, b: number): number {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  return Math.hypot(ar - br, ag - bg, ab - bb);
}

const PALETTE = Object.values(neon.colors);

function nearestNeonColor(c: number): number {
  let best = Infinity;
  for (const p of PALETTE) {
    const d = distance(c, p);
    if (d < best) best = d;
  }
  return best;
}

describe('cyberpunk civic and utility sprites', () => {
  it('marks the neon theme as cyber and the urbe theme as classic', () => {
    expect(neon.style).toBe('cyber');
    expect(urbe.style).toBe('classic');
  });

  for (const kind of CIVIC) {
    it(`draws a cyberpunk ${kind} that differs from the classic one`, () => {
      const cyber = recorder();
      expect(drawCyberCivic(cyber.g, neon, kind)).toBe(true);
      const classic = recorder();
      expect(drawCivic(classic.g, urbe, kind)).toBe(true);

      const cs = cyber.stats();
      const ks = classic.stats();
      // A different silhouette, not the same geometry in new colours.
      expect(`${cs.points}:${cs.rects}:${cs.ellipses}`).not.toBe(
        `${ks.points}:${ks.rects}:${ks.ellipses}`,
      );
      expect(cs.points).toBeGreaterThan(20);
    });
  }

  for (const { kind, size } of UTILITY) {
    it(`draws a cyberpunk ${kind} that differs from the classic one`, () => {
      const cyber = recorder();
      expect(drawCyberUtility(cyber.g, neon, kind, size)).toBe(true);
      const classic = recorder();
      expect(drawUtility(classic.g, urbe, kind, size)).toBe(true);

      const cs = cyber.stats();
      const ks = classic.stats();
      expect(`${cs.points}:${cs.rects}:${cs.ellipses}`).not.toBe(
        `${ks.points}:${ks.rects}:${ks.ellipses}`,
      );
      expect(cs.points + cs.rects + cs.ellipses).toBeGreaterThan(6);
    });
  }

  it('paints only theme colours', () => {
    for (const kind of CIVIC) {
      const r = recorder();
      drawCyberCivic(r.g, neon, kind);
      for (const c of [...r.stats().fills, ...r.stats().strokes]) {
        expect(nearestNeonColor(c)).toBeLessThan(48);
      }
    }
    for (const { kind, size } of UTILITY) {
      const r = recorder();
      drawCyberUtility(r.g, neon, kind, size);
      for (const c of [...r.stats().fills, ...r.stats().strokes]) {
        expect(nearestNeonColor(c)).toBeLessThan(48);
      }
    }
  });

  it('gives every cyberpunk building a distinct silhouette', () => {
    const signatures = [
      ...CIVIC.map((kind) => {
        const r = recorder();
        drawCyberCivic(r.g, neon, kind);
        const s = r.stats();
        return `c:${s.points}:${s.fills.length}:${s.ellipses}:${s.rects}`;
      }),
      ...UTILITY.map(({ kind, size }) => {
        const r = recorder();
        drawCyberUtility(r.g, neon, kind, size);
        const s = r.stats();
        return `u:${s.points}:${s.fills.length}:${s.ellipses}:${s.rects}`;
      }),
    ];
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it('uses the neon accents the theme reserved for these buildings', () => {
    // Each cyberpunk service leans on its own glow token, so the buildings stay colour-coded.
    const expected: Record<string, string> = {
      policeStation: 'police.glow',
      fireStation: 'fire.glow',
      school: 'school.glow',
      hospital: 'hospital.glow',
    };
    for (const [kind, token] of Object.entries(expected)) {
      const accent = neon.colors[token];
      expect(accent).toBeDefined();
      const r = recorder();
      drawCyberCivic(r.g, neon, kind);
      const used = [...r.stats().fills, ...r.stats().strokes];
      expect(used.some((c) => distance(c, accent as number) < 24)).toBe(true);
    }
  });

  it('routes the civic and utility buildings to the cyber set on a cyber theme', () => {
    // The renderer picks the architecture from the theme, so the same call must produce the
    // cyberpunk geometry in Neo Urbe and the classic geometry in Urbe.
    const signature = (r: ReturnType<typeof recorder>) => {
      const s = r.stats();
      return `${s.points}:${s.rects}:${s.ellipses}:${s.roundRects}:${s.fills.length}`;
    };

    for (const kind of CIVIC) {
      const cyber = recorder();
      drawBuilding(cyber.g, neon, kind, 2, 1, 0, false);
      const classic = recorder();
      drawBuilding(classic.g, urbe, kind, 2, 1, 0, false);

      const direct = recorder();
      drawCyberCivic(direct.g, neon, kind);
      expect(signature(cyber)).toBe(signature(direct));
      expect(signature(cyber)).not.toBe(signature(classic));
    }

    for (const { kind, size } of UTILITY) {
      const cyber = recorder();
      drawBuilding(cyber.g, neon, kind, size, 1, 0, false);
      const classic = recorder();
      drawBuilding(classic.g, urbe, kind, size, 1, 0, false);

      const direct = recorder();
      drawCyberUtility(direct.g, neon, kind, size);
      expect(signature(cyber)).toBe(signature(direct));
      expect(signature(cyber)).not.toBe(signature(classic));
    }
  });

  it('draws the marina and the power pole in the cyber set', () => {
    const signature = (r: ReturnType<typeof recorder>) => {
      const s = r.stats();
      return `${s.points}:${s.rects}:${s.ellipses}:${s.fills.length}`;
    };
    const marina = recorder();
    drawBuilding(marina.g, neon, 'marina', 3, 1, 0, false, 0);
    const classic = recorder();
    drawBuilding(classic.g, urbe, 'marina', 3, 1, 0, false, 0);
    expect(signature(marina)).not.toBe(signature(classic));
    expect(marina.stats().points).toBeGreaterThan(20);

    const allowed = [...PALETTE, ...neon.boats];
    const nearest = (c: number) => {
      let best = Infinity;
      for (const p of allowed) {
        const d = distance(c, p);
        if (d < best) best = d;
      }
      return best;
    };
    for (const c of [...marina.stats().fills, ...marina.stats().strokes]) {
      expect(nearest(c)).toBeLessThan(48);
    }
    const used = [...marina.stats().fills, ...marina.stats().strokes];
    expect(used.some((c) => distance(c, neon.colors['marina.clubWindow'] as number) < 24)).toBe(true);
    expect(used.some((c) => distance(c, neon.colors['marina.flagCloth'] as number) < 24)).toBe(true);

    const pole = recorder();
    drawCyberPole(pole.g, neon);
    expect(pole.stats().ellipses).toBeGreaterThan(0);
    for (const c of [...pole.stats().fills, ...pole.stats().strokes]) {
      expect(nearestNeonColor(c)).toBeLessThan(48);
    }
    const poleColors = [...pole.stats().fills, ...pole.stats().strokes];
    expect(poleColors.some((c) => distance(c, neon.colors['infra.pipe'] as number) < 24)).toBe(true);
  });

  it('draws cyber cars and trucks as a dark chassis with an emissive mark', () => {
    const signature = (r: ReturnType<typeof recorder>) => {
      const s = r.stats();
      return `${s.points}:${s.rects}:${s.ellipses}:${s.fills.length}`;
    };
    const allowed = [...PALETTE, ...neon.cars];
    const nearest = (c: number) => {
      let best = Infinity;
      for (const p of allowed) {
        const d = distance(c, p);
        if (d < best) best = d;
      }
      return best;
    };
    for (const kind of ['car', 'truck'] as const) {
      const cyber = recorder();
      drawVehicle(cyber.g, neon, kind, 'x', 0, false);
      const classic = recorder();
      drawVehicle(classic.g, urbe, kind, 'x', 0, false);
      expect(signature(cyber)).not.toBe(signature(classic));
      for (const c of [...cyber.stats().fills, ...cyber.stats().strokes]) {
        expect(nearest(c)).toBeLessThan(48);
      }
    }
    const amber = recorder();
    drawVehicle(amber.g, neon, 'car', 'y', 2, false);
    const mark = neon.cars[2] as number;
    const used = [...amber.stats().fills, ...amber.stats().strokes];
    expect(used.some((c) => distance(c, mark) < 24)).toBe(true);
    expect(used.some((c) => distance(c, neon.colors['road.mark'] as number) < 24)).toBe(true);
    // The steel swatch matches the chassis, so that car's mark is the rail colour.
    const steel = recorder();
    drawVehicle(steel.g, neon, 'car', 'x', 5, false);
    const steelUsed = [...steel.stats().fills, ...steel.stats().strokes];
    expect(steelUsed.some((c) => c === (neon.colors['road.bridgeRail'] as number))).toBe(true);

    const fireCyber = recorder();
    drawVehicle(fireCyber.g, neon, 'fireTruck', 'x', 0, true);
    const fireClassic = recorder();
    drawVehicle(fireClassic.g, urbe, 'fireTruck', 'x', 0, true);
    expect(signature(fireCyber)).toBe(signature(fireClassic));
  });

  it('draws the springHouse and the edge node only for the cyber style', () => {
    for (const kind of ['springHouse', 'palm'] as const) {
      const cyber = recorder();
      drawBuilding(cyber.g, neon, kind, kind === 'springHouse' ? 2 : 1, 1, 0, false);
      const drawn = cyber.stats();
      expect(drawn.points + drawn.rects + drawn.ellipses).toBeGreaterThan(0);
      for (const c of [...drawn.fills, ...drawn.strokes]) {
        expect(nearestNeonColor(c)).toBeLessThan(48);
      }
      const classic = recorder();
      drawBuilding(classic.g, urbe, kind, kind === 'springHouse' ? 2 : 1, 1, 0, false);
      const plain = classic.stats();
      expect(plain.points + plain.rects + plain.ellipses + plain.roundRects).toBe(0);
    }
  });

  it('leaves the neon-only placeables on their own drawings', () => {
    // The drone port, qanat and cistern were already cyberpunk and must not change.
    for (const kind of ['arcade', 'qanat', 'cistern', 'windbreak', 'caravanserai']) {
      const cyber = recorder();
      drawBuilding(cyber.g, neon, kind, 2, 1, 0, false);
      expect(cyber.stats().points).toBeGreaterThan(10);
    }
  });
});
