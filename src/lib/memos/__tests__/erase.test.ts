/**
 * INV-004, device half: a memo tombstone and a part tombstone each leave nothing behind for the memo. The erase is
 * wired into `applyRemoteRows` (T024), so this passed from the start; it stays as the regression guard.
 */
import "fake-indexeddb/auto";

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { StablatureDb } from "../../local/db";
import { applyRemoteRows } from "../../sync/client";

const old = "000000000000001:0000:t";
const newer = "000000000000009:0000:t";
let n = 0;
const [M, P, B, S] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];

async function world() {
  const db = new StablatureDb(`erase-${n++}`);
  const base = { updatedAt: old, deletedAt: null, fieldClocks: { deletedAt: old, label: old }, serverSeq: 3 };
  await db.parts.put({ id: P, bandId: B, songId: S, label: "A", name: null, rank: "a0", variantOfPartId: null, notes: null, ...base } as never);
  await db.memos.put({
    id: M, bandId: B, partId: P, recordedById: "u", recordedByName: "U", durationMs: 2000,
    format: "audio/webm;codecs=opus", size: 4, recordedAt: 1, label: null, ...base,
  });
  await db.memoAudio.put({ memoId: M, bytes: new ArrayBuffer(4), format: "audio/webm", size: 4 });
  await db.memoUploads.put({ memoId: M, bandId: B, attempts: 0, nextAt: 0, refusal: null, account: null });
  await db.memoFetches.put({ memoId: M, status: "failed", attempts: 1, nextAt: 0 });
  await db.memoDrafts.put({ id: "d", memoId: M, partId: P, bandId: B, songId: S, format: "audio/webm", startedAt: 0 });
  await db.memoDraftChunks.put({ draftId: "d", index: 0, bytes: new ArrayBuffer(2) });
  return db;
}

async function leftovers(db: StablatureDb) {
  return {
    audio: await db.memoAudio.count(),
    uploads: await db.memoUploads.count(),
    fetches: await db.memoFetches.count(),
    drafts: await db.memoDrafts.count(),
    chunks: await db.memoDraftChunks.count(),
  };
}
const none = { audio: 0, uploads: 0, fetches: 0, drafts: 0, chunks: 0 };

describe("INV-004 (device)", () => {
  it("a memo tombstone erases every copy", async () => {
    const db = await world();
    const row = (await db.memos.get(M))!;
    await applyRemoteRows({ memos: [{ ...row, deletedAt: newer, updatedAt: newer, fieldClocks: { deletedAt: newer, label: old }, serverSeq: 4 }] } as never, db);
    expect((await db.memos.get(M))?.deletedAt).toBe(newer);
    expect(await leftovers(db)).toEqual(none);
  });

  it("a part tombstone erases every copy of its memos", async () => {
    const db = await world();
    const row = (await db.parts.get(P))!;
    await applyRemoteRows({ parts: [{ ...row, deletedAt: newer, updatedAt: newer, fieldClocks: { deletedAt: newer, label: old }, serverSeq: 4 }] } as never, db);
    expect(await leftovers(db)).toEqual(none);
  });

  it("an older tombstone changes nothing", async () => {
    const db = await world();
    const row = (await db.memos.get(M))!;
    await applyRemoteRows({ memos: [{ ...row, serverSeq: 4 }] } as never, db);
    expect((await leftovers(db)).audio).toBe(1);
  });
});
