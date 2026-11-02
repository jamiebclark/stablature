/**
 * Row merging.
 *
 * This is the whole conflict-resolution story, and it is deliberately small
 * enough to reason about: for each mergeable field, keep whichever side has
 * the larger HLC. There is no CRDT library because the schema already removes
 * the hard cases -- client-minted ids mean inserts never collide, and
 * fractional ranks mean reorders never collide. What is left is two people
 * editing the same field of the same row, which is exactly where
 * last-write-wins is the answer a band actually wants.
 *
 * The one property worth stating explicitly, because the rest depends on it:
 * merging is COMMUTATIVE and IDEMPOTENT over any set of versions of a row.
 * Replicas can receive edits in any order, more than once, and still converge
 * on identical rows. That is what makes the sync protocol allowed to be as
 * dumb as it is.
 */

import { compareHlc, maxHlc, ZERO_HLC, type Hlc } from "../hlc";
import {
  MERGEABLE_FIELDS,
  type FieldClocks,
  type SyncedRows,
  type SyncedTable,
} from "../model";

/**
 * The mergeable field names for one table.
 *
 * Written as an Extract over `keyof` rather than reading the registry
 * directly, so the result is provably a subset of the row's own keys. Without
 * that, `Pick<SyncedRows[K], ...>` cannot typecheck while K is still generic.
 */
type Mergeable<K extends SyncedTable> = Extract<
  keyof SyncedRows[K],
  (typeof MERGEABLE_FIELDS)[K][number]
>;

/**
 * Field-wise access to a row.
 *
 * Merging is inherently dynamic -- it walks a list of field names -- so one
 * narrow escape hatch here is cheaper than making every row type carry an
 * index signature it does not want.
 */
function asRecord(row: object): Record<string, unknown> {
  return row as unknown as Record<string, unknown>;
}

function clockFor(clocks: FieldClocks, field: string): Hlc {
  return clocks[field] ?? ZERO_HLC;
}

/** The row-level "last touched" value, derived so it can never disagree. */
export function deriveUpdatedAt(clocks: FieldClocks, fallback: Hlc = ZERO_HLC): Hlc {
  let max = fallback;
  for (const clock of Object.values(clocks)) max = maxHlc(max, clock);
  return max;
}

/**
 * Merge a row received from sync into the copy held locally.
 *
 * `local` being undefined means we have never seen the row, in which case the
 * remote version is taken wholesale.
 */
export function mergeRow<K extends SyncedTable>(
  table: K,
  local: SyncedRows[K] | undefined,
  remote: SyncedRows[K],
): SyncedRows[K] {
  if (!local) {
    return { ...remote, updatedAt: deriveUpdatedAt(remote.fieldClocks, remote.updatedAt) };
  }

  const merged = { ...local } as SyncedRows[K];
  const clocks: FieldClocks = { ...local.fieldClocks };

  for (const field of MERGEABLE_FIELDS[table] as readonly string[]) {
    const remoteClock = clockFor(remote.fieldClocks, field);
    const localClock = clockFor(local.fieldClocks, field);
    if (compareHlc(remoteClock, localClock) > 0) {
      // Field-wise copy: the two rows may disagree about several fields and
      // each is decided on its own clock, independently of the others.
      asRecord(merged)[field] = asRecord(remote)[field];
      clocks[field] = remoteClock;
    }
  }

  merged.fieldClocks = clocks;
  merged.updatedAt = deriveUpdatedAt(clocks, maxHlc(local.updatedAt, remote.updatedAt));
  // The server owns serverSeq, and it only ever moves forward.
  merged.serverSeq = Math.max(local.serverSeq, remote.serverSeq);
  return merged;
}

/**
 * Apply a local edit, stamping every changed field with `hlc`.
 *
 * Patches are narrow on purpose -- only the fields the user actually touched
 * get a new clock, so an edit to a song's title cannot clobber a concurrent
 * edit to its BPM.
 */
export function applyPatch<K extends SyncedTable>(
  table: K,
  row: SyncedRows[K],
  patch: Partial<Pick<SyncedRows[K], Mergeable<K>>>,
  hlc: Hlc,
): SyncedRows[K] {
  const allowed = new Set<string>(MERGEABLE_FIELDS[table] as readonly string[]);
  const next = { ...row } as SyncedRows[K];
  const clocks: FieldClocks = { ...row.fieldClocks };

  for (const [field, value] of Object.entries(patch)) {
    if (!allowed.has(field)) {
      // Structural fields (ids, parent keys) are immutable by design. Silently
      // ignoring them would make a real bug look like a no-op.
      throw new Error(`Field "${field}" on ${table} is not mergeable and cannot be patched`);
    }
    asRecord(next)[field] = value;
    clocks[field] = hlc;
  }

  next.fieldClocks = clocks;
  next.updatedAt = deriveUpdatedAt(clocks, row.updatedAt);
  return next;
}

/**
 * Stamp a brand-new row: every mergeable field gets the creating clock, so a
 * later edit from any replica compares cleanly against it.
 */
export function stampNewRow<K extends SyncedTable>(
  table: K,
  row: Omit<SyncedRows[K], "updatedAt" | "fieldClocks" | "serverSeq"> &
    Partial<Pick<SyncedRows[K], "updatedAt" | "fieldClocks" | "serverSeq">>,
  hlc: Hlc,
): SyncedRows[K] {
  const clocks: FieldClocks = {};
  for (const field of MERGEABLE_FIELDS[table] as readonly string[]) {
    clocks[field] = hlc;
  }
  return {
    ...row,
    fieldClocks: clocks,
    updatedAt: hlc,
    // Zero until the server assigns one, which is how the outbox knows this
    // row has never been pushed.
    serverSeq: 0,
  } as SyncedRows[K];
}
