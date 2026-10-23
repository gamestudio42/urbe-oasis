import { tileVariant } from '@city/simulation';
import { describe, expect, it } from 'vitest';

describe('tileVariant', () => {
  it('is a stable 0..3 hash of the tile, without consuming RNG', () => {
    expect(tileVariant(8, 12)).toBe(tileVariant(8, 12));
    expect(tileVariant(8, 12)).toBeGreaterThanOrEqual(0);
    expect(tileVariant(8, 12)).toBeLessThan(4);
  });

  it('covers all four styles on a small grid', () => {
    const seen = new Set<number>();
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) seen.add(tileVariant(x, y));
    }
    expect(seen).toEqual(new Set([0, 1, 2, 3]));
  });
});
