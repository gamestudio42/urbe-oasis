import { hashString } from './hash';

export type RngState = [number, number, number, number];

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k));
}

function splitmix32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return t >>> 0;
  };
}

/** Seeded xoshiro128** generator. Its state is part of every save. */
export class Rng {
  private s0 = 0;
  private s1 = 0;
  private s2 = 0;
  private s3 = 0;

  constructor(state: RngState) {
    this.setState(state);
  }

  static fromSeed(seed: string | number): Rng {
    const numeric = typeof seed === 'number' ? seed : hashString(seed);
    const next = splitmix32(numeric);
    return new Rng([next(), next(), next(), next()]);
  }

  getState(): RngState {
    return [this.s0 >>> 0, this.s1 >>> 0, this.s2 >>> 0, this.s3 >>> 0];
  }

  setState(state: RngState): void {
    [this.s0, this.s1, this.s2, this.s3] = state.map((v) => v | 0) as RngState;
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s0 = 1;
  }

  nextU32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5), 7), 9) >>> 0;
    const t = this.s1 << 9;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = rotl(this.s3, 11);
    return result;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  /** Uniform integer in [min, max]. */
  range(min: number, max: number): number {
    return min + this.int(max - min + 1);
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Independent generator derived from this one (consumes one value). */
  fork(): Rng {
    return Rng.fromSeed(this.nextU32());
  }
}
