import { describe, expect, it } from 'vitest';
import {
  OasisPresentation,
  OASIS_SIGNAL_LIMIT,
} from '../../packages/view-city/src/oasisPresentation';
import { appendOasisDispatches } from '../../apps/web/src/state/oasisDispatches';
import type { SimEvent } from '@city/shared';

const storm = { type: 'sandstorm', x: 12, y: 14, kind: 'haboob', blocked: false } as const;

describe('oasis event presentation', () => {
  it('freezes while paused, fades and expires without replaying background time', () => {
    const state = new OasisPresentation();
    state.report(storm);
    state.advance(50_000, false, true);
    expect(state.stormAge).toBe(1);
    const intensity = state.intensity;
    state.advance(1000, true, true);
    expect(state.intensity).toBe(intensity);
    for (let i = 0; i < 160; i++) state.advance(100, false, true);
    expect(state.signals).toHaveLength(0);
    expect(state.intensity).toBe(0);
  });

  it('bounds the signal pool and clears effects when animation is disabled', () => {
    const state = new OasisPresentation();
    for (let x = 0; x < 100; x++) state.report({ ...storm, x });
    expect(state.signals).toHaveLength(OASIS_SIGNAL_LIMIT);
    expect(state.signals.at(-1)?.event.x).toBe(99);
    state.advance(100, true, false);
    expect(state.signals).toHaveLength(0);
    expect(state.intensity).toBe(0);
  });

  it('shows a gentler dust front for a successfully defended service', () => {
    const hit = new OasisPresentation(),
      blocked = new OasisPresentation();
    hit.report(storm);
    blocked.report({ ...storm, blocked: true });
    for (let i = 0; i < 20; i++) {
      hit.advance(100, false, true);
      blocked.advance(100, false, true);
    }
    expect(hit.intensity).toBe(1);
    expect(blocked.intensity).toBe(0.55);
  });

  it('keeps the storm ahead of its spring nudge and groups caravan bursts without mutating events', () => {
    const events: SimEvent[] = [
      storm,
      { type: 'springMoved', x: 10, y: 10 },
      { type: 'caravanTrade', caravan: 1, x: 8, y: 8 },
      { type: 'caravanTrade', caravan: 2, x: 9, y: 8 },
      { type: 'brownout' },
    ];
    const original = structuredClone(events);
    const entries = appendOasisDispatches([], events, 120);
    expect(entries).toHaveLength(3);
    expect(entries[0]?.event).toEqual(storm);
    expect(entries.find((e) => e.event.type === 'caravanTrade')?.count).toBe(2);
    expect(events).toEqual(original);
    let log = entries;
    for (let i = 0; i < 20; i++) log = appendOasisDispatches(log, [storm], 240 + i);
    expect(log).toHaveLength(12);
    expect(new Set(log.map((e) => e.id)).size).toBe(12);
    expect(entries).toHaveLength(3);
  });
});
