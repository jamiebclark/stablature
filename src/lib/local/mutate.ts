/**
 * The single write path.
 *
 * Every change the user makes goes through here, and each one does exactly two
 * things in one IndexedDB transaction: update the local row, and append an
 * outbox entry. The transaction is the point. If a row could be saved without
 * its outbox entry, the edit would look committed on the device and never
 * reach anyone else -- which, for someone capturing a riff at practice, is
 * worse than an outright failure, because they would not find out until the
 * rehearsal was over.
 *
 * Writes never touch the network. Pushing is somebody else's job (see
 * src/lib/sync), so capture behaves identically online and off.
 */

import type { HlcClock } from "../hlc";
import {
  MERGEABLE_FIELDS,
  type SyncedRow,
  type SyncedRows,
  type SyncedTable,
} from "../model";
import { applyPatch, stampNewRow } from "../sync/merge";
import { db as defaultDb, type StablatureDb } from "./db";
import { getClock } from "./device";

/** Fields a caller supplies when creating a row; the rest are stamped. */
export type NewRow<K extends SyncedTable> = Omit<
  SyncedRows[K],
  "updatedAt" | "fieldClocks" | "serverSeq" | "deletedAt"
>;

type Mergeable<K extends SyncedTable> = Extract<
  keyof SyncedRows[K],
  (typeof MERGEABLE_FIELDS)[K][number]
>;

/** Fields a caller may change. Structural fields are deliberately excluded. */
export type RowPatch<K extends SyncedTable> = Partial<Pick<SyncedRows[K], Mergeable<K>>>;

export interface MutateContext {
  db?: StablatureDb;
  clock?: HlcClock;
}

function resolve(ctx: MutateContext) {
  return { database: ctx.db ?? defaultDb, clock: ctx.clock ?? getClock() };
}

/**
 * Persist a row and queue it for push, atomically.
 *
 * Shared by every mutation below so there is exactly one place where "write
 * locally and remember to sync it" is implemented.
 */
async function commit<K extends SyncedTable>(
  database: StablatureDb,
  table: K,
  row: SyncedRows[K],
  hlc: string,
): Promise<void> {
  await database.transaction("rw", [database[table], database.outbox], async () => {
    await database[table].put(row as never);
    await database.outbox.add({
      table,
      rowId: row.id,
      row: row as SyncedRow,
      hlc,
      attempts: 0,
    });
  });
}

/** Create a row. The caller mints the id (see src/lib/ids.ts). */
export async function insertRow<K extends SyncedTable>(
  table: K,
  input: NewRow<K>,
  ctx: MutateContext = {},
): Promise<SyncedRows[K]> {
  const { database, clock } = resolve(ctx);
  const hlc = clock.send();
  const row = stampNewRow(table, { ...input, deletedAt: null } as never, hlc);
  await commit(database, table, row, hlc);
  return row;
}

/**
 * Change some fields of a row.
 *
 * The patch is narrow on purpose: only the fields named here get a new clock,
 * so editing a song's title cannot clobber someone's concurrent BPM change.
 */
export async function patchRow<K extends SyncedTable>(
  table: K,
  id: string,
  patch: RowPatch<K>,
  ctx: MutateContext = {},
): Promise<SyncedRows[K]> {
  const { database, clock } = resolve(ctx);

  let updated: SyncedRows[K] | undefined;
  await database.transaction("rw", [database[table], database.outbox], async () => {
    const existing = (await database[table].get(id)) as SyncedRows[K] | undefined;
    if (!existing) {
      throw new Error(`Cannot patch ${table}/${id}: no such row in the local store`);
    }
    const hlc = clock.send();
    updated = applyPatch(table, existing, patch, hlc);
    await database[table].put(updated as never);
    await database.outbox.add({
      table,
      rowId: id,
      row: updated as SyncedRow,
      hlc,
      attempts: 0,
    });
  });

  return updated!;
}

/**
 * Tombstone a row.
 *
 * Nothing is ever actually removed: a hard delete cannot merge against a
 * concurrent edit, and it would also make an undo impossible.
 */
export async function deleteRow<K extends SyncedTable>(
  table: K,
  id: string,
  ctx: MutateContext = {},
): Promise<void> {
  const { clock } = resolve(ctx);
  const hlc = clock.send();
  await patchRow(table, id, { deletedAt: hlc } as unknown as RowPatch<K>, { ...ctx, clock });
}

/** Undo a delete. Works because the tombstone is just another clocked field. */
export async function restoreRow<K extends SyncedTable>(
  table: K,
  id: string,
  ctx: MutateContext = {},
): Promise<void> {
  await patchRow(table, id, { deletedAt: null } as unknown as RowPatch<K>, ctx);
}

/**
 * Apply several mutations as one unit.
 *
 * Needed wherever a single user gesture produces several rows -- creating a
 * song along with its first part, or expanding a repeat into many columns --
 * so a half-finished gesture can never be left in the store.
 */
export async function mutateBatch(
  fn: (ctx: Required<MutateContext>) => Promise<void>,
  ctx: MutateContext = {},
): Promise<void> {
  const { database, clock } = resolve(ctx);
  const tables = [
    database.bands,
    database.tunings,
    database.songs,
    database.parts,
    database.events,
    database.annotations,
    database.arrangementEntries,
    database.outbox,
  ];
  await database.transaction("rw", tables, async () => {
    await fn({ db: database, clock });
  });
}
