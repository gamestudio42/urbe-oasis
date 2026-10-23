import { describe, expect, it } from 'vitest';
import { INDUSTRIAL_HEIGHTS } from '../../packages/view-city/src/chimneys';
import { ZONE_HEIGHTS, zoneFloors, zoneHeight } from '../../packages/view-city/src/zoneSprites';

const MAX_LEVEL = 7;

describe('zone height ladder', () => {
  it('has an entry for every level up to the neon cap', () => {
    for (const table of [ZONE_HEIGHTS.residential, ZONE_HEIGHTS.commercial, INDUSTRIAL_HEIGHTS]) {
      expect(table).toHaveLength(MAX_LEVEL + 1);
    }
  });

  it('grows strictly after the first built level', () => {
    for (const kind of ['residential', 'commercial'] as const) {
      const table = ZONE_HEIGHTS[kind];
      for (let level = 3; level <= MAX_LEVEL; level += 1) {
        expect(table[level]).toBeGreaterThan(table[level - 1]!);
      }
    }
    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      expect(INDUSTRIAL_HEIGHTS[level]).toBeGreaterThan(INDUSTRIAL_HEIGHTS[level - 1]!);
    }
  });

  it('makes level 7 towers the tallest silhouette', () => {
    expect(zoneHeight('commercial', 7)).toBeGreaterThan(zoneHeight('commercial', 6));
    expect(zoneHeight('residential', 7)).toBeGreaterThan(zoneHeight('residential', 6));
    expect(zoneHeight('commercial', 7)).toBeGreaterThan(zoneHeight('residential', 7));
  });

  it('adds floors as the tower grows', () => {
    for (const kind of ['residential', 'commercial'] as const) {
      expect(zoneFloors(kind, 7)).toBeGreaterThan(zoneFloors(kind, 5));
      expect(zoneFloors(kind, 6)).toBeGreaterThan(zoneFloors(kind, 4));
    }
  });

  it('falls back to a sane height for unknown levels', () => {
    expect(zoneHeight('residential', 99)).toBe(40);
    expect(zoneHeight('commercial', 99)).toBe(16);
    expect(zoneFloors('residential', 99)).toBe(4);
    expect(zoneFloors('commercial', 99)).toBe(1);
  });
});
