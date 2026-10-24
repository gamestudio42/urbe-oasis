import { boxBlur, Rng } from '@city/simulation';
import { expect, it } from 'vitest';

/** Literal separable definition, deliberately independent of the optimized fixed windows. */
function reference(src: Float32Array, size: number, radius: number) {
  const horizontal = new Float32Array(src.length);
  const result = new Float32Array(src.length);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let sum = 0;
      let count = 0;
      for (let k = Math.max(0, x - radius); k <= Math.min(size - 1, x + radius); k++) {
        sum += src[y * size + k]!;
        count++;
      }
      horizontal[y * size + x] = sum / count;
    }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let sum = 0;
      let count = 0;
      for (let k = Math.max(0, y - radius); k <= Math.min(size - 1, y + radius); k++) {
        sum += horizontal[k * size + x]!;
        count++;
      }
      result[y * size + x] = sum / count;
    }
  return result;
}

it('preserves exact Float32 results at edges and interior, including cancellation and exceptional values', () => {
  const rng = Rng.fromSeed('blur-order');
  const extremes = [0, -0, 1e30, -1e30, 1e-30, -1e-30, Infinity, -Infinity, NaN];
  for (const size of [1, 2, 3, 4, 5, 8, 31])
    for (const radius of [0, 1, 2, 3, 9]) {
      for (const exceptional of [false, true]) {
        const src = Float32Array.from({ length: size * size }, () =>
          exceptional
            ? extremes[rng.range(0, extremes.length - 1)]!
            : rng.range(-100000, 100000) / 73,
        );
        const copy = src.slice();
        expect(boxBlur(src, size, radius)).toEqual(reference(src, size, radius));
        expect(src).toEqual(copy);
      }
    }
});
