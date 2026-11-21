import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { memoRowSchema } from "../src/lib/sync/protocol";
import { recordMemo, sharePartA, twoMembers, withFakeMicrophone } from "./memo-helpers";

/**
 * INV-003: audio bytes never ride the sync channel, and a slow upload never holds sync back.
 * {pull, push response} × {pending, uploaded, erased}.
 */
withFakeMicrophone();
const DB_URL = process.env.STABLATURE_DATABASE_URL;
const sql = postgres(DB_URL ?? "postgres://unset", { max: 2, onnotice: () => {} });
test.skip(!DB_URL, "STABLATURE_DATABASE_URL is not set");
test.afterAll(async () => {
  await sql.end();
});

const KEYS = Object.keys(memoRowSchema.shape).sort();

test("pull and push stay small and carry only the memo row, while a PUT is held", async ({ browser }) => {
  test.setTimeout(180_000);
  const bandName = `Memo band ${randomUUID().slice(0, 8)}`;
  const trio = await twoMembers(browser, bandName);
  try {
    await sharePartA(trio);
    const page = trio.owner.page;
    const bandId = trio.bandUrl.split("/").pop()!;
    const pushBodies: string[] = [];
    page.on("response", async (r) => {
      if (r.url().includes("/api/sync/push")) pushBodies.push(await r.text().catch(() => ""));
    });

    // Hold every upload 20 s: the memo stays "pending" while sync carries on.
    await page.route("**/api/memos/*/audio", async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      await new Promise((r) => setTimeout(r, 20_000));
      return route.continue().catch(() => {});
    });
    await recordMemo(page, "A", 8_000);

    const checkPull = async () => {
      const res = await page.request.get("/api/sync/pull?since=0");
      const text = await res.text();
      expect(text.length).toBeLessThan(64 * 1024);
      const rows = (JSON.parse(text).rows?.memos ?? []) as Record<string, unknown>[];
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(Object.keys(row).sort()).toEqual(KEYS);
    };

    // pending
    await expect.poll(async () => (await sql`select count(*)::int as n from memos where band_id = ${bandId}`)[0].n, { timeout: 10_000 }).toBeGreaterThan(0);
    await checkPull();
    // another change reaches events in Postgres within 5 s while the PUT is held.
    const songId = trio.songUrl.split("/").pop()!;
    const [{ n: before }] = await sql`select count(*)::int as n from events where band_id = ${bandId}`;
    const hlc = `${String(Date.now()).padStart(15, "0")}:0000:e2e`;
    const partId = (await sql`select id from parts where song_id = ${songId} limit 1`)[0].id as string;
    await page.request.post("/api/sync/push", {
      data: {
        mutations: [
          {
            table: "events",
            row: {
              id: randomUUID(), bandId, partId, rank: "n0", kind: "notes", frets: { 2: 5 }, techniques: {}, repeat: 1, durationHint: null, tupletId: null, tupletCount: null,
              updatedAt: hlc, deletedAt: null, fieldClocks: { deletedAt: hlc }, serverSeq: 0,
            },
          },
        ],
      },
    });
    await expect
      .poll(async () => (await sql`select count(*)::int as n from events where band_id = ${bandId}`)[0].n, { timeout: 5_000 })
      .toBe(before + 1);

    // uploaded
    await expect.poll(async () => (await sql`select count(*)::int as n from memo_audio where band_id = ${bandId} and erased_at is null and bytes is not null`)[0].n, { timeout: 40_000 }).toBeGreaterThan(0);
    await checkPull();

    // erased
    await page.getByRole("button", { name: /^Actions for memo/ }).first().click();
    await page.getByRole("menuitem", { name: /^Delete memo/ }).click();
    await page.getByRole("button", { name: "Delete memo", exact: true }).click();
    await expect.poll(async () => (await sql`select count(*)::int as n from memo_audio where band_id = ${bandId} and erased_at is not null and bytes is null`)[0].n, { timeout: 20_000 }).toBeGreaterThan(0);
    await checkPull();

    for (const body of pushBodies) {
      expect(body.length).toBeLessThan(64 * 1024);
      expect(body).not.toContain("bytes");
    }
  } finally {
    await trio.close();
  }
});
