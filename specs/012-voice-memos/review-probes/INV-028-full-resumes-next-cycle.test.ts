/**
 * INV-028 / FR-071 (review round 1, F3): "A full device while fetching MUST stop further fetches, mark the memo that
 * did not fit as Out of room on this device, and resume when the user chooses Try again OR THE NEXT SYNC CYCLE RUNS."
 * Spec edge case: "fetching resumes when room is made". data-model §4.3: `full` → "Try again, or the next cycle once
 * `nextAt` has passed" → asked again.
 *
 * Through the public `workMemos` (fake fetch, fake-indexeddb, fake clock): one cycle fills the device; room is then
 * made and later cycles run, with no Try again. Holds when a later cycle asks the server again and both memos end up
 * on the device.
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

it("a full device resumes fetching on a later sync cycle once there is room, without Try again", async () => {
  const db = new StablatureDb("inv028-probe");
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
  const real = db.memoAudio.put.bind(db.memoAudio);
  let full = true;
  db.memoAudio.put = ((...args: Parameters<typeof real>) =>
    full ? Promise.reject(Object.assign(new Error("quota"), { name: "QuotaExceededError" })) : real(...args)) as typeof real;

  await workMemos(deps);
  expect((await db.memoFetches.get("new"))?.status).toBe("full");
  const whileFull = gets.length;

  // Room is made (the user cleared space). Several sync cycles run over the next ten minutes; nobody taps Try again.
  full = false;
  for (let cycle = 0; cycle < 5; cycle++) {
    clock += 120_000;
    await workMemos(deps);
  }
  const held = (await db.memoAudio.toCollection().primaryKeys()).sort();
  console.log("INV-028 full-resumes:", JSON.stringify({ getsWhileFull: whileFull, getsAfterRoom: gets.length - whileFull, held }));
  expect(gets.length - whileFull, "no sync cycle asked the server again after room was made").toBeGreaterThan(0);
  expect(held).toEqual(["new", "old"]);
});
