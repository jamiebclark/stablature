/**
 * Client side of sync.
 *
 * Nothing here is in the read path. Screens render from IndexedDB and never
 * wait on this, so every function below can fail, retry, or simply not run,
 * and the app still works exactly as well as it did offline. That is the whole
 * reason the sync engine is allowed to be this plain.
 *
 * Two rules it holds to:
 *
 *  - Rows arriving from the server are applied with the same `mergeRow` the
 *    server uses, and *without* queueing an outbox entry. A pulled row is not
 *    a local edit; re-queueing it would make two devices bounce the same row
 *    back and forth forever.
 *  - Outbox entries are deleted by the exact ids that were sent. An edit made
 *    while a push was in flight gets its own entry with a later id, so it
 *    cannot be swallowed by that push's acknowledgement.
 */

import { db, getSyncCursor, setSyncCursor, type OutboxEntry, type StablatureDb } from "../local/db";
import { getClock } from "../local/device";
import { SYNCED_TABLES, type SyncedRow, type SyncedRows } from "../model";
import { mergeRow } from "./merge";
import { ROW_SCHEMAS, type PullResponse, type PushResponse } from "./protocol";

/** How many local writes go in one push. */
const PUSH_BATCH = 200;

const KNOWN_BANDS_KEY = "knownBandIds";
const STATUS_KEY = "syncStatus";

export type SyncState = "idle" | "syncing" | "offline" | "signed-out" | "error";

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt: number | null;
  /** Human-readable, and safe to show: never contains row content. */
  message: string | null;
}

async function setStatus(
  status: Partial<SyncStatus>,
  database: StablatureDb = db,
): Promise<void> {
  const current = await getStatus(database);
  await database.meta.put({ key: STATUS_KEY, value: { ...current, ...status } });
}

export async function getStatus(database: StablatureDb = db): Promise<SyncStatus> {
  const entry = await database.meta.get(STATUS_KEY);
  return (entry?.value as SyncStatus | undefined) ?? {
    state: "idle",
    lastSyncedAt: null,
    message: null,
  };
}

/**
 * Write rows that came from the server into the local mirror.
 *
 * Validated on the way in even though they came from our own server: a row
 * reaching Dexie malformed is far harder to diagnose than one rejected here,
 * and the schemas already exist.
 */
export async function applyRemoteRows(
  rows: PullResponse["rows"],
  database: StablatureDb = db,
): Promise<number> {
  const clock = getClock();
  let applied = 0;

  const batches: { table: (typeof SYNCED_TABLES)[number]; parsed: SyncedRow[] }[] = [];
  for (const table of SYNCED_TABLES) {
    const incoming = rows[table];
    if (!incoming || incoming.length === 0) continue;

    const parsed: SyncedRow[] = [];
    for (const candidate of incoming) {
      const result = ROW_SCHEMAS[table].safeParse(candidate);
      if (result.success) parsed.push(result.data as SyncedRow);
    }
    if (parsed.length > 0) batches.push({ table, parsed });
  }
  if (batches.length === 0) return 0;

  // One transaction, so a reader sees a part with its columns and chords, or none of them.
  await database.transaction("rw", batches.map(({ table }) => database[table]), async () => {
    for (const { table, parsed } of batches) {
      for (const remote of parsed) {
        // Fold the remote clock in before merging, so a later local edit is
        // ordered after what we have just learned about rather than tying with
        // it.
        clock.recv(remote.updatedAt);

        const local = (await database[table].get(remote.id)) as
          | SyncedRows[typeof table]
          | undefined;
        const merged = mergeRow(table, local, remote as never);
        await database[table].put(merged as never);
        applied += 1;
      }
    }
  });

  return applied;
}

/** Drain the outbox. Returns how many entries were accepted. */
export async function pushOnce(database: StablatureDb = db): Promise<number> {
  const batch = await database.outbox.orderBy("seq").limit(PUSH_BATCH).toArray();
  if (batch.length === 0) return 0;

  const response = await fetch("/api/sync/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      mutations: batch.map((entry) => ({ table: entry.table, row: entry.row })),
    }),
  });

  if (response.status === 401) {
    await setStatus(
      { state: "signed-out", message: "Sign in to sync. Nothing has been lost." },
      database,
    );
    return 0;
  }
  if (!response.ok) {
    await markAttempts(batch, `Server said ${response.status}`, database);
    throw new Error(`Push failed with ${response.status}`);
  }

  const result = (await response.json()) as PushResponse;

  // The server returns the merged rows, so there is no need to pull to find
  // out what our own writes became.
  await applyRemoteRows(result.rows, database);

  const sentIds = batch
    .map((entry) => entry.seq)
    .filter((seq): seq is number => typeof seq === "number");

  // Delete by the ids actually sent. An edit made while the push was in flight
  // has a higher seq, was never in this batch, and so keeps its place.
  //
  // Rejected entries are dropped along with the rest, deliberately: every
  // rejection reason the server can give (not a member, read-only, invalid) is
  // permanent, so retrying would loop forever. They are surfaced below
  // instead, because silently discarding somebody's riff is the worst
  // available outcome.
  await database.outbox.bulkDelete(sentIds);

  if (result.rejected.length > 0) {
    const [first] = result.rejected;
    await setStatus(
      {
        state: "error",
        message:
          result.rejected.length === 1
            ? first.message
            : `${result.rejected.length} changes were refused. ${first.message}`,
      },
      database,
    );
  }

  return batch.length - result.rejected.length;
}

async function markAttempts(
  batch: readonly OutboxEntry[],
  message: string,
  database: StablatureDb,
): Promise<void> {
  await database.transaction("rw", [database.outbox], async () => {
    for (const entry of batch) {
      if (typeof entry.seq !== "number") continue;
      await database.outbox.update(entry.seq, { attempts: entry.attempts + 1 });
    }
  });
  await setStatus({ state: "error", message }, database);
}

/** Fetch everything above the local cursor, following pages to the end. */
export async function pullOnce(database: StablatureDb = db): Promise<number> {
  let total = 0;

  for (let page = 0; page < 50; page += 1) {
    const since = await getSyncCursor(database);
    const response = await fetch(`/api/sync/pull?since=${since}`, { cache: "no-store" });

    if (response.status === 401) {
      await setStatus(
        { state: "signed-out", message: "Sign in to sync. Nothing has been lost." },
        database,
      );
      return total;
    }
    if (!response.ok) throw new Error(`Pull failed with ${response.status}`);

    const result = (await response.json()) as PullResponse;

    /*
     * Being added to an existing band is the one case the cursor cannot
     * handle: that band's rows already sit below our cursor and would never
     * arrive. Noticing a band we have not seen before is the signal to rewind
     * and pull its history. Cheap, because a band's whole catalogue is small.
     */
    const known = await knownBandIds(database);
    const unseen = result.bandIds.filter((id) => !known.has(id));
    if (unseen.length > 0 && since > 0) {
      await setKnownBandIds(result.bandIds, database);
      await setSyncCursor(0, database);
      continue;
    }
    await setKnownBandIds(result.bandIds, database);

    total += await applyRemoteRows(result.rows, database);
    await setSyncCursor(result.cursor, database);

    if (!result.hasMore) break;
  }

  return total;
}

async function knownBandIds(database: StablatureDb): Promise<Set<string>> {
  const entry = await database.meta.get(KNOWN_BANDS_KEY);
  return new Set(Array.isArray(entry?.value) ? (entry.value as string[]) : []);
}

async function setKnownBandIds(ids: string[], database: StablatureDb): Promise<void> {
  await database.meta.put({ key: KNOWN_BANDS_KEY, value: ids });
}

/**
 * One full cycle: push what we have, then take what is new.
 *
 * Push first. Pulling first would mean our own queued edits merge against
 * rows that do not yet reflect them, which converges to the same place but
 * makes the intermediate state on screen jump around.
 */
export async function syncNow(database: StablatureDb = db): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    await setStatus({ state: "offline", message: null }, database);
    return;
  }

  await setStatus({ state: "syncing", message: null }, database);
  try {
    // Keep draining while the outbox still has entries; a long offline session
    // can hold more than one batch.
    for (let round = 0; round < 50; round += 1) {
      const pushed = await pushOnce(database);
      if (pushed === 0) break;
    }
    await pullOnce(database);

    const status = await getStatus(database);
    // Do not stomp on a signed-out or rejection message with a cheerful one.
    if (status.state === "syncing") {
      await setStatus({ state: "idle", lastSyncedAt: Date.now(), message: null }, database);
    }
  } catch (error) {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    await setStatus(
      {
        state: offline ? "offline" : "error",
        message: error instanceof Error ? error.message : "Sync failed.",
      },
      database,
    );
  }
}
