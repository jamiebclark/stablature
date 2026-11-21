/**
 * INV-028 (review round 2): "never does a full device keep fetching". Round 1's F3 fix (T111) gives `full` a
 * `nextAt`, so a later cycle asks again (FR-071). This probe checks the other half while the device STAYS full:
 *   - the older memo is never asked for while the newest still does not fit (the invariant's own probe);
 *   - how often the memo that did not fit is downloaded again (each GET re-downloads the whole clip).
 *
 * Through the public `workMemos` (fake fetch, fake-indexeddb, fake clock). Cycles run every 60 s (the runner's poll)
 * for 10 minutes, then every 6 s (a busy band's "changed" events) for 1 minute.
 */
import "fake-indexeddb/auto";

import { expect, it } from "vitest";
import { StablatureDb } from "@/lib/local/db";
import type { MemoRow } from "@/lib/model";
import { workMemos, type TransferDeps } from "@/lib/memos/transfer";

const hlc = "000000000000001:0000:t";
const memo = (id: string, recordedAt: number): MemoRow => ({
  id, bandId: "band", partId: "part", recordedById: "u", recordedByName: "Sam", durationMs: 2000,
  format: "audio/webm;codecs=opus", size: 4, recordedAt, label: null, updatedAt: hlc, deletedAt: null,
  fieldClocks: {}, serverSeq: 5,
});

it("a device that stays full never asks for the older memo, and re-downloads the one that did not fit", async () => {
  const db = new StablatureDb("inv028-stays-full");
  let clock = 1_000_000;
  await db.memos.bulkPut([memo("old", 1), memo("new", 2)]);
  const gets: string[] = [];
  const deps: Partial<TransferDeps> = {
    db,
    now: () => clock,
    persist: async () => undefined,
    fetch: (async (input: RequestInfo | URL) => {
      gets.push(String(input));
      return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { "content-type": "audio/webm" } });
    }) as typeof fetch,
  };
  type Put = typeof db.memoAudio.put;
  db.memoAudio.put = (() =>
    Promise.reject(Object.assign(new Error("quota"), { name: "QuotaExceededError" }))) as unknown as Put;

  await workMemos(deps);
  expect((await db.memoFetches.get("new"))?.status).toBe("full");

  for (let cycle = 0; cycle < 10; cycle++) {
    clock += 60_000;
    await workMemos(deps);
  }
  const afterPolls = gets.length;
  for (let cycle = 0; cycle < 10; cycle++) {
    clock += 6_000;
    await workMemos(deps);
  }
  const entry = await db.memoFetches.get("new");
  console.log(
    "INV-028 stays-full:",
    JSON.stringify({
      getsOverTenPolls: afterPolls - 1,
      getsOverTenBusyCycles: gets.length - afterPolls,
      olderAsked: gets.filter((g) => g.includes("/old/")).length,
      entry,
    }),
  );
  // The invariant: the older memo is never asked for while the newest still does not fit.
  expect(gets.filter((g) => g.includes("/old/"))).toEqual([]);
  // Recorded, not asserted as a defect: the full memo is downloaded again on every cycle past a fixed 5 s wait,
  // because `full` keeps `attempts` unchanged (`transfer.ts:208`), so its backoff never grows. See review.md F17.
});
