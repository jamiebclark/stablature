/**
 * Ordering for anything the user can reorder: tab columns within a part, parts
 * within a song, entries within an arrangement.
 *
 * Ranks are fractional index keys ("a0", "a1", "a0V") rather than integer
 * positions. Inserting between two neighbours mints a new key between their
 * two strings, so an insert touches exactly one row and two devices inserting
 * into the same part while offline cannot conflict -- there is no shared
 * counter to disagree about.
 *
 * Caveat worth knowing: fractional keys only sort correctly under *codepoint*
 * ordering. JS string comparison and IndexedDB both do that, and since the UI
 * reads exclusively from the local store, correctness never depends on
 * Postgres. Any `ORDER BY rank` added on the server must say COLLATE "C",
 * because the default collation sorts 'a' before 'B' and would scramble them.
 */

import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

export type Rank = string;

/** Anything orderable. The id is the tiebreak, so it has to be here. */
export interface Ranked {
  id: string;
  rank: Rank;
}

/**
 * A key that sorts between `before` and `after`. Pass null for an open end:
 * `rankBetween(last, null)` appends, `rankBetween(null, first)` prepends.
 */
export function rankBetween(before: Rank | null, after: Rank | null): Rank {
  return generateKeyBetween(before, after);
}

/** `n` keys between the bounds, in order. Cheaper than n calls to rankBetween. */
export function ranksBetween(before: Rank | null, after: Rank | null, n: number): Rank[] {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`Expected a non-negative count, got ${n}`);
  }
  return generateNKeysBetween(before, after, n);
}

/** Append after everything in `items` (which need not be sorted). */
export function rankAtEnd(items: readonly Ranked[]): Rank {
  return rankBetween(maxRank(items), null);
}

/** Prepend before everything in `items` (which need not be sorted). */
export function rankAtStart(items: readonly Ranked[]): Rank {
  return rankBetween(null, minRank(items));
}

/**
 * `count` keys appended after everything in `items`. This is the hot path for
 * capture: tapping a fret appends one column, and a repeat expansion appends
 * many at once.
 */
export function ranksAtEnd(items: readonly Ranked[], count: number): Rank[] {
  return ranksBetween(maxRank(items), null, count);
}

/**
 * Rank for moving an item so it lands between two others, or null when the
 * move would change nothing.
 *
 * Detecting the no-op matters more than it looks: a pointless write bumps the
 * row's HLC, which would let dragging an item onto its own position win a
 * merge against somebody's real concurrent edit to it.
 *
 * "Changes nothing" is not just "the item is one of the two neighbours" --
 * dropping the first item at the front yields neighbours (null, second), which
 * is exactly where it already sits. So the test is whether the item's current
 * rank already sorts strictly between the two targets.
 */
export function rankForMove(
  before: Ranked | null,
  after: Ranked | null,
  moving: Ranked,
): Rank | null {
  if (before?.id === moving.id || after?.id === moving.id) return null;

  const aboveLower = before === null || moving.rank > before.rank;
  const belowUpper = after === null || moving.rank < after.rank;
  if (aboveLower && belowUpper) return null;

  return rankBetween(before?.rank ?? null, after?.rank ?? null);
}

/** Codepoint comparison, with the id as a deterministic tiebreak. */
export function compareRanked(a: Ranked, b: Ranked): number {
  if (a.rank !== b.rank) return a.rank < b.rank ? -1 : 1;
  // Two devices can mint the same key offline. Falling back to the id keeps
  // every replica's ordering identical rather than merely self-consistent.
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Sorted copy. Never sorts in place -- callers pass arrays straight from Dexie. */
export function sortByRank<T extends Ranked>(items: readonly T[]): T[] {
  return [...items].sort(compareRanked);
}

function maxRank(items: readonly Ranked[]): Rank | null {
  let max: Rank | null = null;
  for (const item of items) {
    if (max === null || item.rank > max) max = item.rank;
  }
  return max;
}

function minRank(items: readonly Ranked[]): Rank | null {
  let min: Rank | null = null;
  for (const item of items) {
    if (min === null || item.rank < min) min = item.rank;
  }
  return min;
}
