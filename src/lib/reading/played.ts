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

const SEP = "";

/** The text a column's content reduces to. `partsOf` is its readable twin, and a test pins them together. */
export function signatureOf(event: EventRow, strings: number, chord: string): string {
  if (event.kind === "barline") return "barline";
  let frets = "";
  let techniques = "";
  for (let i = 0; i < strings; i += 1) {
    const fret = fretAt(event.frets, i);
    const stored = event.techniques?.[String(i)];
    if (i > 0) {
      frets += ",";
      techniques += ",";
    }
    if (fret === undefined) continue;
    frets += String(fret);
    if (Array.isArray(stored) && stored.length > 0) {
      techniques += [...new Set(stored.map(String))].sort().join("+");
    }
  }
  const group = event.tupletId ? `${event.groupKind ?? "tuplet"}:${groupNumber(event)}` : "";
  return [event.kind, frets, techniques, event.durationHint ?? "", group, chord].join(SEP);
}

export function playedColumns(
  events: readonly EventRow[],
  annotations: readonly AnnotationRow[],
  strings: number,
  intern: (signature: string) => number,
): PlayedColumn[] {
  const chords = anchoredChords(annotations);
  const out: PlayedColumn[] = [];
  let bar = 1;
  let previousGroup: string | null = null;
  for (const event of events) {
    if (event.kind === "barline") {
      out.push({
        eventId: event.id,
        repetition: 0,
        bar,
        content: intern("barline"),
        joined: false,
        parts: () => partsOf(event, strings, 0, chords),
      });
      previousGroup = null;
      bar += 1;
      continue;
    }
    const repeat = Math.max(1, event.repeat);
    const chord = (chords.get(event.id) ?? "").trim();
    const plain = intern(signatureOf(event, strings, ""));
    const first = chord === "" ? plain : intern(signatureOf(event, strings, chord));
    for (let repetition = 0; repetition < repeat; repetition += 1) {
      out.push({
        eventId: event.id,
        repetition,
        bar,
        content: repetition === 0 ? first : plain,
        joined: event.tupletId !== null && previousGroup === event.tupletId,
        parts: () => partsOf(event, strings, repetition, chords),
      });
      previousGroup = event.tupletId;
    }
  }
  return out;
}
