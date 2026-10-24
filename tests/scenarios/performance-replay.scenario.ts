import { SIM_PRESETS, SimulationEngine, hashState } from '@city/simulation';
import { describe, expect, it } from 'vitest';
import reference from '../fixtures/performance-replay.json';

/** Captured before the performance changes, including traffic-stage saves and month closes. */
describe('performance optimizations preserve the simulation', () => {
  for (const preset of ['grid', 'oasis-grid', 'oasis-rationing'] as const) {
    it(`retains the ${preset} reference hashes through growth, maintenance and save/load`, () => {
      const { engine, onMonth } = SIM_PRESETS[preset]!.create('performance-replay', 64);
      const checkpoints: { month: number; phase: string; hash: string }[] = [];
      for (let month = 1; month <= 36; month++) {
        engine.runTicks(117);
        if (month % 12 === 0) {
          checkpoints.push({ month, phase: 'traffic', hash: hashState(engine) });
          const resumed = SimulationEngine.fromSnapshot(engine.serialize());
          resumed.runTicks(3);
          engine.runTicks(3);
          expect(hashState(resumed)).toBe(hashState(engine));
        }
        if (month % 12 !== 0) engine.runTicks(3);
        onMonth(engine);
        if (month % 12 === 0) checkpoints.push({ month, phase: 'close', hash: hashState(engine) });
      }
      expect(checkpoints).toEqual(reference[preset]);
    });
  }
});
