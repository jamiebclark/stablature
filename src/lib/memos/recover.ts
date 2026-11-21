/**
 * Boot-time recovery of a recording cut off by a crash or a closed app (research R11, FR-025).
 *
 * Every draft left behind is joined from its chunks, checked for playing, and either saved through the same
 * `saveMemo` path as any recording (E13) or dropped with one notice (E14). A draft whose part is gone is dropped
 * without a word: there is no card to say it on.
 */

import { db, type MemoDraft } from "../local/db";
import { addMemoNotice, saveMemo } from "../local/memos";
import { MAX_BYTES, MIN_DURATION_MS, TIMESLICE_MS } from "./limits";
import { prefixWithin } from "./recorder";
import { noticeWords, type EndingKind } from "./words";

export interface Probed {
  playable: boolean;
  /** The metadata duration, when the browser knows a finite one. */
  durationMs: number | null;
}

export interface RecoverDeps {
  drafts(): Promise<{ draft: MemoDraft; chunks: ArrayBuffer[] }[]>;
  partLive(partId: string): Promise<boolean>;
  probe(bytes: ArrayBuffer, format: string): Promise<Probed>;
  save(draft: MemoDraft, bytes: ArrayBuffer, durationMs: number): Promise<void>;
  drop(draftId: string): Promise<void>;
  notice(n: { partId: string; kind: EndingKind; words: string }): Promise<void>;
}

const PROBE_TIMEOUT_MS = 3_000;

/** Load the bytes into an `Audio` element; playable means metadata arrived before an error or 3 s. */
export function probePlayable(bytes: ArrayBuffer, format: string): Promise<Probed> {
  return new Promise((resolve) => {
    if (typeof Audio === "undefined") return resolve({ playable: false, durationMs: null });
    const url = URL.createObjectURL(new Blob([bytes], { type: format }));
    const audio = new Audio();
    let done = false;
    const end = (playable: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      const d = audio.duration;
      audio.removeAttribute("src");
      URL.revokeObjectURL(url);
      resolve({ playable, durationMs: playable && Number.isFinite(d) ? Math.round(d * 1000) : null });
    };
    const timer = setTimeout(() => end(false), PROBE_TIMEOUT_MS);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => end(true);
    audio.onerror = () => end(false);
    audio.src = url;
  });
}

function join(chunks: ArrayBuffer[]): ArrayBuffer {
  const out = new Uint8Array(chunks.reduce((a, c) => a + c.byteLength, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(new Uint8Array(c), at);
    at += c.byteLength;
  }
  return out.buffer;
}

export function realRecoverDeps(): RecoverDeps {
  return {
    async drafts() {
      const all = await db.memoDrafts.toArray();
      return Promise.all(
        all.map(async (draft) => {
          const rows = await db.memoDraftChunks.where("draftId").equals(draft.id).sortBy("index");
          return { draft, chunks: rows.map((r) => r.bytes) };
        }),
      );
    },
    async partLive(partId) {
      const part = await db.parts.get(partId);
      return !!part && part.deletedAt === null;
    },
    probe: probePlayable,
    async save(draft, bytes, durationMs) {
      await saveMemo(draft, bytes, durationMs);
    },
    async drop(draftId) {
      await db.transaction("rw", db.memoDrafts, db.memoDraftChunks, async () => {
        await db.memoDraftChunks.where("draftId").equals(draftId).delete();
        await db.memoDrafts.delete(draftId);
      });
    },
    notice: (n) => addMemoNotice(n),
  };
}

/** Recover every draft once. Returns how many became memos. */
export async function recoverDrafts(deps: RecoverDeps = realRecoverDeps()): Promise<number> {
  let recovered = 0;
  for (const { draft, chunks } of await deps.drafts()) {
    if (!(await deps.partLive(draft.partId))) {
      await deps.drop(draft.id);
      continue;
    }
    const kept = prefixWithin(
      chunks.map((c) => c.byteLength),
      MAX_BYTES,
    );
    const bytes = join(chunks.slice(0, kept));
    const probed = bytes.byteLength > 0 ? await deps.probe(bytes, draft.format) : { playable: false, durationMs: null };
    let durationMs = kept * TIMESLICE_MS;
    if (probed.durationMs !== null) durationMs = Math.min(durationMs, probed.durationMs);

    if (probed.playable && durationMs >= MIN_DURATION_MS) {
      await deps.save(draft, bytes, durationMs);
      await deps
        .notice({ partId: draft.partId, kind: "recovered", words: noticeWords("recovered", durationMs) ?? "" })
        .catch(() => undefined);
      recovered++;
    } else {
      await deps.drop(draft.id);
      await deps
        .notice({ partId: draft.partId, kind: "unrecoverable", words: noticeWords("unrecoverable") ?? "" })
        .catch(() => undefined);
    }
  }
  return recovered;
}
