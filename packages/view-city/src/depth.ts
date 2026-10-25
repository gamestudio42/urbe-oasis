/**
 * Draw order of everything that stands on the map inside one chunk: buildings, trees, poles and
 * flames, and the cars, walkers, camels and boats that move between them. They share one sorted
 * container, so a walker in front of a wall is drawn over it and one behind is hidden.
 *
 * x grows towards the lower right and y towards the lower left, so the south and east faces of
 * a footprint are the visible ones. For a square footprint of size s at (x, y), tiles along the
 * north and west faces have x + y of at most x + y + s - 2, and tiles along the south and east
 * faces at least x + y + s. Keying the building at x + y + s - 1 puts every actor beside it on the
 * right side; actors win ties with statics of the same sum.
 */
const ROW = 4;

/** Depth of a one-tile static object: a tree, a pole, a flame. */
export function staticDepth(x: number, y: number): number {
  return (x + y) * ROW + 1;
}

/** Depth of a square building whose north-west tile is (x, y). */
export function buildingDepth(x: number, y: number, size: number): number {
  return staticDepth(x + size - 1, y);
}

/** Depth of an actor on tile (x, y) at local (u, v), each in [0, 1): after statics of its row. */
export function actorDepth(x: number, y: number, u: number, v: number): number {
  return (x + y) * ROW + 2 + Math.min(1.99, Math.max(0, u + v));
}
