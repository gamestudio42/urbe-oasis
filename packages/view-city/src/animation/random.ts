/** Uniform generator in [0, 1). */
export type Random = () => number;

/**
 * Small seeded generator (mulberry32) for cosmetic animation. Kept apart from the engine RNG so
 * animations never change the simulation, and seeded so screenshots and tests are repeatable.
 */
export function createRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Index picked with probability proportional to `weights[i]`; -1 when every weight is 0. */
export function pickWeighted(weights: ArrayLike<number>, total: number, random: Random): number {
  if (total <= 0) return -1;
  let r = random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i] as number;
    if (r < 0) return i;
  }
  for (let i = weights.length - 1; i >= 0; i--) if ((weights[i] as number) > 0) return i;
  return -1;
}
