/**
 * Moving memo audio between this device and the server (contracts/memo-audio-routes.md §4).
 *
 * `workMemos` runs after every sync cycle: uploads first, then fetches one at a time, newest first. It never
 * runs inside a Dexie transaction, because a request must not hold one open. Every answer is classified by
 * `classify`, the one table of what an answer means, so upload and fetch cannot disagree about a code.
 */

import { db as defaultDb, type StablatureDb } from "../local/db";
import { addMemoNotice, currentMemoAccount, eraseLocalMemoAudio } from "../local/memos";
import type { MemoRow } from "../model";
import { BACKOFF_MS, WAITING_RECHECK_MS } from "./limits";
import type { RefusalCode } from "./refusals";
import { ensurePersisted } from "./storage";

export interface TransferDeps {
  fetch: typeof fetch;
  now: () => number;
  db: StablatureDb;
  /** Called after a memo from elsewhere is first saved here (FR-070). */
  persist: (partId: string) => Promise<void>;
}

/** What an answer means to the entry that asked. */
export type Answer =
  | { kind: "done" }
  | { kind: "stop" }
  | { kind: "refusal"; code: RefusalCode; message: string }
  | { kind: "gone" }
  | { kind: "waiting" }
  | { kind: "erased" }
  | { kind: "retry" };

const UPLOAD_REFUSALS: ReadonlySet<string> = new Set([
  "not_found",
  "read_only",
  "different_file",
  "too_large",
  "format",
  "format_mismatch",
  "size_mismatch",
  "content_mismatch",
  "band_full",
]);

interface Body {
  code?: string;
  message?: string;
}

export function classify(step: "upload" | "fetch", status: number, body: Body | null): Answer {
  if (status === 200 || status === 201) return { kind: "done" };
  if (status === 401) return { kind: "stop" };
  const code = body?.code ?? "";
  if (step === "upload") {
    if (status === 410 && ["deleted", "erased", "part_deleted"].includes(code)) return { kind: "gone" };
    if (UPLOAD_REFUSALS.has(code) && typeof body?.message === "string") {
      return { kind: "refusal", code: code as RefusalCode, message: body.message };
    }
    return { kind: "retry" };
  }
  if (status === 404 && (code === "not_found" || code === "not_uploaded")) return { kind: "waiting" };
  if (status === 410 && code === "erased") return { kind: "erased" };
  return { kind: "retry" };
}

function backoff(attempts: number): number {
  return BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)];
}

// --- Which memos are downloading right now (read by the memo's card) -------------------------------------------

const downloading = new Set<string>();
const listeners = new Set<() => void>();

function setDownloading(id: string, on: boolean): void {
  if (on === downloading.has(id)) return;
  if (on) downloading.add(id);
  else downloading.delete(id);
  for (const l of listeners) l();
}

export function isDownloading(id: string): boolean {
  return downloading.has(id);
}

export function subscribeDownloading(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// --- The work --------------------------------------------------------------------------------------------------

function realDeps(): TransferDeps {
  return {
    fetch: (...a) => fetch(...a),
    now: () => Date.now(),
    db: defaultDb,
    persist: (partId) => ensurePersisted((words) => addMemoNotice({ partId, kind: "persist", words })),
  };
}

/** Another device may have uploaded since: stop waiting out the recheck delay. */
export async function clearWaiting(database: StablatureDb = defaultDb): Promise<void> {
  const waiting = await database.memoFetches.filter((f) => f.status === "waiting").toArray();
  for (const entry of waiting) await database.memoFetches.put({ ...entry, nextAt: 0 });
}

async function jsonOf(res: Response): Promise<Body | null> {
  try {
    return (await res.json()) as Body;
  } catch {
    return null;
  }
}

function isQuota(error: unknown): boolean {
  const e = error as { name?: string; inner?: { name?: string } } | null;
  return e?.name === "QuotaExceededError" || e?.inner?.name === "QuotaExceededError";
}

/** Returns false when the pass should stop (signed out). */
async function uploadOne(row: MemoRow, d: TransferDeps): Promise<boolean> {
  const entry = await d.db.memoUploads.get(row.id);
  const clip = await d.db.memoAudio.get(row.id);
  if (!entry) return true;
  if (!clip) {
    await d.db.memoUploads.delete(row.id);
    return true;
  }
  let answer: Answer;
  try {
    const res = await d.fetch(`/api/memos/${row.id}/audio`, {
      method: "PUT",
      headers: { "content-type": clip.format },
      body: clip.bytes,
    });
    answer = classify("upload", res.status, res.ok ? null : await jsonOf(res));
  } catch {
    answer = { kind: "retry" };
  }
  switch (answer.kind) {
    case "done":
      await d.db.memoUploads.delete(row.id);
      return true;
    case "stop":
      return false;
    case "refusal":
      await d.db.memoUploads.put({
        ...entry,
        refusal: { code: answer.code, message: answer.message },
        account: await currentMemoAccount(d.db),
      });
      return true;
    case "gone":
      await d.db.transaction(
        "rw",
        [d.db.memoAudio, d.db.memoUploads, d.db.memoFetches, d.db.memoDrafts, d.db.memoDraftChunks],
        () => eraseLocalMemoAudio(d.db, [row.id]),
      );
      return true;
    default:
      await d.db.memoUploads.put({
        ...entry,
        attempts: entry.attempts + 1,
        nextAt: d.now() + backoff(entry.attempts),
      });
      return true;
  }
}

async function fetchOne(row: MemoRow, d: TransferDeps): Promise<boolean> {
  const prior = await d.db.memoFetches.get(row.id);
  const attempts = prior?.attempts ?? 0;
  setDownloading(row.id, true);
  let answer: Answer;
  let bytes: ArrayBuffer | null = null;
  let type = row.format;
  try {
    const res = await d.fetch(`/api/memos/${row.id}/audio`);
    if (res.ok) {
      bytes = await res.arrayBuffer();
      type = res.headers.get("content-type") || row.format;
    }
    answer = classify("fetch", res.status, res.ok ? null : await jsonOf(res));
  } catch {
    answer = { kind: "retry" };
  } finally {
    setDownloading(row.id, false);
  }
  const put = (status: "waiting" | "failed" | "full" | "erased", nextAt: number, n: number) =>
    d.db.memoFetches.put({ memoId: row.id, status, attempts: n, nextAt });
  switch (answer.kind) {
    case "done": {
      const clip = bytes;
      if (!clip) return true;
      const live = await d.db.memos.get(row.id);
      if (!live || live.deletedAt) return true;
      try {
        await d.db.transaction("rw", [d.db.memoAudio, d.db.memoFetches], async () => {
          await d.db.memoAudio.put({ memoId: row.id, bytes: clip, format: type, size: clip.byteLength });
          await d.db.memoFetches.delete(row.id);
        });
        await d.persist(row.partId).catch(() => undefined);
      } catch (error) {
        if (isQuota(error)) await put("full", d.now() + backoff(attempts), attempts);
        else await put("failed", d.now() + backoff(attempts), attempts + 1);
      }
      return true;
    }
    case "stop":
      return false;
    case "waiting":
      await put("waiting", d.now() + WAITING_RECHECK_MS, attempts);
      return true;
    case "erased":
      await put("erased", 0, attempts);
      return true;
    default:
      await put("failed", d.now() + backoff(attempts), attempts + 1);
      return true;
  }
}

/**
 * One pass. Uploads first (a row the server has not accepted yet is not asked about), then fetches, newest
 * first and one at a time. A memo held for room (`full`) holds every other fetch until Try again or its backoff passes, then is asked for first.
 */
export async function workMemos(overrides: Partial<TransferDeps> = {}): Promise<void> {
  const d = { ...realDeps(), ...overrides };
  if (typeof navigator !== "undefined" && navigator.onLine === false && !overrides.fetch) return;

  const uploads = await d.db.memoUploads.toArray();
  for (const entry of uploads) {
    if (entry.refusal || entry.nextAt > d.now()) continue;
    const row = await d.db.memos.get(entry.memoId);
    if (!row || row.deletedAt || row.serverSeq === 0) continue;
    if (!(await uploadOne(row, d))) return;
  }

  const fetches = new Map((await d.db.memoFetches.toArray()).map((f) => [f.memoId, f]));
  if ([...fetches.values()].some((f) => f.status === "full" && f.nextAt > d.now())) return;
  const held = new Set((await d.db.memoAudio.toCollection().primaryKeys()) as string[]);
  const queued = new Set((await d.db.memoUploads.toCollection().primaryKeys()) as string[]);
  const wanted = (await d.db.memos.toArray())
    .filter((m) => !m.deletedAt && m.serverSeq > 0 && !held.has(m.id) && !queued.has(m.id))
    .filter((m) => {
      const f = fetches.get(m.id);
      return !f || (f.status !== "erased" && f.nextAt <= d.now());
    })
    .sort((a, b) => Number(fetches.get(b.id)?.status === "full") - Number(fetches.get(a.id)?.status === "full") || b.recordedAt - a.recordedAt || (a.id < b.id ? -1 : 1));
  for (const row of wanted) {
    if (!(await fetchOne(row, d))) return;
    if ((await d.db.memoFetches.get(row.id))?.status === "full") return;
  }
}
