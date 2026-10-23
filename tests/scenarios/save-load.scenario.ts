import { decodeSave, encodeSave, stringifySave } from '@city/shared';
import {
  addServices,
  buildTown,
  collectMetrics,
  flatCity,
  hashState,
  maintainTown,
  SimulationEngine,
} from '@city/simulation';
import { describe, it } from 'vitest';
import { Scenario } from './harness';

function roundTrip(engine: SimulationEngine): { restored: SimulationEngine | null; bytes: number } {
  const s = engine.stats();
  const text = stringifySave(
    encodeSave(engine.serialize(), {
      population: s.population,
      funds: s.funds,
      savedAt: '2026-01-01T00:00:00.000Z',
    }),
  );
  const result = decodeSave(text);
  return {
    restored: result.ok ? SimulationEngine.fromSnapshot(result.snapshot) : null,
    bytes: text.length,
  };
}

describe('scenario: save and load', () => {
  it('a restored city has the same hash and evolves identically', () => {
    const original = flatCity('save-load', 64);
    original.execute({ type: 'setDisasters', enabled: true });
    const layout = buildTown(original, { pumps: 8 });
    addServices(original, layout);
    const s = new Scenario('save-load', original);
    s.run(18, (e) => maintainTown(e));
    // Save in the middle of a month, with an active fire and a running crisis.
    original.runTicks(53);
    const home = original.buildings.ofKind('residential')[0];
    if (home) original.triggerDisaster('fire', home.x, home.y);
    original.triggerDisaster('crisis');
    s.check('a fire is burning when saving', original.fireCount > 0, original.fireCount);

    const { restored, bytes } = roundTrip(original);
    s.check('save decodes', restored !== null);
    if (!restored) return s.finish();
    s.check(
      'same hash after load',
      hashState(restored) === hashState(original),
      hashState(original),
    );
    s.check('same fires burning', restored.fireCount === original.fireCount, original.fireCount);
    s.check(
      'same active disasters',
      JSON.stringify(restored.disasters) === JSON.stringify(original.disasters),
    );

    const copy = new Scenario('save-load-restored', restored);
    s.run(12, (e) => maintainTown(e));
    copy.run(12, (e) => maintainTown(e));
    const strip = (x: Scenario) => x.metrics.map(({ msPerMonth: _ms, ...m }) => m);
    s.check(
      'identical metrics for 12 months after load',
      JSON.stringify(strip(s).slice(-12)) === JSON.stringify(strip(copy)),
    );
    s.check('same hash 12 months later', hashState(restored) === hashState(original));

    // A second generation: save the restored city and load it again.
    const second = roundTrip(restored).restored;
    s.check(
      'second round trip keeps the hash',
      second !== null && hashState(second) === hashState(restored),
    );
    s.check('save stays under 1 MB for a 64×64 city', bytes < 1_000_000, bytes);
    s.finish({
      saveBytes: bytes,
      population: collectMetrics(original).population,
      hash: hashState(original),
    });
  });
});
