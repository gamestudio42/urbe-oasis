import { createEngine } from '@city/simulation';
import { describe, expect, it } from 'vitest';

describe('hub staffing reaches the UI mirror', () => {
  it('reports a service building again when it is staffed after an outage', () => {
    const e = createEngine({
      seed: 'hub-sync',
      size: 24,
      ruleset: 'oasis',
      funds: 50_000,
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    });
    expect(e.execute({ type: 'road', x0: 2, y0: 10, x1: 20, y1: 10 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'windTurbine', x: 4, y: 8 }).ok).toBe(true);
    expect(e.execute({ type: 'place', kind: 'caravanserai', x: 5, y: 8 }).ok).toBe(true);
    e.refreshUtilities();
    const serai = e.buildings.ofKind('caravanserai')[0]!;
    expect(serai.occupancy).toBeGreaterThan(0);
    e.buildings.takeChanges();

    // A storm buries it, then it reopens: the solver changes staffing both times.
    serai.offline = 5;
    e.refreshUtilities();
    expect(serai.occupancy).toBe(0);
    expect(e.buildings.takeChanges().changed.map((b) => b.id)).toContain(serai.id);
    serai.offline = 0;
    e.refreshUtilities();
    expect(serai.occupancy).toBe(serai.capacity);
    const reopened = e.buildings.takeChanges().changed.find((b) => b.id === serai.id);
    expect(reopened?.occupancy).toBe(serai.capacity);

    // Nothing changed: no needless delta.
    e.refreshUtilities();
    expect(e.buildings.takeChanges().changed.map((b) => b.id)).not.toContain(serai.id);
  });
});
