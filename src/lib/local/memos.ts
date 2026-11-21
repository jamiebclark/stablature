/**
 * Voice memos on this device. React-free.
 *
 * `eraseLocalMemoAudio` is the one eraser: every local path that drops a clip
 * calls it, so no copy of a deleted memo's audio can outlive its memo.
 */

import { newId } from "../ids";
import { normaliseFormat } from "../memos/formats";
import { LABEL_MAX } from "../memos/limits";
import type { MemoRow } from "../model";
import { db as defaultDb, type MemoDraft, type MemoNotice, type StablatureDb } from "./db";
import { deleteRow, insertRow, mutateBatch, patchRow, requeueRow, type MutateContext } from "./mutate";

/**
 * Drop everything this device holds for these memos: the clip, its upload
 * entry, its fetch state, and any draft recording of it. The caller owns the
 * transaction (it must span the five memo tables); stopping a sound that is
 * playing one of them is wired in with the player.
 */
export async function eraseLocalMemoAudio(
  database: StablatureDb = defaultDb,
  memoIds: readonly string[],
): Promise<void> {
  if (memoIds.length === 0) return;
  const ids = [...memoIds];
  await database.memoAudio.bulkDelete(ids);
  await database.memoUploads.bulkDelete(ids);
  await database.memoFetches.bulkDelete(ids);

  const drafts = await database.memoDrafts.where("id").anyOf(await draftIdsFor(database, ids)).toArray();
  const draftIds = drafts.map((d) => d.id);
  if (draftIds.length > 0) {
    await database.memoDraftChunks.where("draftId").anyOf(draftIds).delete();
    await database.memoDrafts.bulkDelete(draftIds);
  }
}

async function draftIdsFor(database: StablatureDb, memoIds: string[]): Promise<string[]> {
  const all = await database.memoDrafts.toArray();
  const wanted = new Set(memoIds);
  return all.filter((d) => wanted.has(d.memoId)).map((d) => d.id);
}

/**
 * A memo was deleted in this band, so there is room again: a `band_full`
 * refusal held in the band goes back in the queue.
 */
export async function clearBandFull(database: StablatureDb, bandId: string): Promise<void> {
  const refused = await database.memoUploads
    .filter((u) => u.bandId === bandId && u.refusal?.code === "band_full")
    .toArray();
  for (const entry of refused) {
    await database.memoUploads.put({ ...entry, refusal: null, attempts: 0, nextAt: 0 });
  }
}

const META_MEMO_ACCOUNT = "memoAccount";

/** The user id last passed to `setMemoAccount`, or null. */
export async function currentMemoAccount(
  database: StablatureDb = defaultDb,
): Promise<string | null> {
  const entry = await database.meta.get(META_MEMO_ACCOUNT);
  return typeof entry?.value === "string" ? entry.value : null;
}

// --- The write path (contracts/sync-and-storage.md §6) -------------------------------------------------------


const META_NOTICES = "memoNotices";
const NOTICES_PER_PART = 5;

/** Live memos of a part, oldest first (ties by id). */
export async function liveMemos(partId: string, database: StablatureDb = defaultDb): Promise<MemoRow[]> {
  const rows = await database.memos.where("partId").equals(partId).toArray();
  return rows
    .filter((m) => m.deletedAt === null)
    .sort((a, b) => a.recordedAt - b.recordedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Keep a finished recording: the row and its outbox entry, the clip, the upload entry, and the draft's removal,
 * all in one transaction, so a clip is never half-saved. The upload entry exists signed in or out: the memo
 * was recorded here, and the pass only runs while signed in.
 */
export async function saveMemo(
  draft: MemoDraft,
  bytes: ArrayBuffer,
  durationMs: number,
  ctx: MutateContext = {},
): Promise<MemoRow> {
  const database = ctx.db ?? defaultDb;
  const format = normaliseFormat(draft.format) ?? draft.format;
  let saved!: MemoRow;
  await mutateBatch(async (c) => {
    saved = await insertRow(
      "memos",
      {
        id: draft.memoId,
        bandId: draft.bandId,
        partId: draft.partId,
        recordedById: null,
        recordedByName: null,
        durationMs: Math.round(durationMs),
        format,
        size: bytes.byteLength,
        recordedAt: Date.now(),
        label: null,
      },
      c,
    );
    await database.memoAudio.put({ memoId: draft.memoId, bytes, format, size: bytes.byteLength });
    await database.memoUploads.put({
      memoId: draft.memoId,
      bandId: draft.bandId,
      attempts: 0,
      nextAt: 0,
      refusal: null,
      account: null,
    });
    await database.memoDraftChunks.where("draftId").equals(draft.id).delete();
    await database.memoDrafts.delete(draft.id);
  }, ctx);
  return saved;
}

/** A label is trimmed and cut to `LABEL_MAX`; nothing left stores null. */
export async function renameMemo(id: string, label: string, ctx: MutateContext = {}): Promise<void> {
  const trimmed = label.trim().slice(0, LABEL_MAX).trim();
  await patchRow("memos", id, { label: trimmed || null }, ctx);
}

/** Tombstone a memo and erase every local copy of its audio, together. */
export async function deleteMemo(id: string, ctx: MutateContext = {}): Promise<void> {
  const database = ctx.db ?? defaultDb;
  await mutateBatch(async (c) => {
    const row = await database.memos.get(id);
    await deleteRow("memos", id, c);
    await eraseLocalMemoAudio(database, [id]);
    if (row) await clearBandFull(database, row.bandId);
  }, ctx);
}

/**
 * Delete a part and every live memo on it in one batch. The memos are read inside the transaction, so one
 * recorded a moment ago is not left behind; a part with none writes exactly what deleting a part always did.
 */
export async function deletePart(partId: string, ctx: MutateContext = {}): Promise<void> {
  const database = ctx.db ?? defaultDb;
  await mutateBatch(async (c) => {
    const memos = await liveMemos(partId, database);
    for (const m of memos) await deleteRow("memos", m.id, c);
    await deleteRow("parts", partId, c);
    if (memos.length > 0) {
      await eraseLocalMemoAudio(database, memos.map((m) => m.id));
      await clearBandFull(database, memos[0].bandId);
    }
  }, ctx);
}

// --- Notices (meta.memoNotices) -------------------------------------------------------------------------------

export async function listMemoNotices(database: StablatureDb = defaultDb): Promise<MemoNotice[]> {
  const entry = await database.meta.get(META_NOTICES);
  return Array.isArray(entry?.value) ? (entry.value as MemoNotice[]) : [];
}

async function writeNotices(database: StablatureDb, notices: MemoNotice[]): Promise<void> {
  await database.meta.put({ key: META_NOTICES, value: notices });
}

/** Add a notice for a part; keeps at most five per part, dropping the oldest. */
export async function addMemoNotice(
  notice: Omit<MemoNotice, "id" | "at">,
  database: StablatureDb = defaultDb,
): Promise<void> {
  await database.transaction("rw", database.meta, async () => {
    const all = await listMemoNotices(database);
    const next = [...all, { ...notice, id: newId(), at: Date.now() }];
    const mine = next.filter((n) => n.partId === notice.partId);
    const drop = new Set(mine.slice(0, Math.max(0, mine.length - NOTICES_PER_PART)).map((n) => n.id));
    await writeNotices(database, next.filter((n) => !drop.has(n.id)));
  });
}

/** A new recording on a part replaces that part's earlier notices, except the persistence one, which stays until dismissed. */
export async function clearPartNotices(partId: string, database: StablatureDb = defaultDb): Promise<void> {
  await database.transaction("rw", database.meta, async () => {
    const all = await listMemoNotices(database);
    const gone = (n: MemoNotice) => n.partId === partId && n.kind !== "persist";
    if (all.some(gone)) await writeNotices(database, all.filter((n) => !gone(n)));
  });
}

export async function dismissMemoNotice(id: string, database: StablatureDb = defaultDb): Promise<void> {
  await database.transaction("rw", database.meta, async () => {
    const all = await listMemoNotices(database);
    await writeNotices(database, all.filter((n) => n.id !== id));
  });
}

/** Fired on `window` by Try again, so the sync loop runs a pass now rather than at its next cue. */
export const MEMO_RETRY_EVENT = "stablature:memo-retry";

/** Try a held or failed memo again: clear its refusal and its fetch backoff. */
export async function retryMemo(id: string, ctx: MutateContext = {}): Promise<void> {
  const database = ctx.db ?? defaultDb;
  const row = await database.memos.get(id);
  await database.transaction("rw", [database.memoUploads, database.memoFetches], async () => {
    const upload = await database.memoUploads.get(id);
    if (upload) await database.memoUploads.put({ ...upload, refusal: null, attempts: 0, nextAt: 0 });
    await database.memoFetches.delete(id);
  });
  if (row && row.serverSeq === 0) await requeueRow("memos", id, ctx);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(MEMO_RETRY_EVENT));
}

/**
 * Tell memos who is signed in. A refusal received under another account is not this account's answer, so those
 * entries are asked again (FR-035).
 */
export async function setMemoAccount(userId: string, ctx: MutateContext = {}): Promise<void> {
  const database = ctx.db ?? defaultDb;
  if ((await currentMemoAccount(database)) === userId) return;
  await database.meta.put({ key: META_MEMO_ACCOUNT, value: userId });
  const refused = await database.memoUploads.filter((u) => u.refusal !== null && u.account !== userId).toArray();
  for (const entry of refused) await retryMemo(entry.memoId, ctx);
}
