/**
 * A part as the staff plays it: one position per drawn column in expanded density, each with a
 * signature of what a reader would call its content. Ids play no part in a signature, so two parts
 * that read the same sign the same whatever their rows are called.
 */

import { anchoredChords } from "../chords";
import { fretAt, groupNumber, type AnnotationRow, type EventKind, type EventRow } from "../model";

export interface PlayedColumn {
  /** With `repetition`, the key `TabStaff` draws by. Used to place marks, never to compare. */
  eventId: string;
  repetition: number;
  /** Bar in the whole part, as `layoutPart` numbers it: a barline carries the bar it closes. */
  bar: number;
  /** Interned id of the signature. */
  content: number;
  /** Whether it continues the group of the column before it. Not part of the signature. */
  joined: boolean;
  /** What the signature was made from, for the words. Built on demand. */
  parts(): ColumnParts;
}

export interface ColumnParts {
  kind: EventKind;
  /** One entry per string of the tuning: the stored value as text, or null. */
  frets: (string | null)[];
  /** One entry per string: sorted, deduplicated, empty for an unplayed string. */
  techniques: string[][];
  duration: string | null;
  group: string | null;
  chord: string;
}

export const columnKey = (eventId: string, repetition: number): string => `${eventId}-${repetition}`;

function partsOf(
  event: EventRow,
  strings: number,
  repetition: number,
  chords: Map<string, string>,
): ColumnParts {
  if (event.kind === "barline") {
    return { kind: "barline", frets: [], techniques: [], duration: null, group: null, chord: "" };
  }
  const frets: (string | null)[] = [];
  const techniques: string[][] = [];
  for (let i = 0; i < strings; i += 1) {
    const fret = fretAt(event.frets, i);
    frets.push(fret === undefined ? null : String(fret));
    const stored = event.techniques?.[String(i)];
    techniques.push(
      fret === undefined || !Array.isArray(stored) ? [] : [...new Set(stored.map(String))].sort(),
    );
  }
  return {
    kind: event.kind,
    frets,
    techniques,
    duration: event.durationHint ?? null,
    group: event.tupletId
      ? `${event.groupKind ?? "tuplet"}:${groupNumber(event)}`
      : null,
    chord: repetition === 0 ? (chords.get(event.id) ?? "").trim() : "",
  };
}

const KEYS = Array.from({ length: 32 }, (_, i) => String(i));
const keyOf = (i: number) => KEYS[i] ?? String(i);

/**
 * Hands out the id of a signature. `packed`, if given, hands out the id of the plain columns that
 * `pack` can number exactly, from the same counter, so the common column never builds a string.
 */
export type Interner = ((signature: string) => number) & { packed?: (key: number) => number };

const SIMPLE_X = 63;

/**
 * An exact number for a column with nothing but frets (0 to 62, or x) on at most eight strings: two such
 * columns have the same number if and only if they have the same signature. Null for any other column.
 */
function pack(event: EventRow, strings: number): number | null {
  if (strings > 8 || event.durationHint != null || event.tupletId) return null;
  const storedFrets = event.frets;
  const storedTechniques = event.techniques;
  let key = event.kind === "rest" ? 1 : 0;
  for (let i = 0; i < strings; i += 1) {
    const name = keyOf(i);
    const fret = storedFrets[name];
    let digit = 0;
    if (fret !== undefined) {
      if (fret === "x") digit = SIMPLE_X + 1;
      else if (Number.isInteger(fret) && fret >= 0 && fret < SIMPLE_X) digit = fret + 1;
      else return null;
      const stored = storedTechniques?.[name];
      if (Array.isArray(stored) && stored.length > 0) return null;
    }
    key = key * 65 + digit;
  }
  return key;
}

const SEP = "";

/** The text a column's content reduces to. `partsOf` is its readable twin, and a test pins them together. */
export function signatureOf(event: EventRow, strings: number, chord: string): string {
  if (event.kind === "barline") return "barline";
  let frets = "";
  let techniques = "";
  const storedFrets = event.frets;
  const storedTechniques = event.techniques;
  for (let i = 0; i < strings; i += 1) {
    const key = keyOf(i);
    const fret = storedFrets[key];
    if (i > 0) {
      frets += ",";
      techniques += ",";
    }
    if (fret === undefined) continue;
    frets += fret;
    const stored = storedTechniques?.[key];
    if (Array.isArray(stored) && stored.length > 0) {
      techniques += stored.length === 1 ? String(stored[0]) : [...new Set(stored.map(String))].sort().join("+");
    }
  }
  const group = event.tupletId ? `${event.groupKind ?? "tuplet"}:${groupNumber(event)}` : "";
  return event.kind + SEP + frets + SEP + techniques + SEP + (event.durationHint ?? "") + SEP + group + SEP + chord;
}

interface Shared {
  strings: number;
  chords: Map<string, string>;
}

/** One drawn column. A class with few fields, not an object literal with a closure: a part is thousands of them. */
class Column implements PlayedColumn {
  constructor(
    readonly event: EventRow,
    readonly repetition: number,
    readonly bar: number,
    readonly content: number,
    readonly joined: boolean,
    private readonly shared: Shared,
  ) {}

  get eventId(): string {
    return this.event.id;
  }

  parts(): ColumnParts {
    return partsOf(this.event, this.shared.strings, this.repetition, this.shared.chords);
  }
}

export function playedColumns(
  events: readonly EventRow[],
  annotations: readonly AnnotationRow[],
  strings: number,
  intern: Interner,
): PlayedColumn[] {
  const chords = anchoredChords(annotations);
  const shared: Shared = { strings, chords };
  const out: PlayedColumn[] = [];
  let bar = 1;
  let previousGroup: string | null = null;
  for (const event of events) {
    if (event.kind === "barline") {
      out.push(new Column(event, 0, bar, intern("barline"), false, shared));
      previousGroup = null;
      bar += 1;
      continue;
    }
    const repeat = Math.max(1, event.repeat);
    const chord = chords.size === 0 ? "" : (chords.get(event.id) ?? "").trim();
    const packed = intern.packed ? pack(event, strings) : null;
    const plain = packed !== null ? intern.packed!(packed) : intern(signatureOf(event, strings, ""));
    const first = chord === "" ? plain : intern(signatureOf(event, strings, chord));
    for (let repetition = 0; repetition < repeat; repetition += 1) {
      out.push(
        new Column(
          event,
          repetition,
          bar,
          repetition === 0 ? first : plain,
          event.tupletId !== null && previousGroup === event.tupletId,
          shared,
        ),
      );
      previousGroup = event.tupletId;
    }
  }
  return out;
}
