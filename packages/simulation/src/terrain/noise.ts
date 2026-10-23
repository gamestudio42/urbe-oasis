import type { Rng } from '../rng/rng';

/** Bilinear value noise on a seeded, wrapping lattice, using only deterministic arithmetic. */
export class ValueNoise {
  private readonly lattice: Float64Array;

  constructor(
    rng: Rng,
    private readonly cells: number,
  ) {
    this.lattice = new Float64Array(cells * cells);
    for (let i = 0; i < this.lattice.length; i++) this.lattice[i] = rng.next();
  }

  /** Samples at normalized coordinates (any real values; the lattice wraps). Returns [0, 1). */
  sample(u: number, v: number): number {
    const c = this.cells;
    const fx = u * c;
    const fy = v * c;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = smoothstep(fx - x0);
    const ty = smoothstep(fy - y0);
    const ax = wrap(x0, c);
    const bx = wrap(x0 + 1, c);
    const ay = wrap(y0, c) * c;
    const by = wrap(y0 + 1, c) * c;
    const l = this.lattice;
    const a = l[ay + ax] as number;
    const b = l[ay + bx] as number;
    const d0 = l[by + ax] as number;
    const d1 = l[by + bx] as number;
    const top = a + (b - a) * tx;
    const bottom = d0 + (d1 - d0) * tx;
    return top + (bottom - top) * ty;
  }
}

function wrap(i: number, n: number): number {
  return ((i % n) + n) % n;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

// Rotations by the angles of 3-4-5 and 5-12-13 triangles, so octave grids never align.
const ROTATIONS: ReadonlyArray<readonly [number, number]> = [
  [0.8, 0.6],
  [12 / 13, 5 / 13],
  [0.6, -0.8],
  [5 / 13, 12 / 13],
];

/** Sum of rotated octaves with halving amplitude, normalized to [0, 1). */
export class FractalNoise {
  private readonly octaves: ValueNoise[];
  private readonly offsets: Array<[number, number]>;

  constructor(rng: Rng, baseCells: number, octaveCount: number) {
    this.octaves = [];
    this.offsets = [];
    for (let o = 0; o < octaveCount; o++) {
      this.octaves.push(new ValueNoise(rng, (baseCells << o) + 1));
      this.offsets.push([rng.next(), rng.next()]);
    }
  }

  sample(u: number, v: number): number {
    let total = 0;
    let amplitude = 1;
    let norm = 0;
    for (let o = 0; o < this.octaves.length; o++) {
      const [cos, sin] = ROTATIONS[o % ROTATIONS.length] as readonly [number, number];
      const [ou, ov] = this.offsets[o] as [number, number];
      const ru = u * cos - v * sin + ou;
      const rv = u * sin + v * cos + ov;
      total += (this.octaves[o] as ValueNoise).sample(ru, rv) * amplitude;
      norm += amplitude;
      amplitude *= 0.5;
    }
    return total / norm;
  }
}
