/** INV-015: what each answer does to the queue entry, and what a pass asks for, over three passes. */
import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";
import { StablatureDb } from "../../local/db";
import { retryMemo } from "../../local/memos";
import type { MemoRow } from "../../model";
import { BACKOFF_MS, WAITING_RECHECK_MS } from "../limits";
import { classify, clearWaiting, workMemos, type TransferDeps } from "../transfer";

let db: StablatureDb;
let clock = 1_000_000;
let n = 0;
const hlc = "000000000000001:0000:t";

beforeEach(() => {
  db = new StablatureDb(`transfer-${n++}`);
  clock = 1_000_000;
});

const memo = (id: string, over: Partial<MemoRow> = {}): MemoRow => ({
  id,
  bandId: "band",
  partId: "part",
  recordedById: null,
  recordedByName: null,
  durationMs: 2000,
  format: "audio/webm;codecs=opus",
  size: 4,
  recordedAt: 1,
  label: null,
  updatedAt: hlc,
  deletedAt: null,
  fieldClocks: {},
  serverSeq: 5,
  ...over,
});

const json = (status: number, code: string, message = `words for ${code}`) =>
  new Response(JSON.stringify({ code, message }), { status });
const audio = () => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { "content-type": "audio/webm" } });

function harness(answer: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; method: string }[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const deps: Partial<TransferDeps> = {
    db,
    now: () => clock,
    persist: async () => undefined,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method ?? "GET" });
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        await Promise.resolve();
        return await answer(String(input), init);
      } finally {
        inFlight--;
      }
    }) as typeof fetch,
  };
  return { deps, calls, maxInFlight: () => maxInFlight };
}

async function local(id: string, over: Partial<MemoRow> = {}) {
  await db.memos.put(memo(id, over));
  await db.memoAudio.put({ memoId: id, bytes: new Uint8Array([1, 2, 3, 4]).buffer, format: "audio/webm", size: 4 });
  await db.memoUploads.put({ memoId: id, bandId: "band", attempts: 0, nextAt: 0, refusal: null, account: null });
}

describe("classify (the one table of answers)", () => {
  it("reads each answer the way contracts 4 says", () => {
    expect(classify("upload", 201, null).kind).toBe("done");
    expect(classify("fetch", 200, null).kind).toBe("done");
    expect(classify("upload", 401, null).kind).toBe("stop");
    expect(classify("fetch", 401, null).kind).toBe("stop");
    expect(classify("upload", 404, { code: "not_found", message: "m" }).kind).toBe("refusal");
    expect(classify("fetch", 404, { code: "not_found", message: "m" }).kind).toBe("waiting");
    expect(classify("fetch", 404, { code: "not_uploaded", message: "m" }).kind).toBe("waiting");
    for (const code of ["read_only", "different_file", "too_large", "format", "format_mismatch", "size_mismatch", "content_mismatch", "band_full"]) {
      expect(classify("upload", 400, { code, message: "m" }).kind, code).toBe("refusal");
    }
    for (const code of ["deleted", "erased", "part_deleted"]) expect(classify("upload", 410, { code, message: "m" }).kind).toBe("gone");
    expect(classify("fetch", 410, { code: "erased", message: "m" }).kind).toBe("erased");
    expect(classify("upload", 400, { code: "incomplete", message: "m" }).kind).toBe("retry");
    for (const status of [408, 429, 500, 503]) {
      expect(classify("upload", status, null).kind).toBe("retry");
      expect(classify("fetch", status, null).kind).toBe("retry");
    }
  });
});

describe("uploads", () => {
  it("a 201 removes the entry; the clip stays", async () => {
    await local("a");
    const h = harness(() => json(201, "stored"));
    await workMemos(h.deps);
    expect(await db.memoUploads.get("a")).toBeUndefined();
    expect(await db.memoAudio.get("a")).toBeDefined();
    expect(h.calls).toEqual([{ url: "/api/memos/a/audio", method: "PUT" }]);
  });

  it("nothing is sent before the row has a serverSeq", async () => {
    await local("a", { serverSeq: 0 });
    const h = harness(() => json(201, "stored"));
    for (let i = 0; i < 3; i++) await workMemos(h.deps);
    expect(h.calls).toEqual([]);
    expect(await db.memoUploads.get("a")).toBeDefined();
  });

  it("a refusal keeps its words, is not asked again, and goes again after Try again", async () => {
    await local("a");
    const h = harness(() => json(403, "read_only", "You have read-only access to that band."));
    for (let i = 0; i < 3; i++) await workMemos(h.deps);
    expect(h.calls).toHaveLength(1);
    expect((await db.memoUploads.get("a"))?.refusal).toEqual({ code: "read_only", message: "You have read-only access to that band." });
    await retryMemo("a", { db });
    await workMemos(h.deps);
    expect(h.calls).toHaveLength(2);
  });

  it("a network failure is retried on the backoff schedule", async () => {
    await local("a");
    const h = harness(() => {
      throw new TypeError("offline");
    });
    await workMemos(h.deps);
    expect((await db.memoUploads.get("a"))?.attempts).toBe(1);
    await workMemos(h.deps);
    expect(h.calls).toHaveLength(1);
    clock += BACKOFF_MS[0];
    await workMemos(h.deps);
    expect(h.calls).toHaveLength(2);
    expect((await db.memoUploads.get("a"))?.nextAt).toBe(clock + BACKOFF_MS[1]);
  });

  it("an `incomplete` answer is retried, not refused", async () => {
    await local("a");
    await workMemos(harness(() => json(400, "incomplete")).deps);
    expect((await db.memoUploads.get("a"))?.refusal).toBeNull();
    expect((await db.memoUploads.get("a"))?.attempts).toBe(1);
  });

  it("a 410 erases everything held for the memo", async () => {
    await local("a");
    await workMemos(harness(() => json(410, "deleted")).deps);
    expect(await db.memoAudio.get("a")).toBeUndefined();
    expect(await db.memoUploads.get("a")).toBeUndefined();
  });

  it("a 401 stops the pass and keeps the entry", async () => {
    await local("a");
    await local("b");
    const h = harness(() => json(401, "signed_out"));
    await workMemos(h.deps);
    expect(h.calls).toHaveLength(1);
    expect(await db.memoUploads.count()).toBe(2);
  });
});

describe("fetches", () => {
  it("newest first, one request at a time, and the clip is kept", async () => {
    await db.memos.bulkPut([memo("old", { recordedAt: 1 }), memo("new", { recordedAt: 3 }), memo("mid", { recordedAt: 2 })]);
    const h = harness(() => audio());
    await workMemos(h.deps);
    expect(h.calls.map((c) => c.url)).toEqual(["/api/memos/new/audio", "/api/memos/mid/audio", "/api/memos/old/audio"]);
    expect(h.maxInFlight()).toBe(1);
    expect(await db.memoAudio.count()).toBe(3);
    expect(await db.memoFetches.count()).toBe(0);
  });

  it("uploads go before fetches", async () => {
    await local("mine");
    await db.memos.put(memo("theirs"));
    const h = harness((_url, init) => (init?.method === "PUT" ? json(201, "stored") : audio()));
    await workMemos(h.deps);
    expect(h.calls.map((c) => c.method)).toEqual(["PUT", "GET"]);
  });

  it("not uploaded yet: waits, then asks again after the recheck delay or clearWaiting", async () => {
    await db.memos.put(memo("a"));
    const h = harness(() => json(404, "not_uploaded"));
    await workMemos(h.deps);
    expect((await db.memoFetches.get("a"))?.status).toBe("waiting");
    await workMemos(h.deps);
    expect(h.calls).toHaveLength(1);
    await clearWaiting(db);
    await workMemos(h.deps);
    expect(h.calls).toHaveLength(2);
    clock += WAITING_RECHECK_MS;
    await workMemos(h.deps);
    expect(h.calls).toHaveLength(3);
  });

  it("erased on the server: remembered, never asked again", async () => {
    await db.memos.put(memo("a"));
    const h = harness(() => json(410, "erased"));
    for (let i = 0; i < 3; i++) await workMemos(h.deps);
    expect(h.calls).toHaveLength(1);
    expect((await db.memoFetches.get("a"))?.status).toBe("erased");
  });

  it("a 5xx is failed with backoff, and is asked again once the wait is over", async () => {
    await db.memos.put(memo("a"));
    const h = harness(() => json(503, "x"));
    await workMemos(h.deps);
    expect((await db.memoFetches.get("a"))?.status).toBe("failed");
    await workMemos(h.deps);
    expect(h.calls).toHaveLength(1);
    clock += BACKOFF_MS[0];
    await workMemos(h.deps);
    expect(h.calls).toHaveLength(2);
  });

  it("a memo recorded here, or deleted, or not yet on the server, is never fetched", async () => {
    await local("mine");
    await db.memos.bulkPut([memo("gone", { deletedAt: hlc }), memo("new", { serverSeq: 0 })]);
    const h = harness((_u, init) => (init?.method === "PUT" ? json(201, "stored") : audio()));
    await workMemos(h.deps);
    expect(h.calls.filter((c) => c.method === "GET")).toEqual([]);
  });

  it("a full device holds the older memos until Try again", async () => {
    await db.memos.bulkPut([memo("old", { recordedAt: 1 }), memo("new", { recordedAt: 2 })]);
    const h = harness(() => audio());
    const real = db.memoAudio.put.bind(db.memoAudio);
    let full = true;
    db.memoAudio.put = ((...args: Parameters<typeof real>) =>
      full ? Promise.reject(Object.assign(new Error("quota"), { name: "QuotaExceededError" })) : real(...args)) as typeof real;
    await workMemos(h.deps);
    await workMemos(h.deps);
    expect(h.calls.map((c) => c.url)).toEqual(["/api/memos/new/audio"]);
    expect((await db.memoFetches.get("new"))?.status).toBe("full");
    full = false;
    await retryMemo("new", { db });
    await workMemos(h.deps);
    expect(h.calls.map((c) => c.url)).toEqual(["/api/memos/new/audio", "/api/memos/new/audio", "/api/memos/old/audio"]);
  });
});
