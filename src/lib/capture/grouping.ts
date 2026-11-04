/**
 * What a selection of columns can do about grouping.
 *
 * Pure: the toolbar and the write both call `groupOffer`, so what a control
 * promises and what the write does cannot drift apart.
 */
import type { EventRow } from "../model";
import { MAX_TUPLET_COLUMNS, MIN_GROUP_COLUMNS } from "../model";

export const TRIPLET_REFUSAL = "a triplet needs three columns in one bar";

export interface GroupOffer {
  /** The one counted tuplet on offer. Its length is the numeral and the stored count. */
  readonly tuplet: readonly EventRow[] | null;
  /** One run per bar holding at least two selected playable columns. */
  readonly plain: readonly (readonly EventRow[])[];
  readonly ungroup: boolean;
}

/** Split on barlines, dropping the barlines and any empty run. */
function runsOf(selected: readonly EventRow[]): EventRow[][] {
  const runs: EventRow[][] = [];
  let current: EventRow[] = [];
  for (const row of selected) {
    if (row.kind === "barline") {
      if (current.length > 0) runs.push(current);
      current = [];
    } else current.push(row);
  }
  if (current.length > 0) runs.push(current);
  return runs;
}

/** `selected` is a contiguous run in rank order, barlines included. */
export function groupOffer(selected: readonly EventRow[]): GroupOffer {
  const runs = runsOf(selected);
  const only = runs.length === 1 ? runs[0] : null;
  const tuplet =
    only && only.length >= MIN_GROUP_COLUMNS && only.length <= MAX_TUPLET_COLUMNS ? only : null;
  return {
    tuplet,
    plain: runs.filter((run) => run.length >= MIN_GROUP_COLUMNS),
    ungroup: selected.some((row) => row.tupletId !== null),
  };
}

/**
 * The `count` rows ending at `endId`, or at the last playable row when `endId` is null.
 * Null if there are too few, if a barline falls among them, or if `count` is out of range.
 */
export function runEndingAt(
  rows: readonly EventRow[],
  endId: string | null,
  count: number,
): readonly EventRow[] | null {
  if (!Number.isInteger(count) || count < MIN_GROUP_COLUMNS || count > MAX_TUPLET_COLUMNS) {
    return null;
  }
  let end: number;
  if (endId === null) {
    end = -1;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].kind !== "barline") {
        end = i;
        break;
      }
    }
  } else end = rows.findIndex((row) => row.id === endId);
  if (end === -1) return null;
  const start = end - count + 1;
  if (start < 0) return null;
  const run = rows.slice(start, end + 1);
  return run.some((row) => row.kind === "barline") ? null : run;
}
