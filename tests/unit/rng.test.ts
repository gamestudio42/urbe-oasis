import { Rng } from '@city/simulation';
import { describe, expect, it } from 'vitest';

describe('Rng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = Rng.fromSeed('city');
    const b = Rng.fromSeed('city');
    for (let i = 0; i < 1000; i++) expect(a.nextU32()).toBe(b.nextU32());
  });

  it('produces different sequences for different seeds', () => {
    const a = Rng.fromSeed(1);
    const b = Rng.fromSeed(2);
    const same = Array.from({ length: 50 }, () => a.nextU32() === b.nextU32()).filter(
      Boolean,
    ).length;
    expect(same).toBeLessThan(3);
  });

  it('restores its state exactly', () => {
    const a = Rng.fromSeed('save');
    for (let i = 0; i < 37; i++) a.next();
    const b = new Rng(a.getState());
    for (let i = 0; i < 100; i++) expect(b.next()).toBe(a.next());
  });

  it('keeps values in range and roughly uniform', () => {
    const rng = Rng.fromSeed(99);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 20000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      buckets[Math.floor(v * 10)]++;
      const n = rng.range(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
    for (const count of buckets) expect(Math.abs(count - 2000)).toBeLessThan(250);
  });
});
