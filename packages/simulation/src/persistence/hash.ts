import { canonicalJson, Fnv1a, type EngineSnapshot } from '@city/shared';
import type { SimulationEngine } from '../engine';

/** Hash of the complete simulation state; the oracle for determinism and save/load tests. */
export function hashSnapshot(snapshot: EngineSnapshot): string {
  const h = new Fnv1a();
  h.bytes(snapshot.heights);
  for (const name of Object.keys(snapshot.layers).sort()) {
    const layer = snapshot.layers[name as keyof EngineSnapshot['layers']];
    if (!layer) continue;
    h.string(name);
    h.bytes(layer);
  }
  const { heights: _h, layers: _l, ...rest } = snapshot;
  // Key order is not state: a decoded save may build its objects in a different order.
  h.string(canonicalJson(rest));
  return h.hex();
}

export function hashState(engine: SimulationEngine): string {
  return hashSnapshot(engine.serialize());
}

/** Hash of terrain only (heights, terrain type, trees). */
export function hashTerrain(engine: SimulationEngine): string {
  const w = engine.world;
  return new Fnv1a().bytes(w.heights).bytes(w.terrain).bytes(w.trees).hex();
}
