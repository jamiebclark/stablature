/**
 * ASCII tab.
 *
 * This exists for three reasons, in order of importance:
 *
 *  1. It makes the layout testable by exact string comparison. Asserting that
 *     a riff renders as `E |-7-7-7-7-|` is far better evidence than poking at
 *     a render tree, and it is readable in a failure message.
 *  2. It is how a part gets shared with someone who does not use this app --
 *     pasted into a message, which is what everyone already does.
 *  3. It is a plain-text export that will still be openable in ten years.
 *
 * Columns are padded to a common width so the strings stay vertically aligned
 * even when some frets are two digits. Repeats in compact density render as
 * `7x8` rather than the typographic multiplication sign, so the output stays
 * copy-pasteable into anything.
 */

import { layoutPart, tupletSpans, type LayoutOptions, type TabLayout } from "./layout";

/** Character that fills the space between notes. */
const RAIL = "-";

export interface AsciiOptions extends LayoutOptions {
  /** Include a bracket row above the staff for tuplets. Defaults to true. */
  showTuplets?: boolean;
  /** Include a chord row above the staff. Defaults to true. */
  showChords?: boolean;
}

interface Placed {
  /** Column start offset within the rendered staff body. */
  offset: number;
  width: number;
}

/**
 * Where each column lands horizontally.
 *
 * Shared by the staff rows and the rows drawn above them, so a chord symbol
 * and its notes cannot drift apart.
 */
function placeColumns(layout: TabLayout): { places: Placed[]; bodyWidth: number } {
  const places: Placed[] = [];
  // The body opens with a rail so the first note is not flush against the bar.
  let offset = RAIL.length;

  layout.columns.forEach((column, index) => {
    places.push({ offset, width: column.width });
    offset += column.width;
    // Every column is followed by a rail, including the last.
    if (index < layout.columns.length - 1) offset += RAIL.length;
  });

  return { places, bodyWidth: offset + RAIL.length };
}

function staffRow(layout: TabLayout, places: Placed[], stringIndex: number): string {
  let body = RAIL;

  layout.columns.forEach((column, index) => {
    const text = column.cells[stringIndex];
    const place = places[index];
    if (column.kind === "barline") {
      body += "|".padEnd(place.width, RAIL);
    } else {
      // Pad with rails rather than spaces so the string reads as continuous.
      body += (text ?? "").padEnd(place.width, RAIL).replace(/ /g, RAIL);
    }
    if (index < layout.columns.length - 1) body += RAIL;
  });

  return `${body}${RAIL}`;
}

/** Overlay `text` onto a space-filled row at a given offset. */
function overlay(row: string[], offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    const at = offset + i;
    if (at >= 0 && at < row.length) row[at] = text[i];
  }
}

function chordRow(layout: TabLayout, places: Placed[], bodyWidth: number): string | null {
  const chords = layout.columns
    .map((column, index) => ({ chord: column.chord, index }))
    .filter((entry): entry is { chord: string; index: number } => entry.chord !== null);
  if (chords.length === 0) return null;

  const row = Array.from({ length: bodyWidth }, () => " ");
  for (const { chord, index } of chords) {
    overlay(row, places[index].offset, chord);
  }
  return row.join("").trimEnd();
}

/**
 * Bracket row for tuplets, e.g. `,--3--,` spanning a triplet's three columns.
 *
 * Drawn above the staff because a tuplet is an annotation over a span of
 * columns, not a property of any one of them.
 */
function tupletRow(layout: TabLayout, places: Placed[], bodyWidth: number): string | null {
  const spans = tupletSpans(layout);
  if (spans.length === 0) return null;

  const row = Array.from({ length: bodyWidth }, () => " ");

  for (const span of spans) {
    const start = places[span.start].offset;
    const endPlace = places[span.end];
    const end = endPlace.offset + endPlace.width - 1;
    const width = Math.max(1, end - start + 1);

    const label = String(span.count);
    if (width <= label.length) {
      overlay(row, start, label);
      continue;
    }

    // ,--3--, with the label centred over the span.
    const bracket = Array.from({ length: width }, () => "-");
    bracket[0] = ",";
    bracket[width - 1] = ",";
    const labelAt = Math.floor((width - label.length) / 2);
    for (let i = 0; i < label.length; i += 1) bracket[labelAt + i] = label[i];
    overlay(row, start, bracket.join(""));
  }

  return row.join("").trimEnd();
}

/**
 * Render a part as ASCII tab.
 *
 * Empty parts still produce a labelled staff, because an empty staff is the
 * correct picture of a part with no notes yet -- and it is what the capture
 * screen shows before the first tap.
 */
export function toAscii(options: AsciiOptions): string {
  const { showTuplets = true, showChords = true } = options;
  const layout = layoutPart(options);
  const { places, bodyWidth } = placeColumns(layout);

  const labelWidth = Math.max(...layout.stringLabels.map((l) => l.length));
  const gutter = " ".repeat(labelWidth + 2);

  const lines: string[] = [];

  if (showChords) {
    const chords = chordRow(layout, places, bodyWidth);
    if (chords) lines.push(`${gutter}${chords}`.trimEnd());
  }
  if (showTuplets) {
    const tuplets = tupletRow(layout, places, bodyWidth);
    if (tuplets) lines.push(`${gutter}${tuplets}`.trimEnd());
  }

  layout.stringLabels.forEach((label, stringIndex) => {
    const body = layout.columns.length === 0 ? RAIL : staffRow(layout, places, stringIndex);
    lines.push(`${label.padEnd(labelWidth)} |${body}|`);
  });

  return lines.join("\n");
}
