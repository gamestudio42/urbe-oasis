import {
  BEATS_PER_BAR,
  TRACKS,
  barSeconds,
  composeBar,
  midiToHz,
  type NoteEvent,
} from '../../apps/oasis/src/audio/composer';
import { describe, expect, it } from 'vitest';

/** Small deterministic PRNG so the composer's randomness is reproducible in tests. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const voices = (notes: NoteEvent[], voice: string) => notes.filter((n) => n.voice === voice);

describe('oasis desert composer', () => {
  it('keeps every note inside the bar', () => {
    for (const spec of Object.values(TRACKS)) {
      for (let bar = 0; bar < 8; bar++) {
        for (const note of composeBar(spec, bar, seeded(bar + 1))) {
          expect(note.beat).toBeGreaterThanOrEqual(0);
          expect(note.beat).toBeLessThan(BEATS_PER_BAR);
          expect(note.duration).toBeGreaterThan(0);
          expect(note.velocity).toBeGreaterThan(0);
          expect(note.velocity).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('keeps every voice in an audible octave', () => {
    const range: Record<string, [number, number]> = {
      bass: [36, 60],
      pad: [48, 72],
      lead: [64, 86],
      arp: [72, 91],
    };
    for (const spec of Object.values(TRACKS)) {
      for (let bar = 0; bar < 8; bar++) {
        for (const note of composeBar(spec, bar, seeded(bar + 3))) {
          const [low, high] = range[note.voice] as [number, number];
          expect(note.midi).toBeGreaterThanOrEqual(low);
          expect(note.midi).toBeLessThanOrEqual(high);
          expect(midiToHz(note.midi)).toBeGreaterThan(60);
        }
      }
    }
  });

  it('voices the tonic as a minor triad and the VI as a major triad', () => {
    const triad = (bar: number) =>
      voices(composeBar(TRACKS.menu, bar, seeded(1)), 'pad')
        .map((note) => note.midi)
        .sort((a, b) => a - b);
    const tonic = triad(0);
    const sixth = triad(1);
    expect(tonic[1]! - tonic[0]!).toBe(3);
    expect(tonic[2]! - tonic[0]!).toBe(7);
    expect(sixth[1]! - sixth[0]!).toBe(4);
    expect(sixth[2]! - sixth[0]!).toBe(7);
    expect(tonic[0]! % 12).toBe(TRACKS.menu.key % 12);
    expect(sixth[0]! % 12).toBe((TRACKS.menu.key + 8) % 12);
  });

  it('lays down a two-note drone on every bar', () => {
    const notes = composeBar(TRACKS.city, 0, seeded(7));
    const bass = voices(notes, 'bass');
    expect(bass).toHaveLength(2);
    expect(bass[0]?.duration).toBeGreaterThanOrEqual(2);
    expect(bass[1]?.midi).toBe((bass[0]?.midi ?? 0) + 7);
  });

  it('holds a pad triad across the whole bar', () => {
    const notes = composeBar(TRACKS.menu, 0, seeded(3));
    const pad = voices(notes, 'pad');
    expect(pad).toHaveLength(3);
    for (const note of pad) {
      expect(note.beat).toBe(0);
      expect(note.duration).toBe(BEATS_PER_BAR);
    }
  });

  it('only starts lead notes in the second half of the bar', () => {
    for (let bar = 0; bar < 12; bar++) {
      const lead = voices(composeBar(TRACKS.city, bar, seeded(bar)), 'lead');
      for (const note of lead) expect(note.beat).toBeGreaterThanOrEqual(BEATS_PER_BAR / 2);
    }
  });

  it('loops the progression every four bars', () => {
    const spec = TRACKS.menu;
    for (let bar = 0; bar < 4; bar++) {
      const first = composeBar(spec, bar, seeded(11));
      const second = composeBar(spec, bar + spec.progression.length, seeded(11));
      expect(first).toEqual(second);
    }
  });

  it('is deterministic for the same random stream', () => {
    expect(composeBar(TRACKS.city, 3, seeded(42))).toEqual(composeBar(TRACKS.city, 3, seeded(42)));
  });

  it('produces different bars from different streams', () => {
    const a = composeBar(TRACKS.city, 0, seeded(1));
    const b = composeBar(TRACKS.city, 0, seeded(9999));
    expect(a).not.toEqual(b);
  });

  it('stays inside the slow desert tempo range', () => {
    for (const spec of Object.values(TRACKS)) {
      expect(spec.bpm).toBeGreaterThanOrEqual(70);
      expect(spec.bpm).toBeLessThanOrEqual(88);
      expect(barSeconds(spec)).toBeGreaterThan(2.5);
      expect(barSeconds(spec)).toBeLessThan(4);
    }
  });

  it('tunes A4 to 440 Hz and octaves to double', () => {
    expect(midiToHz(69)).toBeCloseTo(440, 5);
    expect(midiToHz(81)).toBeCloseTo(880, 5);
    expect(midiToHz(57)).toBeCloseTo(220, 5);
  });

  it('maps note velocities to a mixable range', () => {
    const notes = composeBar(TRACKS.city, 1, seeded(5));
    for (const note of notes) expect(note.velocity).toBeLessThanOrEqual(1);
    expect(notes.some((n) => n.velocity > 0.8)).toBe(true);
  });
});
