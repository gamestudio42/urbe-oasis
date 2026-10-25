import { TICKS_PER_MONTH, type CityStats } from '@city/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TRACKS, composeBar, moodSpec, type Mood } from '../../apps/oasis/src/audio/composer';
import { ramp } from '../../apps/oasis/src/audio/music';
import { STORM_MOOD_TICKS, cityMood } from '../../apps/web/src/audio/mood';
import { SoundBoard } from '../../apps/web/src/audio/sound';

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/** Just the fields the mood reads, on a steady, served city. */
function stats(patch: {
  tick?: number;
  population?: number;
  net?: number;
  water?: number;
  demand?: number;
  shade?: number;
  parched?: number;
  drought?: number;
  oasis?: boolean;
}): CityStats {
  return {
    tick: patch.tick ?? 10 * TICKS_PER_MONTH,
    population: patch.population ?? 800,
    lastMonth: { net: patch.net ?? 200 },
    water: { supply: 1000, demand: patch.demand ?? 500, served: patch.water ?? 0.95 },
    ...(patch.oasis === false
      ? {}
      : {
          oasis: {
            parched: patch.parched ?? 0,
            data: { supply: 1, demand: 1, served: patch.shade ?? 0.9 },
            ...(patch.drought === undefined
              ? {}
              : {
                  journey: {
                    chapter: 3,
                    droughtIn: -1,
                    droughtMonthsLeft: patch.drought,
                    droughtServed: -1,
                    droughtOutcome: -1,
                    reserves: 0,
                    caravanserais: 0,
                  },
                }),
          },
        }),
  } as unknown as CityStats;
}

describe('city mood for the Oasis score', () => {
  it('reads prosperity, calm, scarcity and storms from the statistics', () => {
    expect(cityMood(null, -1)).toBe('calm');
    expect(cityMood(stats({ oasis: false }), -1)).toBe('calm');
    expect(cityMood(stats({}), -1)).toBe('prosperous');
    expect(cityMood(stats({ net: -50 }), -1)).toBe('calm');
    expect(cityMood(stats({ population: 120 }), -1)).toBe('calm');
    expect(cityMood(stats({ water: 0.6 }), -1)).toBe('scarce');
    expect(cityMood(stats({ water: 0.6, demand: 0 }), -1)).toBe('calm');
    expect(cityMood(stats({ parched: 1 }), -1)).toBe('scarce');
    expect(cityMood(stats({ drought: 2 }), -1)).toBe('scarce');
    const tick = 10 * TICKS_PER_MONTH;
    expect(cityMood(stats({ drought: 2 }), tick + 10)).toBe('storm');
    expect(cityMood(stats({}), tick)).toBe('prosperous');
    // A storm window left over from another, later city does not leak in.
    expect(cityMood(stats({}), tick + STORM_MOOD_TICKS + 1)).toBe('prosperous');
  });
});

describe('Oasis score moods', () => {
  const drums = (mood: Mood) => {
    const spec = moodSpec(TRACKS.city, mood);
    let count = 0;
    for (let bar = 0; bar < 16; bar++)
      count += composeBar(spec, bar, seeded(bar + 7)).filter((n) => n.voice === 'drum').length;
    return count;
  };

  it('keeps tempo and tonic, and leaves the menu calm', () => {
    for (const mood of ['calm', 'prosperous', 'scarce', 'storm'] as const) {
      const spec = moodSpec(TRACKS.city, mood);
      expect(spec.bpm).toBe(TRACKS.city.bpm);
      expect(spec.tonic).toBe(TRACKS.city.tonic);
      expect(moodSpec(TRACKS.menu, mood)).toBe(TRACKS.menu);
    }
    expect(moodSpec(TRACKS.city, 'calm')).toBe(TRACKS.city);
  });

  it('drops drums when water is short and drives them through a storm', () => {
    expect(drums('scarce')).toBe(0);
    expect(drums('storm')).toBeGreaterThan(drums('calm'));
    expect(drums('prosperous')).toBeGreaterThan(drums('calm'));
    expect(moodSpec(TRACKS.city, 'scarce').activity).toBeLessThan(TRACKS.city.activity);
    const storm = composeBar(moodSpec(TRACKS.city, 'storm'), 3, seeded(1));
    expect(storm.some((n) => n.voice === 'drum')).toBe(true);
  });

  it('stays repeatable for a seed in every mood', () => {
    for (const mood of ['calm', 'prosperous', 'scarce', 'storm'] as const) {
      const spec = moodSpec(TRACKS.city, mood);
      expect(composeBar(spec, 5, seeded(42))).toEqual(composeBar(spec, 5, seeded(42)));
    }
  });
});

describe('Oasis volume preferences', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('remembers each bus level for Oasis and keeps the classic mix fixed', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    });
    const oasis = new SoundBoard({ preferenceScope: 'oasis.audio' });
    expect(oasis.levels).toEqual({ master: 1, music: 1, effects: 1 });
    oasis.setLevel('music', 0.4);
    oasis.setLevel('effects', 1.7);
    oasis.setLevel('master', -1);
    expect(oasis.levels).toEqual({ master: 0, music: 0.4, effects: 1 });
    expect(new SoundBoard({ preferenceScope: 'oasis.audio' }).levels).toEqual({
      master: 0,
      music: 0.4,
      effects: 1,
    });
    store.set('oasis.audio.volume.music', 'loud');
    expect(new SoundBoard({ preferenceScope: 'oasis.audio' }).levels.music).toBe(1);
    const classic = new SoundBoard();
    classic.setLevel('music', 0.2);
    expect([...store.keys()].filter((k) => k.startsWith('cityBuilder.'))).toEqual([]);
    expect(new SoundBoard().levels).toEqual({ master: 1, music: 1, effects: 1 });
  });

  it('reports the mood it was given, even before audio starts', () => {
    const board = new SoundBoard({ preferenceScope: 'oasis.audio' });
    expect(board.musicStatus().mood).toBe('calm');
    board.setMusicMood('storm');
    expect(board.musicStatus().mood).toBe('storm');
  });
});

describe('portable music ramps', () => {
  const param = (hold: boolean) => {
    const calls: string[] = [];
    const p = {
      value: 0.4,
      cancelScheduledValues: (t: number) => calls.push(`cancel ${t}`),
      setValueAtTime: (v: number, t: number) => calls.push(`set ${v} ${t}`),
      linearRampToValueAtTime: (v: number, t: number) => calls.push(`ramp ${v} ${t}`),
      ...(hold ? { cancelAndHoldAtTime: (t: number) => calls.push(`hold ${t}`) } : {}),
    };
    return { p: p as unknown as AudioParam, calls };
  };

  it('holds the current value in browsers without cancelAndHoldAtTime (Firefox)', () => {
    const firefox = param(false);
    expect(() => ramp(firefox.p, 1, 2, 3)).not.toThrow();
    expect(firefox.calls).toEqual(['cancel 2', 'set 0.4 2', 'ramp 1 5']);
    const chromium = param(true);
    ramp(chromium.p, 1, 2, 3);
    expect(chromium.calls).toEqual(['hold 2', 'ramp 1 5']);
  });
});
