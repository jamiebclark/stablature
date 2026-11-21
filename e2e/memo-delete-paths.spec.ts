/**
 * INV-004 over the Del members `e2e/memo-delete.spec.ts` does not reach (adopted from review round 1). That spec runs
 * D1 (delete on the recording device) and D2 (tombstone pulled); D3 is `memo-part-delete`, D4 is `erase.test.ts`,
 * D5 is `memo-recorder`. This probe runs the other three through the real interfaces:
 *
 *   D6 a tombstone reaching the server before any upload  → memo_audio ERASED; a later PUT 410; GET 410 erased;
 *   D7 a tombstone landing while the recording device's upload is queued → the queued PUT is refused 410 and the
 *      recording device drops its clip and queue entry; nothing is stored on the server;
 *   D8 a memo deleted on the recording device before it ever uploads → no PUT is ever sent, the device holds nothing,
 *      the tombstone still syncs and the server marks the audio ERASED.
 */
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { dump, recordMemo, sharePartA, signUp, twoMembers, withFakeMicrophone } from "./memo-helpers";

const DB_URL = process.env.STABLATURE_DATABASE_URL;
withFakeMicrophone();
test.skip(!DB_URL, "STABLATURE_DATABASE_URL is not set");
// One client per test, ended after it: a module-level client ended in afterAll is CONNECTION_ENDED under fullyParallel.
let sql: ReturnType<typeof postgres>;
test.beforeEach(() => {
  sql = postgres(DB_URL ?? "postgres://unset", { max: 2, onnotice: () => {} });
});
test.afterEach(async () => {
  await sql.end();
});

const memoTables = ["memoAudio", "memoUploads", "memoFetches", "memoDrafts"] as const;
const holds = (dumped: string, id: string) => {
  const all = JSON.parse(dumped) as Record<string, unknown[]>;
  return memoTables.filter((t) => JSON.stringify(all[t] ?? []).includes(id));
};
const audioRow = async (id: string) =>
  (await sql`select bytes is not null as stored, erased_at is not null as erased from memo_audio where memo_id = ${id}`)[0] ?? null;

const NOW = Date.now();
const hlc = (ms: number) => `${String(ms).padStart(15, "0")}:0000:e2e`;
const meta = () => ({ updatedAt: hlc(NOW), deletedAt: null, fieldClocks: { deletedAt: hlc(NOW), label: hlc(NOW) }, serverSeq: 0 });

test("D6: a tombstone before any upload leaves the audio ERASED and refuses a later upload", async ({ page }) => {
  await signUp(page);
  const [bandId, songId, partId, memoId] = Array.from({ length: 4 }, () => randomUUID());
  const memo = (over: Record<string, unknown> = {}) => ({
    table: "memos",
    row: { id: memoId, bandId, partId, recordedById: null, recordedByName: null, durationMs: 2000, format: "audio/webm;codecs=opus", size: 64, recordedAt: NOW, label: null, ...meta(), ...over },
  });
  const made = await page.request.post("/api/sync/push", {
    data: {
      mutations: [
        { table: "bands", row: { id: bandId, name: `D6 ${bandId.slice(0, 6)}`, slug: `d6-${bandId.slice(0, 8)}`, ...meta() } },
        { table: "songs", row: { id: songId, bandId, title: "D6", tuningId: null, bpm: null, notes: null, ...meta() } },
        { table: "parts", row: { id: partId, bandId, songId, label: "A", name: null, rank: "a0", variantOfPartId: null, notes: null, ...meta() } },
        memo(),
      ],
    },
  });
  expect((await made.json()).rejected).toEqual([]);
  const t = hlc(NOW + 10);
  await page.request.post("/api/sync/push", { data: { mutations: [memo({ deletedAt: t, updatedAt: t, fieldClocks: { deletedAt: t, label: hlc(NOW) } })] } });
  expect(await audioRow(memoId)).toEqual({ stored: false, erased: true });
  const body = Buffer.alloc(64, 1);
  body.set([0x1a, 0x45, 0xdf, 0xa3]);
  const put = await page.request.put(`/api/memos/${memoId}/audio`, { data: body, headers: { "content-type": "audio/webm;codecs=opus" } });
  expect(put.status()).toBe(410);
  const get = await page.request.get(`/api/memos/${memoId}/audio`);
  expect(get.status()).toBe(410);
  expect((await get.json()).code).toBe("erased");
  expect(await audioRow(memoId)).toEqual({ stored: false, erased: true });
});

test("D7 and D8 on the recording device", async ({ browser }) => {
  test.setTimeout(180_000);
  const trio = await twoMembers(browser);
  try {
    await sharePartA(trio);
    const { owner: A, guest: B } = trio;

    // D7: A's upload is stuck on the network; B deletes the memo; A's next attempt is refused and A drops the clip.
    let blocked = true;
    await A.page.route("**/api/memos/*/audio", (route) =>
      route.request().method() === "PUT" && blocked ? route.abort("connectionreset") : route.continue(),
    );
    await recordMemo(A.page, "A", 2_000);
    const d7 = (await A.page.getByTestId("memo").first().getAttribute("data-memo-id"))!;
    await expect.poll(async () => (await sql`select count(*)::int n from memos where id = ${d7}`)[0].n, { timeout: 20_000 }).toBe(1);
    await B.page.reload();
    await expect(B.page.getByTestId("memo")).toHaveCount(1, { timeout: 20_000 });
    await B.page.getByRole("button", { name: /^Actions for memo/ }).click();
    await B.page.getByRole("menuitem", { name: /^Delete memo/ }).click();
    await B.page.getByRole("button", { name: "Delete memo", exact: true }).click();
    await expect.poll(async () => (await audioRow(d7))?.erased ?? false, { timeout: 20_000 }).toBe(true);
    blocked = false;
    await expect.poll(async () => holds(await dump(A.page), d7), { timeout: 40_000 }).toEqual([]);
    await expect(A.page.getByTestId("memo")).toHaveCount(0, { timeout: 20_000 });
    expect(await audioRow(d7)).toEqual({ stored: false, erased: true });

    // D8: A records offline, deletes before any upload; back online, the tombstone syncs and no PUT is ever sent.
    const puts: string[] = [];
    A.page.on("request", (r) => {
      if (r.method() === "PUT" && r.url().includes("/api/memos/")) puts.push(r.url());
    });
    await A.context.setOffline(true);
    await recordMemo(A.page, "A", 2_000);
    const d8 = (await A.page.getByTestId("memo").first().getAttribute("data-memo-id"))!;
    await A.page.getByRole("button", { name: /^Actions for memo/ }).click();
    await A.page.getByRole("menuitem", { name: /^Delete memo/ }).click();
    await A.page.getByRole("button", { name: "Delete memo", exact: true }).click();
    await expect(A.page.getByTestId("memo")).toHaveCount(0);
    expect(holds(await dump(A.page), d8)).toEqual([]);
    await A.context.setOffline(false);
    await expect.poll(async () => (await sql`select deleted_at is not null as gone from memos where id = ${d8}`)[0]?.gone ?? false, { timeout: 30_000 }).toBe(true);
    expect(await audioRow(d8)).toEqual({ stored: false, erased: true });
    await A.page.waitForTimeout(2_000);
    expect(puts.filter((u) => u.includes(d8))).toEqual([]);
  } finally {
    await trio.close();
  }
});
