import {
  OASIS_SAVE_FORMAT,
  SAVE_FORMAT,
  decodeSave,
  encodeSave,
  stringifySave,
} from '@city/shared';
import { SimulationEngine, createEngine } from '@city/simulation';
import { describe, expect, it } from 'vitest';

/** A small Oasis city with the extra state the envelope has to carry. */
function oasisCity(): SimulationEngine {
  const e = createEngine({
    seed: 'neon-save',
    size: 48,
    name: 'Oasis',
    ruleset: 'oasis',
    terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    funds: 200_000,
  });
  e.disastersEnabled = false;
  e.execute({ type: 'road', x0: 4, y0: 10, x1: 30, y1: 10 });
  e.execute({ type: 'place', kind: 'qanat', x: 10, y: 12 });
  e.execute({ type: 'place', kind: 'cistern', x: 13, y: 12 });
  e.runMonths(3);
  return e;
}

const meta = { population: 0, funds: 200_000, savedAt: '2026-01-01T00:00:00.000Z' };
const oasisOptions = { format: OASIS_SAVE_FORMAT };

describe('Oasis save envelope', () => {
  it('keeps the ruleset and the Oasis state across a round trip', () => {
    const e = oasisCity();
    const file = encodeSave(e.serialize(), meta, oasisOptions);
    const decoded = decodeSave(stringifySave(file), oasisOptions);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.snapshot.ruleset).toBe('oasis');
    expect(decoded.snapshot.oasis).toBeDefined();
    expect(decoded.snapshot.oasis?.caravans.length).toBeGreaterThan(0);
  });

  it('preserves cistern charge and caravan house capital', () => {
    const e = oasisCity();
    const cisterns = e.oasis.cisterns.map((b) => ({ ...b }));
    const corps = e.oasis.caravans.map((c) => ({ ...c }));
    const file = encodeSave(e.serialize(), meta, oasisOptions);
    const decoded = decodeSave(stringifySave(file), oasisOptions);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.snapshot.oasis?.cisterns).toEqual(cisterns);
    expect(decoded.snapshot.oasis?.caravans).toEqual(corps);
  });

  it('opens a classic city in Neo Urbe and keeps it classic', () => {
    const e = createEngine({
      seed: 'classic',
      size: 48,
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    });
    const file = encodeSave(e.serialize(), meta);
    // The decoder accepts the known city formats, so the file opens...
    const decoded = decodeSave(stringifySave(file), oasisOptions);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    // ...and the file's own ruleset decides how the city runs, not the app that opened it.
    expect(decoded.snapshot.ruleset).toBe('classic');
  });

  it('rejects a file that is not a city save', () => {
    const decoded = decodeSave(stringifySave({ format: 'something-else', state: {} }), oasisOptions);
    expect(decoded.ok).toBe(false);
  });

  it('keeps the classic envelope unchanged', () => {
    const e = createEngine({
      seed: 'classic',
      size: 48,
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    });
    const file = encodeSave(e.serialize(), meta);
    expect(file.format).toBe(SAVE_FORMAT);
    const decoded = decodeSave(stringifySave(file));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.snapshot.ruleset).toBe('classic');
    expect(decoded.snapshot.oasis).toBeUndefined();
    expect(decoded.snapshot.layers.linked).toBeUndefined();
    for (const b of decoded.snapshot.buildings) expect('linked' in b).toBe(false);
  });

  it('loads a Oasis file that predates the data layer', () => {
    const e = oasisCity();
    e.execute({ type: 'canal', x0: 4, y0: 14, x1: 12, y1: 14 });
    e.refreshUtilities();
    const snap = e.serialize();
    expect(snap.layers.linked).toBeDefined();
    delete snap.layers.linked;
    snap.networksDirty = false;
    const file = encodeSave(snap, meta, oasisOptions);
    const decoded = decodeSave(stringifySave(file), oasisOptions);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.snapshot.layers.linked).toBeUndefined();
    const restored = SimulationEngine.fromSnapshot(decoded.snapshot);
    expect(restored.networksDirty).toBe(true);
    expect(restored.world.linked[restored.world.index(8, 14)]).toBe(0);
  });

  it('restores an identical city after a save and load cycle', () => {
    const e = oasisCity();
    const file = encodeSave(e.serialize(), meta, oasisOptions);
    const decoded = decodeSave(stringifySave(file), oasisOptions);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const restored = SimulationEngine.fromSnapshot(decoded.snapshot);
    expect(restored.stats()).toEqual(e.stats());
    expect(restored.ruleset).toBe('oasis');
  });

  it('round-trips the spires above the classic level cap', () => {
    const e = oasisCity();
    const zone = e.buildings.add({
      kind: 'residential',
      x: 20,
      y: 14,
      w: 1,
      h: 1,
      level: 7,
      capacity: 120,
      occupancy: 90,
      condition: 100,
      age: 0,
      abandoned: false,
      emptyMonths: 0,
      variant: 1,
      powered: true,
      watered: true,
      offline: 0,
      attractiveness: 0,
    });
    const file = encodeSave(e.serialize(), meta, oasisOptions);
    const decoded = decodeSave(stringifySave(file), oasisOptions);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const kept = decoded.snapshot.buildings.find((b) => b.id === zone.id);
    expect(kept?.level).toBe(7);
  });
});
