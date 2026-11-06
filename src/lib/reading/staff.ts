/**
 * Arithmetic for drawing the staff: how much room a chord symbol has, where a bar runs from and to.
 * Pure and React-free. The layout (`layoutPart`) is not touched, so the export cannot see any of it.
 */

import type { TabColumn } from "@/lib/tab/layout";

export interface ChordRoom {
  /** Characters in the symbol. */
  chars: number;
  /** Sum of `width` over the columns the symbol owns. */
  roomChars: number;
  /** How many columns it owns. */
  roomColumns: number;
}

const isBarline = (column: TabColumn) => column.kind === "barline";

/**
 * A symbol owns its own column and those after it, up to the next chord, through the closing barline of its bar,
 * or to the last column. Keyed by column index.
 */
export function chordRooms(columns: readonly TabColumn[]): Map<number, ChordRoom> {
  const rooms = new Map<number, ChordRoom>();
  columns.forEach((column, start) => {
    if (column.chord === null) return;
    let roomChars = 0;
    let roomColumns = 0;
    for (let i = start; i < columns.length; i += 1) {
      if (i > start && columns[i].chord !== null) break;
      roomChars += columns[i].width;
      roomColumns += 1;
      if (isBarline(columns[i])) break;
    }
    rooms.set(start, { chars: Array.from(column.chord).length, roomChars, roomColumns });
  });
  return rooms;
}

/** Inclusive index ranges, each ending with its closing barline. The last may have none. Every column is in exactly one. */
export function barRuns(columns: readonly TabColumn[]): { start: number; end: number }[] {
  const runs: { start: number; end: number }[] = [];
  let start = 0;
  columns.forEach((column, index) => {
    if (!isBarline(column)) return;
    runs.push({ start, end: index });
    start = index + 1;
  });
  if (start < columns.length) runs.push({ start, end: columns.length - 1 });
  return runs;
}

/** Indices of columns that open a bar. Never a barline; an empty bar has none. */
export function barStarts(columns: readonly TabColumn[]): Set<number> {
  const starts = new Set<number>();
  let opening = true;
  columns.forEach((column, index) => {
    if (isBarline(column)) {
      opening = true;
      return;
    }
    if (opening) starts.add(index);
    opening = false;
  });
  return starts;
}
