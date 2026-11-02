/**
 * Pitch arithmetic for tunings and fretboards.
 *
 * Everything reduces to MIDI note numbers in scientific pitch notation
 * (C4 = 60, so a standard bass low E is E1 = 28 and a 5-string low B is
 * B0 = 23). Storing tunings as note+octave keeps them human-readable in the
 * database, and converting to MIDI on demand is what lets the app answer
 * "which notes are under my hand right now" for the chord-reference feature.
 */

export const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

/** Semitones above C for every spelling we accept, including double accidentals. */
const PITCH_CLASS: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

export interface Note {
  /** Note name with optional accidentals, e.g. "E", "F#", "Bb". */
  note: string;
  /** Scientific pitch octave. A standard bass low E is octave 1. */
  octave: number;
}

/** Semitone offset of a note name from C, accidentals included. */
export function pitchClass(note: string): number {
  const match = /^([A-Ga-g])([#b]*)$/.exec(note.trim());
  if (!match) throw new SyntaxError(`Unrecognised note name: ${JSON.stringify(note)}`);
  const [, letter, accidentals] = match;
  let semitones = PITCH_CLASS[letter.toUpperCase()];
  for (const accidental of accidentals) {
    semitones += accidental === "#" ? 1 : -1;
  }
  // Double flats on C can go negative; wrap into 0..11.
  return ((semitones % 12) + 12) % 12;
}

export function noteToMidi({ note, octave }: Note): number {
  return (octave + 1) * 12 + pitchClass(note);
}

export function midiToNote(midi: number, spelling: "sharp" | "flat" = "sharp"): Note {
  const names = spelling === "sharp" ? SHARP_NAMES : FLAT_NAMES;
  return {
    note: names[((midi % 12) + 12) % 12],
    octave: Math.floor(midi / 12) - 1,
  };
}

/** "E1", "F#2" -- the label drawn at the left edge of the tab staff. */
export function noteLabel({ note, octave }: Note): string {
  return `${note}${octave}`;
}

export function parseNoteLabel(label: string): Note {
  const match = /^([A-Ga-g][#b]*)(-?\d+)$/.exec(label.trim());
  if (!match) throw new SyntaxError(`Unrecognised note label: ${JSON.stringify(label)}`);
  const [, note, octave] = match;
  return { note: note[0].toUpperCase() + note.slice(1), octave: Number.parseInt(octave, 10) };
}

export function transposeNote(note: Note, semitones: number): Note {
  return midiToNote(noteToMidi(note) + semitones);
}
