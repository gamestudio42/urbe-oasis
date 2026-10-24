import type { Random } from '@view/city';

/** Original modal desert score. Pure composition, independent of the simulation RNG. */
export type TrackId = 'menu' | 'city';
export type VoiceId = 'bass' | 'pad' | 'lead' | 'arp' | 'drum';
export interface TrackSpec {
  id: TrackId;
  bpm: number;
  /** MIDI tonic, shared by all instruments before octave placement. */
  tonic: number;
  scale: readonly number[];
  activity: number;
}
export interface NoteEvent {
  voice: VoiceId;
  midi: number;
  beat: number;
  duration: number;
  velocity: number;
}
export const BEATS_PER_BAR = 4;
export const PHRASE_BARS = 16;
const DORIAN = [0, 2, 3, 5, 7, 9, 10] as const;
const PENTATONIC = [0, 3, 5, 7, 10] as const;
export const TRACKS: Record<TrackId, TrackSpec> = {
  menu: { id: 'menu', bpm: 72, tonic: 38, scale: PENTATONIC, activity: 0.55 },
  city: { id: 'city', bpm: 82, tonic: 38, scale: DORIAN, activity: 0.8 },
};
// A recurring question and answer, with space at the end of each four-bar phrase.
const MOTIFS = [
  [4, 3, 2],
  [2, 1, 0],
  [0, 2, 3],
  [2, 1, 0],
] as const;
const PLUCK_STEPS = [0, 2, 4, 2, 1, 3, 2, 0] as const;

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}
export function barSeconds(spec: TrackSpec): number {
  return (BEATS_PER_BAR * 60) / spec.bpm;
}

/** Sixteen-bar arc: arrival, movement, bloom, then a sparse return. */
export function composeBar(spec: TrackSpec, bar: number, random: Random): NoteEvent[] {
  const phraseBar = ((bar % PHRASE_BARS) + PHRASE_BARS) % PHRASE_BARS;
  const section = Math.floor(phraseBar / 4);
  const density = [0.5, 0.8, 1, 0.35][section]! * spec.activity;
  const notes: NoteEvent[] = [];
  const add = (voice: VoiceId, midi: number, beat: number, duration: number, velocity: number) =>
    notes.push({ voice, midi, beat, duration, velocity });
  // Open fifths leave room for the modal melody; no imported synthwave chord loop.
  add('bass', spec.tonic, 0, 3.8, 0.65);
  for (const interval of [0, 7]) add('pad', spec.tonic + 12 + interval, 0, 4, 0.32);
  if (section === 2) add('pad', spec.tonic + 22, 0, 4, 0.2);

  for (let step = 0; step < 8; step++) {
    const roll = random();
    if (step !== 0 && roll > density) continue;
    const degree = PLUCK_STEPS[(step + phraseBar) % PLUCK_STEPS.length]!;
    add('arp', spec.tonic + 24 + spec.scale[degree]!, step / 2, 0.45, 0.3 + roll * 0.12);
  }
  // Breath between phrases and a full rest in the final bar.
  if (phraseBar % 4 !== 3) {
    const motif = MOTIFS[section]!;
    motif.forEach((degree, i) => {
      if (section === 0 && i === 2) return;
      add('lead', spec.tonic + 24 + spec.scale[degree]!, 0.5 + i, 0.85, 0.35 + random() * 0.08);
    });
  }
  if (section === 1 || section === 2) {
    add('drum', 45, 0, 0.3, spec.id === 'city' ? 0.5 : 0.25);
    add('drum', 57, 2.5, 0.16, 0.22);
    if (section === 2 && spec.id === 'city') add('drum', 57, 3.5, 0.12, 0.15);
  }
  return notes;
}
