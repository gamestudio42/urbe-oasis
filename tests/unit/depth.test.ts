import { describe, expect, it } from 'vitest';
import { actorDepth, buildingDepth, staticDepth } from '../../packages/view-city/src/depth';

const building = buildingDepth;

/** Corners and middle of a tile, where a walker or car may stand. */
const SPOTS = [
  [0.05, 0.05],
  [0.5, 0.5],
  [0.95, 0.95],
  [0.05, 0.95],
  [0.95, 0.05],
] as const;

describe('isometric draw order of buildings and actors', () => {
  for (const size of [1, 2, 3]) {
    const bx = 10;
    const by = 10;
    const key = building(bx, by, size);

    it(`draws actors along the south and east faces of a ${size}×${size} building in front`, () => {
      for (let k = 0; k < size; k++) {
        const front = [
          [bx + k, by + size], // south face
          [bx + size, by + k], // east face
          [bx + size, by + size], // front corner
        ] as const;
        for (const [x, y] of front)
          for (const [u, v] of SPOTS) expect(actorDepth(x, y, u, v)).toBeGreaterThan(key);
      }
    });

    it(`hides actors along the north and west faces of a ${size}×${size} building`, () => {
      for (let k = 0; k < size; k++) {
        const back = [
          [bx + k, by - 1], // north face
          [bx - 1, by + k], // west face
          [bx - 1, by - 1], // back corner
        ] as const;
        for (const [x, y] of back)
          for (const [u, v] of SPOTS) expect(actorDepth(x, y, u, v)).toBeLessThan(key);
      }
    });
  }

  it('keeps every actor of a row below the statics of the next row', () => {
    for (const [u, v] of [...SPOTS, [0.999, 0.999], [1, 1], [-1, -1]] as const) {
      const actor = actorDepth(4, 7, u, v);
      expect(actor).toBeGreaterThan(staticDepth(4, 7));
      expect(actor).toBeLessThan(staticDepth(5, 7));
      expect(actor).toBeLessThan(staticDepth(4, 8));
    }
    // Within a tile, an actor further along its path is drawn later.
    expect(actorDepth(3, 3, 0.2, 0.2)).toBeLessThan(actorDepth(3, 3, 0.6, 0.6));
  });
});
