import { describe, expect, it } from 'vitest';
import {
  BEATS_PER_BAR,
  chordOf,
  chordRootMidi,
  composeBar,
  MAX_MELODY_NOTES,
  MELODY_RANGE,
  midiToHz,
  pitchClass,
  TRACKS,
  type NoteEvent,
  type TrackSpec,
} from '../../apps/web/src/audio/composer';
import { createRandom } from '../../packages/view-city/src/animation/random';

const BARS = 64;

function compose(track: TrackSpec, seed: number, bars = BARS): NoteEvent[][] {
  const random = createRandom(seed);
  return Array.from({ length: bars }, (_, bar) => composeBar(track, bar, random));
}

describe.each(Object.values(TRACKS))('composer: $id track', (track) => {
  const bars = compose(track, 7);

  it('is deterministic for a seed and varies across seeds', () => {
    expect(compose(track, 7)).toEqual(bars);
    expect(compose(track, 8)).not.toEqual(bars);
  });

  it('keeps every note inside the bar with a valid velocity', () => {
    for (const notes of bars) {
      for (const n of notes) {
        expect(n.beat).toBeGreaterThanOrEqual(0);
        expect(n.beat).toBeLessThan(BEATS_PER_BAR);
        expect(n.length).toBeGreaterThan(0);
        expect(n.velocity).toBeGreaterThan(0);
        expect(n.velocity).toBeLessThanOrEqual(1);
      }
    }
  });

  it('plays only chord tones on the keys and the pad', () => {
    bars.forEach((notes, bar) => {
      const chord = chordOf(track, bar);
      const root = chordRootMidi(track, chord);
      const classes = new Set(chord.tones.map((t) => pitchClass(root + t)));
      for (const n of notes.filter((x) => x.voice === 'keys' || x.voice === 'pad')) {
        expect(classes.has(pitchClass(n.midi))).toBe(true);
      }
    });
  });

  it('puts the bass on beats 1 and 3, on the chord root or fifth', () => {
    bars.forEach((notes, bar) => {
      const root = chordRootMidi(track, chordOf(track, bar));
      const bass = notes.filter((n) => n.voice === 'bass');
      expect(bass.map((n) => n.beat)).toEqual([0, 2]);
      expect(bass[0]?.midi).toBe(root - 12);
      expect([root - 12, root - 5]).toContain(bass[1]?.midi);
    });
  });

  it('writes a sparse melody from the scale, inside its range', () => {
    const scale = new Set(track.scale.map((s) => pitchClass(track.key + s)));
    let total = 0;
    for (const notes of bars) {
      const melody = notes.filter((n) => n.voice === 'melody');
      expect(melody.length).toBeLessThanOrEqual(MAX_MELODY_NOTES);
      total += melody.length;
      for (const n of melody) {
        expect(scale.has(pitchClass(n.midi))).toBe(true);
        expect(n.midi).toBeGreaterThanOrEqual(MELODY_RANGE.low);
        expect(n.midi).toBeLessThanOrEqual(MELODY_RANGE.high);
      }
    }
    // Around melodyDensity × 8 eighths per bar: present, but never busy.
    const perBar = total / bars.length;
    expect(perBar).toBeGreaterThan(track.melodyDensity * 8 * 0.5);
    expect(perBar).toBeLessThan(track.melodyDensity * 8 * 1.5);
  });

  it('keeps the progression in the key', () => {
    const major = new Set([0, 2, 4, 5, 7, 9, 11].map((s) => pitchClass(track.key + s)));
    for (const chord of track.progression) {
      const root = chordRootMidi(track, chord);
      for (const tone of chord.tones) expect(major.has(pitchClass(root + tone))).toBe(true);
    }
  });
});

describe('composer tracks', () => {
  it('has a slower menu track than the city track', () => {
    expect(TRACKS.menu.bpm).toBeLessThan(TRACKS.city.bpm);
    expect(TRACKS.menu.bpm).toBeGreaterThanOrEqual(60);
    expect(TRACKS.city.bpm).toBeLessThanOrEqual(96);
  });

  it('converts MIDI notes to frequencies', () => {
    expect(midiToHz(69)).toBeCloseTo(440, 6);
    expect(midiToHz(57)).toBeCloseTo(220, 6);
    expect(midiToHz(60)).toBeCloseTo(261.6256, 3);
  });
});
