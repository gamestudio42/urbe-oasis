import { ZoneDensity, ZoneType, type Command } from '@city/shared';
import { createEngine } from '@city/simulation';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameSession } from '../../apps/web/src/state/session';
import {
  OASIS_TUTORIAL_CHECKS,
  markTutorialDone,
  tutorialDone,
} from '../../apps/web/src/state/tutorial';
import { catalog, setCatalogOverride } from '../../apps/web/src/i18n';

afterEach(() => {
  vi.unstubAllGlobals();
  setCatalogOverride('en', {});
});

describe('oasis founding tutorial', () => {
  it('can fund and complete water, shade, settlement and storage with the normal starting budget', () => {
    const engine = createEngine({
      seed: 'oasis-founding',
      size: 24,
      ruleset: 'oasis',
      funds: 10_000,
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    });
    engine.disastersEnabled = false;
    const session = {
      client: {
        world: engine.world,
        get stats() {
          return engine.stats();
        },
      },
    } as GameSession;
    const done = (step: number) => OASIS_TUTORIAL_CHECKS[step]?.(session);
    const build = (command: Command) => expect(engine.execute(command).ok).toBe(true);
    build({ type: 'road', x0: 0, y0: 10, x1: 16, y1: 10 });
    build({
      type: 'zone',
      zone: ZoneType.Residential,
      density: ZoneDensity.Light,
      x0: 8,
      y0: 9,
      x1: 10,
      y1: 9,
    });
    build({
      type: 'zone',
      zone: ZoneType.Industrial,
      density: ZoneDensity.Light,
      x0: 12,
      y0: 11,
      x1: 14,
      y1: 11,
    });
    expect(done(2)).toBe(true);
    expect(done(3)).toBe(true);
    expect(done(4)).toBe(false);
    build({ type: 'place', kind: 'gasPlant', x: 4, y: 7 });
    build({ type: 'powerLine', x0: 5, y0: 8, x1: 13, y1: 11 });
    engine.refreshUtilities();
    expect(done(4)).toBe(true);
    expect(done(5)).toBe(false);
    build({ type: 'place', kind: 'qanat', x: 4, y: 5 });
    build({ type: 'pipe', x0: 5, y0: 6, x1: 9, y1: 9 });
    engine.refreshUtilities();
    expect(done(5)).toBe(true);
    expect(done(6)).toBe(false);
    build({ type: 'place', kind: 'palm', x: 11, y: 7 });
    build({ type: 'canal', x0: 11, y0: 8, x1: 10, y1: 9 });
    engine.refreshUtilities();
    expect(done(6)).toBe(true);
    expect(done(8)).toBe(false);
    build({ type: 'place', kind: 'cistern', x: 8, y: 6 });
    build({ type: 'powerLine', x0: 8, y0: 7, x1: 8, y1: 8 });
    engine.runMonths(12);
    expect(done(1)).toBe(true);
    expect(done(7)).toBe(true);
    expect(done(8)).toBe(true);
    expect(engine.economy.funds).toBeGreaterThan(0);
  });

  it('does not confuse empty cities or different homes with a watered, shaded residential lot', () => {
    const engine = createEngine({
      seed: 'separate-networks',
      size: 24,
      ruleset: 'oasis',
      terrain: { flat: true, water: 0, hills: 0, forest: 0, rivers: 0 },
    });
    const session = { client: { world: engine.world, stats: engine.stats() } } as GameSession;
    expect(OASIS_TUTORIAL_CHECKS[5]?.(session)).toBe(false);
    const a = engine.world.index(5, 5),
      b = engine.world.index(6, 5);
    engine.world.zone[a] = engine.world.zone[b] = ZoneType.Residential;
    engine.world.watered[a] = 1;
    engine.world.linked[b] = 1;
    expect(OASIS_TUTORIAL_CHECKS[6]?.(session)).toBe(false);
    engine.world.linked[a] = 1;
    expect(OASIS_TUTORIAL_CHECKS[6]?.(session)).toBe(true);
  });

  it('keeps tutorial completion independent from classic cities', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    markTutorialDone('classic');
    expect(tutorialDone('classic')).toBe(true);
    expect(tutorialDone('oasis')).toBe(false);
    markTutorialDone('oasis');
    expect(tutorialDone('oasis')).toBe(true);
  });

  it('replaces ordered tutorial copy with a real array, including a different step count', () => {
    const steps = Array.from({ length: 10 }, (_, i) => ({
      title: `Step ${i}`,
      text: 'Instruction',
    }));
    setCatalogOverride('en', { tutorial: { steps } });
    expect(Array.isArray(catalog('en').tutorial.steps)).toBe(true);
    expect(catalog('en').tutorial.steps).toEqual(steps);
    setCatalogOverride('en', {});
    expect(catalog('en').tutorial.steps).toHaveLength(7);
  });
});
