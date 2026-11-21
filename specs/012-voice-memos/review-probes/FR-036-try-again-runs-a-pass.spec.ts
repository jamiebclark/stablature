/**
 * FR-036 / FR-071 "Try again" (review round 1, F5, MINOR). `retryMemo` clears the refusal, and
 * `src/lib/local/memos.ts` declares `MEMO_RETRY_EVENT` "fired on window by Try again, so the sync loop runs a pass now",
 * but nothing dispatches it and `runner.ts` only imports it. For a memo whose row the server already accepted, Try
 * again therefore sends nothing until the next poll (60 s), SSE event, outbox write, visibility change or `online`.
 *
 * Real flow: band X is filled to 500 MiB on the server, a memo is recorded, its upload is refused `band_full`, the room
 * is freed in Postgres, then Try again. Holds when a PUT follows the tap within 5 s. A poll that fires inside the
 * window can let it pass by luck (about 1 run in 12). Run it ALONE (`-g "Try again" --workers=1`): the SSE stream
 * wakes every client on any band's write, so another test's traffic also lets it pass by luck.
 */
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { recordMemo, seedServerAudio, signUp } from "../../../e2e/memo-helpers";

const DB_URL = process.env.STABLATURE_DATABASE_URL;
const sql = postgres(DB_URL ?? "postgres://unset", { max: 2, onnotice: () => {} });
test.skip(!DB_URL, "STABLATURE_DATABASE_URL is not set");
test.afterAll(async () => {
  await sql.end();
});

const NOW = Date.now();
const hlc = (ms: number) => `${String(ms).padStart(15, "0")}:0000:e2e`;
const meta = () => ({ updatedAt: hlc(NOW), deletedAt: null, fieldClocks: { deletedAt: hlc(NOW), label: hlc(NOW) }, serverSeq: 0 });

test("Try again on a band_full memo sends its upload at once", async ({ page }) => {
  await signUp(page);
  await page.getByLabel("Band name").fill(`Probe ${randomUUID().slice(0, 6)}`);
  await page.getByRole("button", { name: "Add band" }).click();
  await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);
  const bandId = page.url().split("/").pop()!;
  await page.getByLabel("Song title").fill("Probe song");
  await page.getByRole("button", { name: "Add song" }).click();
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+$/);
  const songUrl = page.url();
  const songId = songUrl.split("/").pop()!;

  // Part A, plus a filler memo whose server audio holds the band's whole 500 MiB.
  const [partId, filler] = [randomUUID(), randomUUID()];
  await expect(async () => {
    const res = await page.request.post("/api/sync/push", {
      data: {
        mutations: [
          { table: "parts", row: { id: partId, bandId, songId, label: "A", name: null, rank: "a0", variantOfPartId: null, notes: null, ...meta() } },
          { table: "memos", row: { id: filler, bandId, partId, recordedById: null, recordedByName: null, durationMs: 2000, format: "audio/webm;codecs=opus", size: 4096, recordedAt: 1, label: null, ...meta() } },
        ],
      },
    });
    expect((await res.json()).rejected).toEqual([]);
  }).toPass({ timeout: 30_000 });
  await seedServerAudio(sql, { bandId, memoId: filler, size: 500 * 1024 * 1024 });

  await expect(async () => {
    await page.goto(songUrl);
    await expect(page.getByRole("button", { name: /^Actions for part A/ })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });

  const puts: number[] = [];
  page.on("request", (r) => {
    if (r.method() === "PUT" && r.url().includes("/api/memos/")) puts.push(Date.now());
  });
  await recordMemo(page, "A", 2_000);
  const mine = page.getByTestId("memo").filter({ has: page.getByTestId("memo-retry") });
  await expect(mine.getByTestId("memo-state")).toContainText("used all 500 MB", { timeout: 20_000 });

  await sql`delete from memo_audio where memo_id = ${filler}`;
  const before = puts.length;
  const tappedAt = Date.now();
  await mine.getByTestId("memo-retry").click();
  let firstPutMs: number | null = null;
  try {
    await expect.poll(() => puts.length, { timeout: 5_000 }).toBeGreaterThan(before);
    firstPutMs = puts[before] - tappedAt;
  } finally {
    console.log("FR-036 try-again:", JSON.stringify({ putsBefore: before, putsAfter: puts.length - before, firstPutMs }));
  }
});
