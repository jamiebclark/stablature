/**
 * Turns stored events into something drawable.
 *
 * This is the one place that knows how a part becomes columns on a page, and
 * it is deliberately free of React. `layoutWith` is the one builder: `layoutPart` calls it with the fret
 * writer, which is what the on-screen staff in frets and the ASCII serialiser (also how the renderer is
 * tested) draw; `reading/labels.ts` calls it with a note or interval writer for the reading views. Only
 * the cell's pitch text differs between them, so widths, repeats and positions cannot drift apart.
 * The ASCII serialiser and the export never take a writer: they always draw frets.
 *
 * The two jobs that are not obvious:
 *
 *  - **Repeats.** A run of identical hits is stored as one row with
 *    `repeat: 8`, because that is overwhelmingly the common case in this
 *    music. Expanded density unrolls it into eight columns; compact density
 *    keeps one column labelled `7x8`. Same data, and the choice is the user's.
 *
 *  - **Bars.** Barlines are stored events, never inferred from durations.
 *    Numbering them here is what gives the arrangement's `fromBar`/`toBar`
 *    ("C, first half") a stable meaning that survives editing the notes
 *    inside a bar.
 */

import { fretAt, groupNumber, type AnnotationRow, type EventKind, type EventRow } from "../model";
import { anchoredChords } from "../chords";
import { stringCount, type Tuning } from "../tunings";
import { readDuration, type Duration } from "../rhythm/durations";
import { decorate, drawnDecorations, drawnTransition } from "./techniques";

/** Expanded draws every repetition; compact collapses them to `7x8`. */
export type Density = "expanded" | "compact";

export interface TabColumn {
  /** The event this column came from. Several columns may share one. */
  eventId: string;
  kind: EventKind;
  /** One entry per string, top (highest) first. Null means nothing played. */
  cells: (string | null)[];
  /** Character width needed, i.e. the widest cell. */
  width: number;
  /** Bar this column sits in, 1-indexed. */
  barNumber: number;
  /** Chord symbol anchored here, if any. */
  chord: string | null;
  tupletId: string | null;
  tupletCount: number | null;
  /** What the group prints over this column: its count, or null for a plain group or none. */
  bracketNumber: number | null;
  /**
   * Which pass of a repeat this is, 0-indexed. Always 0 in compact density.
   * Lets the editor highlight one repetition without splitting the row.
   */
  repetition: number;
  /** The stored repeat count, so compact rendering can label it. */
  repeat: number;
  /** The stored duration, read through the table; null when unset or unknown. Never affects position. */
  duration: Duration | null;
  /** One entry per string, top first: the glyph in the gap BEFORE this column. */
  connectors: (string | null)[];
  /** What a screen reader reads. Words and numbers, never affix characters. */
  description: string;
}

export interface TabLayout {
  /** Note names top-to-bottom, e.g. ["G", "D", "A", "E", "B"]. */
  stringLabels: string[];
  stringCount: number;
  columns: TabColumn[];
  /** Highest bar number containing anything. */
  barCount: number;
  density: Density;
}

/**
 * What differs between views of the same part: the text of one played cell. Everything else -- bars,
 * repeats, connectors, widths -- is `layoutWith`'s, so a view cannot move a column.
 */
export interface CellWriter {
  /** The pitch text for one played cell, before decorations. */
  pitch(event: EventRow, stringIndex: number, fret: string, stored: readonly string[]): string;
  /** Passed to `decorate`. */
  separator: string;
  /** Words for the screen reader, or null. Null keeps the description as it is today. */
  words(event: EventRow, stringIndex: number, fret: string, stored: readonly string[]): string | null;
}

const FRET_WRITER: CellWriter = {
  pitch: (_event, _stringIndex, fret) => fret,
  separator: "",
  words: () => null,
};

export interface LayoutOptions {
  events: readonly EventRow[];
  tuning: Tuning;
  annotations?: readonly AnnotationRow[];
  density?: Density;
}

function fretText(event: EventRow, stringIndex: number): string | null {
  const value = fretAt(event.frets, stringIndex);
  if (value === undefined) return null;
  return String(value);
}

function storedFor(event: EventRow, stringIndex: number): readonly string[] {
  const list = event.techniques?.[String(stringIndex)];
  return Array.isArray(list) ? list : [];
}

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/** Screen-reader text: words and numbers, never the affix characters. */
function describeColumn(
  frets: (string | null)[],
  stored: (readonly string[])[],
  connectors: (string | null)[],
  repeatedTimes: number,
  durationWords: string | null = null,
  shown: (string | null)[] = [],
): string {
  const parts: string[] = [];
  frets.forEach((fret, index) => {
    if (fret === null) return;
    const words: string[] = [];
    if (connectors[index]) {
      const transition = drawnTransition(stored[index]);
      if (transition) words.push(transition.words);
    }
    for (const decoration of drawnDecorations(stored[index])) words.push(decoration.words);
    parts.push(
      `string ${index + 1} fret ${fret}${shown[index] ? ` shown as ${shown[index]}` : ""}${words.length ? ` with ${joinWords(words)}` : ""}`,
    );
  });
  const spoken = durationWords ? `, ${durationWords}` : "";
  if (parts.length === 0) return `Empty column${spoken}`;
  const text = parts.join(", ");
  return (repeatedTimes > 1 ? `${text}, repeated ${repeatedTimes} times` : text) + spoken;
}

/**
 * Note names without octaves, which is what tab staves are labelled with.
 * `B0` and `B1` both read as "B"; the octave is implied by the string.
 */
function labelsFor(tuning: Tuning): string[] {
  return tuning.strings.map((s) => s.note);
}

/**
 * Lay out a part as frets. The signature every caller knows; the work is `layoutWith`'s.
 *
 * `events` must already be in rank order -- the local queries return them that
 * way, and re-sorting here would hide a caller that forgot.
 */
export function layoutPart(options: LayoutOptions): TabLayout {
  return layoutWith(options, FRET_WRITER);
}

/** The one builder. `writer` decides the text of each played cell; nothing else. */
export function layoutWith(
  { events, tuning, annotations = [], density = "expanded" }: LayoutOptions,
  writer: CellWriter,
): TabLayout {
  const strings = stringCount(tuning);
  const chords = anchoredChords(annotations);

  const columns: TabColumn[] = [];
  let barNumber = 1;
  // Which strings have sounded so far. Spaces and barlines do not reset this,
  // so `5 7` and `5|7` still join; repetitions of a column feed each other.
  const played = Array.from({ length: strings }, () => false);

  for (const event of events) {
    if (event.kind === "barline") {
      columns.push({
        eventId: event.id,
        kind: "barline",
        cells: Array.from({ length: strings }, () => "|"),
        width: 1,
        barNumber,
        chord: null,
        tupletId: null,
        tupletCount: null,
        bracketNumber: null,
        repetition: 0,
        repeat: 1,
        duration: null,
        connectors: Array.from({ length: strings }, () => null),
        description: "Barline",
      });
      // Everything after this barline belongs to the next bar.
      barNumber += 1;
      continue;
    }

    const frets = Array.from({ length: strings }, (_, i) => fretText(event, i));
    const stored = Array.from({ length: strings }, (_, i) => storedFor(event, i));
    const transitions = stored.map((list) => drawnTransition(list));
    const decorated = frets.map((text, i) =>
      text === null
        ? null
        : decorate(writer.pitch(event, i, text, stored[i]), stored[i], writer.separator),
    );
    const shown = frets.map((text, i) =>
      text === null ? null : writer.words(event, i, text, stored[i]),
    );
    const chord = chords.get(event.id) ?? null;
    const repeat = Math.max(1, event.repeat);
    const duration = readDuration(event.durationHint);

    // Read before marking, so a note is never its own source.
    const takeConnectors = (): (string | null)[] => {
      const connectors = transitions.map((t, i) =>
        t && frets[i] !== null && played[i] ? t.glyph : null,
      );
      frets.forEach((text, i) => {
        if (text !== null) played[i] = true;
      });
      return connectors;
    };

    if (density === "compact" && repeat > 1) {
      // Suffix the repeat onto whichever strings are actually played, so a
      // chord repeated eight times reads as one labelled column.
      const cells = decorated.map((text) => (text === null ? null : `${text}x${repeat}`));
      const connectors = takeConnectors();
      columns.push({
        eventId: event.id,
        kind: event.kind,
        cells,
        width: Math.max(1, ...cells.map((c) => c?.length ?? 1)),
        barNumber,
        chord,
        tupletId: event.tupletId,
        tupletCount: event.tupletCount,
        bracketNumber: event.tupletId ? groupNumber(event) : null,
        repetition: 0,
        repeat,
        duration,
        connectors,
        description: describeColumn(frets, stored, connectors, repeat, duration?.words ?? null, shown),
      });
      continue;
    }

    for (let repetition = 0; repetition < repeat; repetition += 1) {
      const connectors = takeConnectors();
      columns.push({
        eventId: event.id,
        kind: event.kind,
        cells: decorated,
        width: Math.max(1, ...decorated.map((c) => c?.length ?? 1)),
        barNumber,
        // The chord is a property of the position, not of every repetition.
        chord: repetition === 0 ? chord : null,
        tupletId: event.tupletId,
        tupletCount: event.tupletCount,
        bracketNumber: event.tupletId ? groupNumber(event) : null,
        repetition,
        repeat,
        duration,
        connectors,
        description: describeColumn(frets, stored, connectors, 1, duration?.words ?? null, shown),
      });
    }
  }

  const barCount = columns.reduce(
    (max, column) => (column.kind === "barline" ? max : Math.max(max, column.barNumber)),
    0,
  );

  return { stringLabels: labelsFor(tuning), stringCount: strings, columns, barCount, density };
}

/**
 * Contiguous runs of columns that belong to one tuplet.
 *
 * Returned as index ranges rather than nested structure, because a tuplet is a
 * bracket drawn *over* the staff rather than a container in it.
 */
export interface TupletSpan {
  tupletId: string;
  /** The number the bracket prints; null for a plain group. */
  count: number | null;
  /** Inclusive column indices. */
  start: number;
  end: number;
}

export function tupletSpans(layout: TabLayout): TupletSpan[] {
  const spans: TupletSpan[] = [];
  let current: TupletSpan | null = null;

  layout.columns.forEach((column, index) => {
    if (!column.tupletId) {
      current = null;
      return;
    }
    if (current && current.tupletId === column.tupletId) {
      current.end = index;
      return;
    }
    current = {
      tupletId: column.tupletId,
      count: column.bracketNumber,
      start: index,
      end: index,
    };
    spans.push(current);
  });

  return spans;
}

/**
 * Narrow a part's events to a bar range, for an arrangement entry that plays
 * only some of a part ("C, first half").
 *
 * Bars are 1-indexed and both ends inclusive. Null bounds mean "from the
 * start" / "to the end", so passing both nulls returns everything.
 */
export function eventsInBars(
  events: readonly EventRow[],
  fromBar: number | null,
  toBar: number | null,
): EventRow[] {
  if (fromBar === null && toBar === null) return [...events];

  const first = fromBar ?? 1;
  const last = toBar ?? Number.POSITIVE_INFINITY;
  const selected: EventRow[] = [];
  let bar = 1;

  for (const event of events) {
    const inRange = bar >= first && bar <= last;
    if (event.kind === "barline") {
      // Keep interior barlines so the slice still reads as bars, but drop the
      // one that would trail the final bar.
      if (inRange && bar < last) selected.push(event);
      bar += 1;
      continue;
    }
    if (inRange) selected.push(event);
  }

  return selected;
}

/**
 * How many bars a part has.
 *
 * Matches the numbering in `layoutPart` -- a trailing barline with nothing
 * after it does not open a new bar -- so the arrangement's bar ranges and the
 * rendered staff always agree about what "bar 2" means. Needs no tuning,
 * which lets the song view compute this for every part at once.
 */
export function countBars(events: readonly EventRow[]): number {
  let bar = 1;
  let highest = 0;
  for (const event of events) {
    if (event.kind === "barline") {
      bar += 1;
      continue;
    }
    highest = Math.max(highest, bar);
  }
  return highest;
}

/** Total columns a part occupies once repeats are unrolled. */
export function expandedLength(events: readonly EventRow[]): number {
  return events.reduce(
    (total, event) => total + (event.kind === "barline" ? 1 : Math.max(1, event.repeat)),
    0,
  );
}
