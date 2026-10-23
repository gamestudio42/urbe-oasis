import { describe, expect, it } from 'vitest';
import { urbe } from '../../packages/theme-urbe/src';

function rgb(color: number): { r: number; g: number; b: number } {
  return { r: (color >> 16) & 0xff, g: (color >> 8) & 0xff, b: color & 0xff };
}

function wallDistance(a: number, b: number): number {
  const left = rgb(a);
  const right = rgb(b);
  return Math.hypot(left.r - right.r, left.g - right.g, left.b - right.b);
}

describe('zone tower palettes', () => {
  it('keeps every residential wall far from every commercial wall', () => {
    const distances: number[] = [];
    for (const home of urbe.towerPalettes) {
      for (const shop of urbe.commercialPalettes) {
        distances.push(wallDistance(home.wall, shop.wall));
      }
    }
    expect(Math.min(...distances)).toBeGreaterThan(70);
  });
});
