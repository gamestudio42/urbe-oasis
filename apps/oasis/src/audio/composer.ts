import type { Random } from '@view/city';

/**
 * Desert composer for Urbe Oasis. Pure: no WebAudio, so the rules are unit tested.
 *
 * The shape mirrors the Urbe composer (one bar at a time, notes in MIDI, times in beats) but the
 * mood is slower: natural minor, 76-84 bpm, a two-note drone (root then fifth), a held triad,
 * a sparse arpeggio and a lead hook on the second half of the bar.
 *
 * Pitch classes are not MIDI notes. Each voice is placed at or above its own floor, so the bass
 * sits around C2 and the lead around E4 instead of falling below the audible range.
 */

export type TrackId = 'menu' | 'city';
export type VoiceId = 'bass' | 'pad' | 'lead' | 'arp';

export interface Chord {
  /** Chord root in semitones above the key root. */
  root: number;
  /** Chord tones above the chord root (0 = root). */
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
  /** Chance an eighth-note slot starts a lead note. */
  leadDensity: number;
  /** Chance an eighth-note slot starts an arpeggio note. */
  arpDensity: number;
  /** Backbeat gate: how long the snare burst lasts, in beats. */
  gate: number;
}

export interface NoteEvent {
  voice: VoiceId;
  midi: number;
  /** Start, in beats from the bar start. */
  beat: number;
  /** Length in beats. */
  duration: number;
  /** Velocity 0..1. */
  velocity: number;
}

export const BEATS_PER_BAR = 4;
/** Eighth notes per bar. */
const EIGHTHS = 8;
/** Natural minor: the synthwave default. */
const MINOR = [0, 2, 3, 5, 7, 8, 10] as const;

const MINOR_TRIAD = [0, 3, 7] as const;
const MAJOR_TRIAD = [0, 4, 7] as const;

/**
 * Lowest MIDI note of a voice. A pitch class is placed in the octave that starts here, then
 * chord tones stack above that root.
 */
const VOICE_FLOOR: Record<VoiceId, number> = {
  bass: 36,
  pad: 48,
  lead: 64,
  arp: 72,
};

/** i – VI – III – VII. Roots are semitones above the key; tones are above the chord root. */
const MINOR_LOOP: readonly Chord[] = [
  { root: 0, tones: MINOR_TRIAD },
  { root: 8, tones: MAJOR_TRIAD },
  { root: 3, tones: MAJOR_TRIAD },
  { root: 10, tones: MAJOR_TRIAD },
];

/** Pitch class `semitones` above C, placed in the octave that starts at `floor`. */
function placed(semitones: number, floor: number): number {
  const pitchClass = ((semitones % 12) + 12) % 12;
  return floor + pitchClass;
}

export const TRACKS: Record<TrackId, TrackSpec> = {
  menu: {
    id: 'menu',
    bpm: 76,
    key: 9,
    scale: MINOR,
    progression: MINOR_LOOP,
    leadDensity: 0.22,
    arpDensity: 0.5,
    gate: 0.5,
  },
  city: {
    id: 'city',
    bpm: 84,
    key: 4,
    scale: MINOR,
    progression: MINOR_LOOP,
    leadDensity: 0.3,
    arpDensity: 0.7,
    gate: 0.4,
  },
};

/** 440 Hz at MIDI 69, equal temperament. */
export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Picks a lead tone in the lead octave, biased to chord tones on strong beats. */
function pickTone(random: Random, spec: TrackSpec, chord: Chord, strong: boolean): number {
  const root = placed(spec.key + chord.root, VOICE_FLOOR.lead);
  if (strong) {
    const tone = chord.tones[Math.min(chord.tones.length - 1, Math.floor(random() * chord.tones.length))] as number;
    return root + tone;
  }
  const degree = spec.scale[Math.min(spec.scale.length - 1, Math.floor(random() * spec.scale.length))] as number;
  return root + degree;
}

/**
 * One bar of notes. Deterministic for a given `random` stream, so a unit test can assert the
 * groove and a reload of the same seed sounds identical.
 */
export function composeBar(spec: TrackSpec, bar: number, random: Random): NoteEvent[] {
  const chord = spec.progression[bar % spec.progression.length] as Chord;
  const notes: NoteEvent[] = [];
  const bassRoot = placed(spec.key + chord.root, VOICE_FLOOR.bass);
  const padRoot = placed(spec.key + chord.root, VOICE_FLOOR.pad);
  const arpRoot = placed(spec.key + chord.root, VOICE_FLOOR.arp);

  // Bass: a slow drone on the root, then the fifth. Two notes across the bar.
  notes.push({
    voice: 'bass',
    midi: bassRoot,
    beat: 0,
    duration: 2,
    velocity: 0.85,
  });
  notes.push({
    voice: 'bass',
    midi: bassRoot + 7,
    beat: 2,
    duration: 2,
    velocity: 0.55,
  });

  // Pad: a held triad across the bar, an octave above the bass floor.
  for (const tone of chord.tones) {
    notes.push({
      voice: 'pad',
      midi: padRoot + tone,
      beat: 0,
      duration: BEATS_PER_BAR,
      velocity: 0.5,
    });
  }

  // Arpeggio: the same triad two octaves above the pad.
  for (let step = 0; step < EIGHTHS; step++) {
    if (random() >= spec.arpDensity) continue;
    const tone = chord.tones[Math.min(chord.tones.length - 1, Math.floor(random() * chord.tones.length))] as number;
    notes.push({
      voice: 'arp',
      midi: arpRoot + tone,
      beat: step / 2,
      duration: 0.35,
      velocity: 0.32,
    });
  }

  // Lead: sparse, mostly on the second half of the bar.
  for (let step = 4; step < EIGHTHS; step++) {
    if (random() >= spec.leadDensity) continue;
    notes.push({
      voice: 'lead',
      midi: pickTone(random, spec, chord, step % 2 === 0),
      beat: step / 2,
      duration: 0.9,
      velocity: 0.4,
    });
  }
  return notes;
}

/** Deterministic bar length in seconds. */
export function barSeconds(spec: TrackSpec): number {
  return (BEATS_PER_BAR * 60) / spec.bpm;
}
