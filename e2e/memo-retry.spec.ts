/**
 * FR-036 / FR-071 "Try again" (review F5, F23). For a memo whose row the server already accepted and whose upload was
 * refused `band_full`, Try again must send the upload at once, not on the next poll (60 s), SSE event, outbox write,
 * visibility change or `online`.
 *
 * Band X is filled to 500 MiB on the server, a memo is recorded, its upload is refused, the room is freed in Postgres,
 * then Try again. Run it ALONE (`--workers=1`): another test's server write wakes the client through the SSE stream and
 * lets it pass by luck.
 */
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { recordMemo, seedServerAudio, signUp, withFakeMicrophone } from "./memo-helpers";

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

const NOW = Date.now();
const hlc = (ms: number) => `${String(ms).padStart(15, "0")}:0000:e2e`;
const meta = () => ({ updatedAt: hlc(NOW), deletedAt: null, fieldClocks: { deletedAt: hlc(NOW), label: hlc(NOW) }, serverSeq: 0 });

test("Try again on a band_full memo sends its upload within 5 s", async ({ page }) => {
  await signUp(page);
  await page.getByLabel("Band name").fill(`Retry ${randomUUID().slice(0, 6)}`);
  await page.getByRole("button", { name: "Add band" }).click();
  await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);
  const bandId = page.url().split("/").pop()!;
  await page.getByLabel("Song title").fill("Retry song");
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
  await mine.getByTestId("memo-retry").click();
  await expect.poll(() => puts.length, { timeout: 5_000 }).toBeGreaterThan(before);
});
