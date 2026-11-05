/**
 * The reading views' cell writer: a fretted note shown as its note name or its interval against the chord
 * in force. It supplies only the pitch text; `layoutWith` keeps bars, repeats, connectors and widths, so
 * a view cannot move a column. React-free. Never reached by the ASCII serialiser or the export.
 */

import { chordsInForce, parseChord, type Chord } from "../chords";
import type { AnnotationRow, EventRow } from "../model";
import { fretAt } from "../model";
import { fretToMidi, type Tuning } from "../tunings";
import { layoutWith, type CellWriter, type LayoutOptions, type TabLayout } from "../tab/layout";
import { degreeName, degreeWords, noteName, noteWords, spellingFor } from "./spelling";
import type { StaffView } from "./view";

export interface ReadingOptions extends LayoutOptions {
  view: Exclude<StaffView, "frets">;
  /** Every event of the part, so a slice reads chords anchored before it. */
  partEvents: readonly EventRow[];
}

export interface ReadingLayout extends TabLayout {
  /** `(Am)`: the chord in force at the first column when that column anchors none, intervals only, else null. */
  carriedChord: string | null;
  /** Of the played, named cells: how many had a readable chord against them. */
  chordCover: "all" | "some" | "none" | "nothing";
}

export function layoutReading(options: ReadingOptions): ReadingLayout {
  const { view, partEvents, tuning, annotations = [] } = options;
  const inForce = chordsInForce(partEvents, annotations as readonly AnnotationRow[]);
  const parsed = new Map<string, Chord | null>();
  const chordFor = (event: EventRow): Chord | null => {
    const symbol = inForce.get(event.id);
    if (symbol === undefined) return null;
    if (!parsed.has(symbol)) parsed.set(symbol, parseChord(symbol));
    return parsed.get(symbol) ?? null;
  };

  let withChord = 0;
  let withoutChord = 0;

  // A fret that is not a non-negative integer has no pitch to name.
  const pitchOf = (event: EventRow, stringIndex: number, tuningRef: Tuning): number | null => {
    const value = fretAt(event.frets, stringIndex);
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
    return ((fretToMidi(tuningRef, stringIndex, value) % 12) + 12) % 12;
  };

  const shownText = (event: EventRow, stringIndex: number, fret: string, stored: readonly string[]) => {
    if (fret === "x") return { text: "x", counted: false };
    if (stored.includes("harmonic")) return { text: "?", counted: false };
    const pitch = pitchOf(event, stringIndex, tuning);
    if (pitch === null) return { text: "?", counted: false };
    const chord = chordFor(event);
    if (view === "intervals" && chord) return { text: degreeName(pitch, chord), counted: true, chord };
    return { text: noteName(pitch, chord, spellingFor(chord, tuning)), counted: true, chord };
  };

  const writer: CellWriter = {
    pitch(event, stringIndex, fret, stored) {
      const shown = shownText(event, stringIndex, fret, stored);
      if (shown.counted) {
        if (view === "intervals") {
          if (shown.chord) withChord += 1;
          else withoutChord += 1;
        }
      }
      return shown.text;
    },
    separator: "·",
    words(event, stringIndex, fret, stored) {
      if (fret === "x") return null;
      const shown = shownText(event, stringIndex, fret, stored);
      if (shown.text === "?") return "no pitch";
      return (view === "intervals" && shown.chord ? degreeWords(shown.text) : noteWords(shown.text)) ?? null;
    },
  };

  const layout = layoutWith(options, writer);

  // The first column to read tells the chord that was already in force when the slice began, as `(Am)`.
  // Intervals only: notes read against no chord. An unreadable one (`N.C.`) is carried too, as it says why
  // the cells are note names. The column widens to hold it, since the chord row truncates and `(A...` says nothing.
  const first = layout.columns.find((column) => column.kind !== "barline");
  let carriedChord: string | null = null;
  if (view === "intervals" && first && first.chord === null) {
    const symbol = inForce.get(first.eventId);
    if (symbol !== undefined) {
      carriedChord = `(${symbol})`;
      first.chord = carriedChord;
      first.width = Math.max(first.width, carriedChord.length);
    }
  }

  const chordCover: ReadingLayout["chordCover"] =
    withChord + withoutChord === 0
      ? "nothing"
      : withoutChord === 0
        ? "all"
        : withChord === 0
          ? "none"
          : "some";

  return { ...layout, carriedChord, chordCover };
}
