/**
 * Server side of sync.
 *
 * The server is a replica that happens to be authoritative about two things:
 * who may write (membership) and the ordering cursor (`serverSeq`). It merges
 * incoming rows with exactly the same function the client uses, which is the
 * reason the two can never disagree about the outcome of a conflict.
 */

import { and, asc, eq, gt, inArray, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { newId } from "@/lib/ids";
import {
  MERGEABLE_FIELDS,
  SYNCED_TABLES,
  type BandRole,
  type SyncedRows,
  type SyncedTable,
} from "@/lib/model";
import { mergeRow } from "@/lib/sync/merge";
import type {
  Mutation,
  PullResponse,
  PushRejection,
  PushResponse,
  PulledRows,
} from "@/lib/sync/protocol";
import { canEdit } from "./membership";

const TABLES = {
  bands: schema.bands,
  tunings: schema.tunings,
  songs: schema.songs,
  parts: schema.parts,
  events: schema.events,
  annotations: schema.annotations,
  arrangementEntries: schema.arrangementEntries,
} as const;

/**
 * Merging walks a list of field names, and the table is chosen at runtime, so
 * the generic plumbing here is unavoidably dynamic. Confined to this module
 * and guarded by assert-model.ts, which fails the build if the SQL schema and
 * the row types drift apart.
 */
type AnyTable = PgTable & Record<string, never>;
const columns = (name: SyncedTable) => TABLES[name] as unknown as Record<string, never>;

/** `bands` is scoped by its own id; everything else carries a bandId. */
function bandScope(name: SyncedTable): SQL.Aliased | never {
  const table = columns(name);
  return (name === "bands" ? table.id : table.bandId) as never;
}

/** Channel used to wake connected clients after a write. */
export const SYNC_CHANNEL = "stablature_sync";

/* ---------- push ---------- */

/**
 * Apply a batch of client rows.
 *
 * The whole batch runs in one transaction, in topological table order and by
 * id within a table. UUIDv7 sorts by creation time, so that ordering is also
 * creation order -- which is what lets foreign keys stay enforced even though
 * a client may have queued a part before the song that contains it.
 */
export async function applyPush(
  userId: string,
  mutations: readonly Mutation[],
  roles: Map<string, BandRole>,
): Promise<PushResponse> {
  const ordered = [...mutations].sort((a, b) => {
    const byTable = SYNCED_TABLES.indexOf(a.table) - SYNCED_TABLES.indexOf(b.table);
    return byTable !== 0 ? byTable : a.row.id.localeCompare(b.row.id);
  });

  const rejected: PushRejection[] = [];
  const rows: PulledRows = {};
  let cursor = 0;

  await db.transaction(async (tx) => {
    // Bands created during this batch become writable within it, so a band and
    // its first song can arrive together.
    const effective = new Map(roles);

    for (const mutation of ordered) {
      const bandId = mutation.table === "bands" ? mutation.row.id : mutation.row.bandId;
      const role = effective.get(bandId);
      let claimOwnership = false;

      if (mutation.table === "bands" && role === undefined) {
        const [existing] = await tx
          .select({ id: schema.bands.id })
          .from(schema.bands)
          .where(eq(schema.bands.id, bandId))
          .limit(1);

        if (existing) {
          // The band is real but not ours. Pushing a row into someone else's
          // band must not quietly make us a member of it.
          rejected.push({
            table: mutation.table,
            id: mutation.row.id,
            reason: "not_a_member",
            message: "That band belongs to someone else.",
          });
          continue;
        }

        // First time anyone has pushed this band: whoever made it owns it. The
        // membership row has to wait until after the upsert below, because it
        // has a foreign key to the band that does not exist yet.
        claimOwnership = true;
      } else if (role === undefined) {
        rejected.push({
          table: mutation.table,
          id: mutation.row.id,
          reason: "unknown_band",
          message: "You are not a member of that band.",
        });
        continue;
      } else if (!canEdit(role)) {
        rejected.push({
          table: mutation.table,
          id: mutation.row.id,
          reason: "read_only",
          message: "You have read-only access to that band.",
        });
        continue;
      }

      const stored = await upsert(tx, mutation);

      if (claimOwnership) {
        await tx
          .insert(schema.bandMembers)
          .values({ id: newId(), bandId, userId, role: "owner" })
          .onConflictDoNothing({
            target: [schema.bandMembers.bandId, schema.bandMembers.userId],
          });
        // Rows later in this same batch can now be written to the new band, so
        // a band and its first song arrive together.
        effective.set(bandId, "owner");
      }

      (rows[mutation.table] ??= []).push(stored);
      cursor = Math.max(cursor, Number(stored.serverSeq));
    }
  });

  return { rows, rejected, cursor };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function upsert(tx: Tx, mutation: Mutation): Promise<{ serverSeq: number | string }> {
  const name = mutation.table;
  const table = TABLES[name] as unknown as AnyTable;
  const incoming = mutation.row as unknown as SyncedRows[SyncedTable];

  const [existing] = await tx
    .select()
    .from(table)
    .where(eq(columns(name).id, incoming.id))
    .limit(1);

  const merged = mergeRow(
    name,
    existing as unknown as SyncedRows[typeof name] | undefined,
    incoming as never,
  ) as unknown as Record<string, unknown>;

  // Only mergeable fields plus the clocks are ever written. Structural
  // fields (ids, parent keys) are set once at insert and never updated, which
  // is what makes a merge a pure field-wise comparison.
  const payload: Record<string, unknown> = {
    updatedAt: merged.updatedAt,
    fieldClocks: merged.fieldClocks,
    // The server owns ordering. Taking a value from the shared sequence here is
    // what gives pull a single monotonic cursor across every table.
    serverSeq: sql`nextval('global_seq')`,
  };
  for (const field of MERGEABLE_FIELDS[name] as readonly string[]) {
    payload[field] = merged[field];
  }

  if (existing) {
    const [row] = await tx
      .update(table)
      .set(payload as never)
      .where(eq(columns(name).id, incoming.id))
      .returning();
    return row as { serverSeq: number | string };
  }

  const [row] = await tx
    .insert(table)
    .values({ ...(incoming as unknown as Record<string, unknown>), ...payload } as never)
    .returning();
  return row as { serverSeq: number | string };
}

/** Tell every connected client in these bands that there is something new. */
export async function notifyChanged(cursor: number): Promise<void> {
  // NOTIFY rather than an in-process emitter, so this still works if the app
  // ever runs as more than one container.
  await db.execute(sql`select pg_notify(${SYNC_CHANNEL}, ${String(cursor)})`);
}

/* ---------- pull ---------- */

/**
 * Everything visible to this user above `since`.
 *
 * The subtlety is the cursor. Giving each table its own slice of a shared row
 * budget and then returning the highest serverSeq seen would be wrong: if
 * `bands` filled the budget at seq 100 while `events` still had rows at seq
 * 50, the next pull would start from 100 and those events would never arrive.
 * So rows from every table are merged into one list ordered by serverSeq and
 * truncated as a single global prefix -- the cursor is then the last row
 * actually returned, and nothing below it can have been skipped.
 */
export async function readPull(
  roles: Map<string, BandRole>,
  since: number,
  limit: number,
): Promise<PullResponse & { bandIds: string[] }> {
  const bandIds = [...roles.keys()];
  if (bandIds.length === 0) {
    return { rows: {}, cursor: since, hasMore: false, bandIds };
  }

  const candidates: { table: SyncedTable; seq: number; row: unknown }[] = [];

  for (const name of SYNCED_TABLES) {
    const table = TABLES[name] as unknown as AnyTable;
    const page = await db
      .select()
      .from(table)
      .where(and(inArray(bandScope(name), bandIds), gt(columns(name).serverSeq, since)))
      .orderBy(asc(columns(name).serverSeq))
      // One past the limit, so a single table can never starve the others out
      // of the global ordering below.
      .limit(limit + 1);

    for (const row of page as unknown as { serverSeq: number | string }[]) {
      candidates.push({ table: name, seq: Number(row.serverSeq), row });
    }
  }

  candidates.sort((a, b) => a.seq - b.seq);
  const included = candidates.slice(0, limit);

  const rows: PulledRows = {};
  for (const entry of included) {
    (rows[entry.table] ??= []).push(entry.row);
  }

  return {
    rows,
    cursor: included.length > 0 ? included[included.length - 1].seq : since,
    hasMore: candidates.length > included.length,
    bandIds,
  };
}
