import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  BEATS_PER_BAR,
  PHRASE_BARS,
  TRACKS,
  composeBar,
  midiToHz,
  barSeconds,
} from '../../apps/oasis/src/audio/composer';
import { SoundBoard } from '../../apps/web/src/audio/sound';
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}
describe('Oasis score', () => {
  it('keeps pitched instruments in the track mode and all events in safe ranges', () => {
    for (const spec of Object.values(TRACKS))
      for (let bar = 0; bar < 64; bar++) {
        for (const note of composeBar(spec, bar, seeded(bar + 1))) {
          expect(note.beat).toBeGreaterThanOrEqual(0);
          expect(note.beat).toBeLessThan(BEATS_PER_BAR);
          expect(note.duration).toBeGreaterThan(0);
          expect(note.duration).toBeLessThanOrEqual(4);
          expect(note.velocity).toBeGreaterThan(0);
          expect(note.velocity).toBeLessThanOrEqual(1);
          expect(midiToHz(note.midi)).toBeGreaterThan(60);
          expect(midiToHz(note.midi)).toBeLessThan(2000);
          if (note.voice !== 'drum') expect(spec.scale).toContain((note.midi - spec.tonic) % 12);
        }
      }
  });
  it('leaves breaths between phrases and reduces layers after the climax', () => {
    for (const spec of Object.values(TRACKS)) {
      const end = composeBar(spec, PHRASE_BARS - 1, seeded(42));
      const bloom = composeBar(spec, 10, seeded(42));
      expect(end.some((n) => n.voice === 'lead' || n.voice === 'drum')).toBe(false);
      expect(bloom.some((n) => n.voice === 'lead')).toBe(true);
      expect(bloom.some((n) => n.voice === 'drum')).toBe(true);
      expect(bloom.length).toBeGreaterThan(end.length);
    }
  });
  it('is reproducible while varying consecutive phrases', () => {
    const a = seeded(42),
      b = seeded(42);
    for (let bar = 0; bar < 32; bar++)
      expect(composeBar(TRACKS.city, bar, a)).toEqual(composeBar(TRACKS.city, bar, b));
    expect(composeBar(TRACKS.city, 0, seeded(1))).not.toEqual(
      composeBar(TRACKS.city, 8, seeded(1)),
    );
  });
  it('gives the city a distinct mode and more movement than the menu', () => {
    expect(TRACKS.city.scale).not.toEqual(TRACKS.menu.scale);
    expect(TRACKS.city.bpm).toBeGreaterThan(TRACKS.menu.bpm);
    for (const spec of Object.values(TRACKS)) expect(barSeconds(spec)).toBeGreaterThan(2.5);
    expect(midiToHz(69)).toBe(440);
  });
});

describe('Oasis audio preferences', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('does not inherit or overwrite classic preferences and remembers its own settings', () => {
    const saved = new Map([
      ['cityBuilder.music', '0'],
      ['cityBuilder.muted', '1'],
    ]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => saved.set(key, value),
    });
    const oasis = new SoundBoard({ preferenceScope: 'oasis.audio' });
    expect(oasis.muted).toBe(false);
    expect(oasis.musicEnabled).toBe(true);
    oasis.setMusicEnabled(false);
    oasis.setMuted(true);
    const restored = new SoundBoard({ preferenceScope: 'oasis.audio' });
    expect(restored.musicEnabled).toBe(false);
    expect(restored.muted).toBe(true);
    expect(saved.get('cityBuilder.music')).toBe('0');
    expect(saved.get('cityBuilder.muted')).toBe('1');
    const classic = new SoundBoard();
    expect(classic.muted).toBe(true);
    expect(classic.musicEnabled).toBe(false);
    classic.setMusicEnabled(true);
    expect(saved.get('cityBuilder.music')).toBe('1');
    expect(saved.get('oasis.audio.music')).toBe('0');
  });
});
