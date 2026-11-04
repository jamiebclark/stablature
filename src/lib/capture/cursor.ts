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
