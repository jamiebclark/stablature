/**
 * How a pitch class is spelt for reading: a note name or a chord degree. React-free.
 *
 * Names carry no octave -- the string says which octave, as the staff's own labels do. The spelling follows
 * the chord in force when there is a readable one (the b3 of Cm is `Eb`), otherwise the tuning's own
 * accidentals, otherwise sharps.
 */

import type { Chord } from "../chords";
import { midiToNote } from "../pitch";
import type { Tuning } from "../tunings";

export type Spelling = "sharp" | "flat";

/** Degrees as a chord chart folds them into one octave, indexed by semitones above the root. */
export const FOLDED_DEGREES: readonly string[] = [
  "1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7",
];

const hasFlat = (name: string) => name.slice(1).includes("b");

export function spellingFor(chord: Chord | null, tuning: Tuning): Spelling {
  if (chord) return chord.tones.some((tone) => hasFlat(tone.name)) ? "flat" : "sharp";
  return tuning.strings.some((string) => hasFlat(string.note)) ? "flat" : "sharp";
}

export function noteName(pitchClass: number, chord: Chord | null, spelling: Spelling): string {
  if (chord) {
    if (chord.bass === pitchClass && chord.bassName) return chord.bassName;
    const tone = chord.tones.find((t) => t.pitchClass === pitchClass);
    if (tone) return tone.name;
  }
  return midiToNote(pitchClass, spelling).note;
}

export function degreeName(pitchClass: number, chord: Chord): string {
  const tone = chord.tones.find((t) => t.pitchClass === pitchClass);
  if (tone) return tone.degree;
  return FOLDED_DEGREES[(((pitchClass - chord.root) % 12) + 12) % 12];
}

const ACCIDENTAL_WORDS: Record<string, string> = { "#": "sharp", b: "flat", bb: "double flat", "##": "double sharp" };
const DEGREE_WORDS: Record<string, string> = {
  "1": "root", "2": "second", "3": "third", "4": "fourth", "5": "fifth", "6": "sixth", "7": "seventh",
  "9": "ninth", "11": "eleventh", "13": "thirteenth",
};

/** `C#` -> "C sharp". Null when the text is not a note name. */
export function noteWords(name: string): string | null {
  const match = /^([A-G])(#{0,2}|b{0,2})$/.exec(name);
  if (!match) return null;
  return match[2] ? `${match[1]} ${ACCIDENTAL_WORDS[match[2]]}` : match[1];
}

/** `b3` -> "flat third". Null when the text is not a degree. */
export function degreeWords(degree: string): string | null {
  const match = /^(bb|b|#)?(\d+)$/.exec(degree);
  if (!match || !DEGREE_WORDS[match[2]]) return null;
  const base = DEGREE_WORDS[match[2]];
  return match[1] ? `${ACCIDENTAL_WORDS[match[1]]} ${base}` : base;
}
