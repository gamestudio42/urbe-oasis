/** Orthogonal neighbour offsets in a fixed order: north (-y), east (+x), south (+y), west (-x). */
export const DX4 = [0, 1, 0, -1] as const;
export const DY4 = [-1, 0, 1, 0] as const;

/** Calls `fn` for each in-bounds orthogonal neighbour index of tile `i`. */
export function forEachNeighbor4(size: number, i: number, fn: (n: number) => void): void {
  const x = i % size;
  const y = (i / size) | 0;
  if (y > 0) fn(i - size);
  if (x < size - 1) fn(i + 1);
  if (y < size - 1) fn(i + size);
  if (x > 0) fn(i - 1);
}

/** Index lists for the square rings around a tile (Chebyshev distance 1..radius). */
export function ringOffsets(radius: number): Array<Array<[number, number]>> {
  const rings: Array<Array<[number, number]>> = [];
  for (let r = 1; r <= radius; r++) {
    const ring: Array<[number, number]> = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r) ring.push([dx, dy]);
      }
    }
    // Prefer orthogonal neighbours first so the choice is stable and intuitive.
    ring.sort((a, b) => Math.abs(a[0]) + Math.abs(a[1]) - (Math.abs(b[0]) + Math.abs(b[1])));
    rings.push(ring);
  }
  return rings;
}
