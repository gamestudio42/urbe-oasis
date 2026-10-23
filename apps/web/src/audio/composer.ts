import type { Random } from '@view/city';

/**
 * Procedural ambient music, one bar at a time. Pure: no WebAudio, so the rules can be unit
 * tested. Times are in beats from the start of the bar; pitches are MIDI note numbers.
 */

export type TrackId = 'menu' | 'city';
export type VoiceId = 'keys' | 'pad' | 'bass' | 'melody';

export interface Chord {
  /** Chord root in semitones above the key root. */
  root: number;
  /** Chord tones in semitones above the chord root (0 = root). */
  tones: readonly number[];
}

export interface TrackSpec {
  id: TrackId;
  bpm: number;
  /** Pitch class of the key root (0 = C). */
  key: number;
  /** Melody scale in semitones above the key root. */
  scale: readonly number[];
  /** One chord per bar, looped. */
  progression: readonly Chord[];
  /** Chance that an eighth-note slot starts a melody note. */
  melodyDensity: number;
  /** Delay of the off-beat eighths, as a fraction of an eighth. */
  swing: number;
  /** Chance of a softer second chord hit late in the bar. */
  restrike: number;
}

export interface NoteEvent {
  voice: VoiceId;
  midi: number;
  /** Start, in beats from the bar start. */
  beat: number;
  /** Length in beats. */
  length: number;
  /** 0..1 */
  velocity: number;
}

export const BEATS_PER_BAR = 4;
export const MAX_MELODY_NOTES = 4;
export const MELODY_RANGE = { low: 64, high: 84 } as const;

const MAJOR_9 = [0, 4, 7, 11, 14];
const MINOR_9 = [0, 3, 7, 10, 14];
const DOMINANT_9 = [0, 4, 7, 10, 14];
const MAJOR_PENTATONIC = [0, 2, 4, 7, 9];
/** Chord roots sit in this octave (C3..B3); keys voice the chord above it. */
const CHORD_ROOT_LOW = 48;
const STRUM_BEATS = 0.03;

export const TRACKS: Record<TrackId, TrackSpec> = {
  // D major, I – IV – vi – IV: slow and open.
  menu: {
    id: 'menu',
    bpm: 70,
    key: 2,
    scale: MAJOR_PENTATONIC,
    progression: [
      { root: 0, tones: MAJOR_9 },
      { root: 5, tones: MAJOR_9 },
      { root: 9, tones: MINOR_9 },
      { root: 5, tones: MAJOR_9 },
    ],
    melodyDensity: 0.16,
    swing: 0.12,
    restrike: 0.25,
  },
  // F major, ii – V – I – vi: a little busier while building.
  city: {
    id: 'city',
    bpm: 84,
    key: 5,
    scale: MAJOR_PENTATONIC,
    progression: [
      { root: 2, tones: MINOR_9 },
      { root: 7, tones: DOMINANT_9 },
      { root: 0, tones: MAJOR_9 },
      { root: 9, tones: MINOR_9 },
    ],
    melodyDensity: 0.22,
    swing: 0.16,
    restrike: 0.4,
  },
};

export function pitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function chordOf(track: TrackSpec, bar: number): Chord {
  const n = track.progression.length;
  return track.progression[((bar % n) + n) % n] as Chord;
}

/** MIDI note of the chord root, placed in the C3..B3 octave. */
export function chordRootMidi(track: TrackSpec, chord: Chord): number {
  return CHORD_ROOT_LOW + pitchClass(track.key + chord.root);
}

/** Every melody-range note whose pitch class belongs to the track's scale, low to high. */
export function scaleNotes(track: TrackSpec): number[] {
  const classes = new Set(track.scale.map((s) => pitchClass(track.key + s)));
  const notes: number[] = [];
  for (let m = MELODY_RANGE.low; m <= MELODY_RANGE.high; m++) {
    if (classes.has(pitchClass(m))) notes.push(m);
  }
  return notes;
}

function humanize(base: number, random: Random): number {
  return Math.max(0.05, Math.min(1, base + (random() - 0.5) * 0.16));
}

/**
 * Notes of one bar. The same track, bar index and random sequence always give the same notes;
 * the caller owns the generator so consecutive bars draw from one seeded stream.
 */
export function composeBar(track: TrackSpec, bar: number, random: Random): NoteEvent[] {
  const chord = chordOf(track, bar);
  const root = chordRootMidi(track, chord);
  const notes: NoteEvent[] = [];

  // Electric piano: rootless voicing, strummed slightly, with an occasional softer restrike.
  const voicing = chord.tones.filter((t) => t !== 0).map((t) => root + t);
  voicing.forEach((midi, k) => {
    notes.push({
      voice: 'keys',
      midi,
      beat: k * STRUM_BEATS,
      length: 3.5,
      velocity: humanize(0.55, random),
    });
  });
  if (random() < track.restrike) {
    for (const midi of voicing.slice(0, 3)) {
      notes.push({ voice: 'keys', midi, beat: 2.5, length: 1.4, velocity: humanize(0.32, random) });
    }
  }

  // Pad: root, fifth and the third an octave up, held for the whole bar.
  const third = chord.tones[1] ?? 4;
  for (const midi of [root, root + 7, root + third + 12]) {
    notes.push({ voice: 'pad', midi, beat: 0, length: BEATS_PER_BAR, velocity: 0.5 });
  }

  // Bass on beats 1 and 3; the second hit is sometimes the fifth.
  notes.push({ voice: 'bass', midi: root - 12, beat: 0, length: 1.6, velocity: humanize(0.7, random) });
  const second = random() < 0.3 ? root - 12 + 7 : root - 12;
  notes.push({ voice: 'bass', midi: second, beat: 2, length: 1.4, velocity: humanize(0.6, random) });

  // Sparse melody on swung eighths, moving by small steps through the scale.
  const scale = scaleNotes(track);
  const chordClasses = new Set(chord.tones.map((t) => pitchClass(root + t)));
  let index = Math.floor(random() * scale.length);
  let count = 0;
  for (let slot = 0; slot < BEATS_PER_BAR * 2 && count < MAX_MELODY_NOTES; slot++) {
    if (random() >= track.melodyDensity) continue;
    const step = Math.floor(random() * 5) - 2;
    index = Math.max(0, Math.min(scale.length - 1, index + step));
    // Strong eighths prefer a chord tone: nudge to the nearest one in the scale.
    if (slot % 4 === 0 && !chordClasses.has(pitchClass(scale[index] as number))) {
      const up = scale.findIndex((m, i) => i > index && chordClasses.has(pitchClass(m)));
      if (up !== -1) index = up;
    }
    const beat = slot * 0.5 + (slot % 2 === 1 ? track.swing * 0.5 : 0);
    notes.push({
      voice: 'melody',
      midi: scale[index] as number,
      beat,
      length: 0.5 + Math.floor(random() * 3) * 0.5,
      velocity: humanize(0.42, random),
    });
    count++;
  }

  return notes.sort((a, b) => a.beat - b.beat);
}

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}
