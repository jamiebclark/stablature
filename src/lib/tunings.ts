/**
 * Tunings, and the fretboard geometry that follows from them.
 *
 * A tuning owns the string count -- a 5-string bass is not a setting on the
 * song, it is a consequence of being tuned BEADG. Bands keep several and pick
 * a default, because a band that plays in Drop A does not want to re-enter it
 * for every song.
 *
 * String index 0 is the HIGHEST-pitched string, which is the opposite of the
 * usual convention and deliberate: bass extensions go *downward* (4-string
 * EADG becomes 5-string BEADG by adding a low B), so numbering from the top
 * means changing string count never renumbers the notes already captured. It
 * also matches render order, since tab draws the highest string on top.
 */

import { noteLabel, noteToMidi, transposeNote, type Note } from "./pitch";

export interface Tuning {
  /** Highest-pitched string first. */
  strings: Note[];
}

export interface TuningPreset extends Tuning {
  id: string;
  name: string;
  /** Shown as a group heading in the picker. */
  family: "Bass 4" | "Bass 5" | "Bass 6" | "Guitar 6" | "Guitar 7";
}

const n = (label: string): Note => {
  const match = /^([A-G][#b]?)(-?\d+)$/.exec(label);
  if (!match) throw new SyntaxError(`Bad preset note: ${label}`);
  return { note: match[1], octave: Number.parseInt(match[2], 10) };
};

const preset = (
  id: string,
  name: string,
  family: TuningPreset["family"],
  labels: string[],
): TuningPreset => ({ id, name, family, strings: labels.map(n) });

/**
 * Deliberately weighted toward what metal bands actually use. Every entry is
 * written highest string first, matching the storage order.
 */
export const TUNING_PRESETS: TuningPreset[] = [
  preset("bass4-e", "E Standard", "Bass 4", ["G2", "D2", "A1", "E1"]),
  preset("bass4-drop-d", "Drop D", "Bass 4", ["G2", "D2", "A1", "D1"]),
  preset("bass4-d", "D Standard", "Bass 4", ["F2", "C2", "G1", "D1"]),
  preset("bass4-drop-c", "Drop C", "Bass 4", ["F2", "C2", "G1", "C1"]),
  preset("bass4-c", "C Standard", "Bass 4", ["Eb2", "Bb1", "F1", "C1"]),
  preset("bass4-drop-b", "Drop B", "Bass 4", ["Eb2", "Bb1", "F1", "B0"]),

  preset("bass5-b", "B Standard", "Bass 5", ["G2", "D2", "A1", "E1", "B0"]),
  preset("bass5-drop-a", "Drop A", "Bass 5", ["G2", "D2", "A1", "E1", "A0"]),
  preset("bass5-a", "A Standard", "Bass 5", ["F2", "C2", "G1", "D1", "A0"]),
  preset("bass5-drop-g", "Drop G", "Bass 5", ["F2", "C2", "G1", "D1", "G0"]),
  preset("bass5-g", "G Standard", "Bass 5", ["Eb2", "Bb1", "F1", "C1", "G0"]),
  preset("bass5-drop-f", "Drop F", "Bass 5", ["Eb2", "Bb1", "F1", "C1", "F0"]),

  preset("bass6-b", "B Standard", "Bass 6", ["C3", "G2", "D2", "A1", "E1", "B0"]),
  preset("bass6-drop-a", "Drop A", "Bass 6", ["C3", "G2", "D2", "A1", "E1", "A0"]),

  preset("guitar6-e", "E Standard", "Guitar 6", ["E4", "B3", "G3", "D3", "A2", "E2"]),
  preset("guitar6-drop-c", "Drop C", "Guitar 6", ["D4", "A3", "F3", "C3", "G2", "C2"]),
  preset("guitar7-b", "B Standard", "Guitar 7", ["E4", "B3", "G3", "D3", "A2", "E2", "B1"]),
];

export const DEFAULT_PRESET_ID = "bass5-b";

export function presetById(id: string): TuningPreset | undefined {
  return TUNING_PRESETS.find((p) => p.id === id);
}

export function stringCount(tuning: Tuning): number {
  return tuning.strings.length;
}

/** Labels top-to-bottom, i.e. in render order. */
export function stringLabels(tuning: Tuning): string[] {
  return tuning.strings.map(noteLabel);
}

/**
 * Pitch of a fretted note. `fret` 0 is the open string.
 *
 * This is the one function the fretboard grid and any future chord-reference
 * view both depend on, so it stays trivially simple on purpose.
 */
export function fretToMidi(tuning: Tuning, stringIndex: number, fret: number): number {
  const open = tuning.strings[stringIndex];
  if (!open) {
    throw new RangeError(
      `String ${stringIndex} does not exist in a ${stringCount(tuning)}-string tuning`,
    );
  }
  if (!Number.isInteger(fret) || fret < 0) {
    throw new RangeError(`Fret must be a non-negative integer, got ${fret}`);
  }
  return noteToMidi(open) + fret;
}

/** Move a whole tuning by some semitones -- "tune the whole thing down a step". */
export function transposeTuning(tuning: Tuning, semitones: number): Tuning {
  return { strings: tuning.strings.map((s) => transposeNote(s, semitones)) };
}

/**
 * True when two tunings sound the same, regardless of how the notes are spelt.
 * Used to warn before a song's tuning is swapped for one that would silently
 * change every pitch already captured.
 */
export function sameTuning(a: Tuning, b: Tuning): boolean {
  if (a.strings.length !== b.strings.length) return false;
  return a.strings.every((s, i) => noteToMidi(s) === noteToMidi(b.strings[i]));
}
