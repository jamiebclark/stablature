import type { EventRow } from "@/lib/model";

/** "end" tracks the tail; null is the very start; a string is a column id. */
export type Cursor = "end" | null | string;

/**
 * Where the cursor goes after a column is deleted. Called by BOTH the toolbar's
 * delete and the inspector's delete, so they cannot disagree (INV-004).
 */
export function nextCursorAfterDelete(
  columns: readonly EventRow[],
  deletedId: string,
  cursor: Cursor,
): Cursor {
  if (cursor === "end") return "end";
  if (cursor !== deletedId) return cursor;

  const index = columns.findIndex((column) => column.id === deletedId);
  const previous = index > 0 ? columns[index - 1] : undefined;
  return previous ? previous.id : null;
}

const indexOfCursor = (columns: readonly EventRow[], cursor: Cursor): number => {
  if (cursor === null) return -1;
  if (cursor === "end") return columns.length - 1;
  return columns.findIndex((column) => column.id === cursor);
};

const atIndex = (columns: readonly EventRow[], index: number): Cursor =>
  index < 0 ? null : index >= columns.length ? "end" : columns[index].id;

/** One stored column along, as a tap on it would be: back from the first gives null, on from the last gives "end". */
export function cursorStep(columns: readonly EventRow[], cursor: Cursor, by: -1 | 1): Cursor {
  if (columns.length === 0) return cursor === null ? null : "end";
  const index = indexOfCursor(columns, cursor);
  if (index < 0 && cursor !== null) return "end";
  return atIndex(columns, index + by);
}

/** The first column of the next (or this, or previous) bar. Back from the first bar gives null; on from the last gives "end". */
export function cursorBar(columns: readonly EventRow[], cursor: Cursor, by: -1 | 1): Cursor {
  const starts: number[] = [];
  let open = true;
  columns.forEach((column, i) => {
    if (column.kind === "barline") open = true;
    else if (open) {
      starts.push(i);
      open = false;
    }
  });
  const index = indexOfCursor(columns, cursor);
  if (index < 0 && cursor !== null) return "end";
  if (by === 1) {
    const next = starts.find((s) => s > index);
    return next === undefined ? "end" : columns[next].id;
  }
  const previous = [...starts].reverse().find((s) => s < index);
  return previous === undefined ? null : columns[previous].id;
}
