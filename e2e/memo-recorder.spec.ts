import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { recordMemo, sharePartA, signUp, twoMembers, withFakeMicrophone } from "./memo-helpers";

withFakeMicrophone();

/**
 * Who recorded a memo is the server's to say (INV-006, FR-006).
 *
 * Postgres half: the stamp is written at insert from the session, a device cannot forge it or change the memo's
 * structure afterwards, and a memo pushed onto an already-deleted part never has storable audio.
 * Meta-line assertions are added with the card (T066).
 */

const DB_URL = process.env.STABLATURE_DATABASE_URL;
const sql = postgres(DB_URL ?? "postgres://unset", { max: 2, onnotice: () => {} });

test.skip(!DB_URL, "STABLATURE_DATABASE_URL is not set");
test.afterAll(async () => {
  await sql.end();
});

const hlc = (ms: number) => `${String(ms).padStart(15, "0")}:0000:e2e`;
const NOW = Date.now();
const meta = (deletedAt: string | null = null) => ({
  updatedAt: hlc(NOW),
  deletedAt,
  fieldClocks: { deletedAt: hlc(NOW), label: hlc(NOW) },
  serverSeq: 0,
});

const bandRow = (id: string, name: string) => ({
  table: "bands",
  row: { id, name, slug: `memo-${id.slice(0, 8)}`, ...meta() },
});
const songRow = (id: string, bandId: string) => ({
  table: "songs",
  row: { id, bandId, title: "Memo song", tuningId: null, bpm: null, notes: null, ...meta() },
});
const partRow = (id: string, bandId: string, songId: string, deletedAt: string | null = null) => ({
  table: "parts",
  row: {
    id,
    bandId,
    songId,
    label: "A",
    name: null,
    rank: "a0",
    variantOfPartId: null,
    notes: null,
    ...meta(deletedAt),
  },
});
const memoRow = (id: string, bandId: string, partId: string, over: Record<string, unknown> = {}) => ({
  table: "memos",
  row: {
    id,
    bandId,
    partId,
    recordedById: null,
    recordedByName: null,
    durationMs: 2000,
    format: "audio/webm;codecs=opus",
    size: 4096,
    recordedAt: NOW,
    label: null,
    ...meta(),
    ...over,
  },
});

type Request = import("@playwright/test").APIRequestContext;
const push = (request: Request, mutations: unknown[]) =>
  request.post("/api/sync/push", { data: { mutations } });

const stored = async (id: string) =>
  (
    await sql`select recorded_by_id, recorded_by_name, size, format, duration_ms, part_id, recorded_at::text as recorded_at
              from memos where id = ${id}`
  )[0];

test("the stamp is the pusher's, forged values are discarded, structure never changes", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const bandName = `Memo band ${randomUUID().slice(0, 8)}`;
  const trio = await twoMembers(browser, bandName);
  try {
    const { owner, guest } = trio;
    const bandId = (await sql`select id from bands where name = ${bandName}`)[0].id as string;
    const songId = (await sql`select id from songs where band_id = ${bandId} limit 1`)[0].id as string;
    const partId = randomUUID();
    const memoId = randomUUID();

    // E pushes a memo claiming to have been recorded by somebody else.
    const first = await push(owner.page.request, [
      partRow(partId, bandId, songId),
      memoRow(memoId, bandId, partId, { recordedById: "forged-id", recordedByName: "Forged Name" }),
    ]);
    expect(first.ok()).toBe(true);
    const row = await stored(memoId);
    const [ownerUser] = await sql`select id, name from "user" where email = ${owner.who.email}`;
    expect(row.recorded_by_id).toBe(ownerUser.id);
    expect(row.recorded_by_name).toBe(ownerUser.name);

    // A second push of the same row, still claiming otherwise, leaves E in the DB.
    await push(owner.page.request, [
      memoRow(memoId, bandId, partId, { recordedById: "other", recordedByName: "Other" }),
    ]);
    expect((await stored(memoId)).recorded_by_id).toBe(ownerUser.id);

    // O pushes the same row with every structural field changed.
    const otherPart = randomUUID();
    await push(owner.page.request, [partRow(otherPart, bandId, songId)]);
    const before = await stored(memoId);
    const second = await push(guest.page.request, [
      memoRow(memoId, bandId, partId, {
        size: 9999,
        format: "audio/ogg;codecs=opus",
        durationMs: 4000,
        partId: otherPart,
        recordedAt: NOW + 1000,
        recordedById: "someone",
        recordedByName: "Someone",
      }),
    ]);
    expect(second.ok()).toBe(true);
    expect((await second.json()).rejected).toEqual([]);
    const after = await stored(memoId);
    for (const k of ["size", "format", "duration_ms", "part_id", "recorded_at", "recorded_by_id"] as const) {
      expect(after[k]).toBe(before[k]);
    }
  } finally {
    await trio.close();
  }
});

test("a memo pushed onto an already-deleted part is stored, and its audio can never be stored", async ({
  page,
}) => {
  await signUp(page);
  const bandId = randomUUID();
  const songId = randomUUID();
  const partId = randomUUID();
  const memoId = randomUUID();

  const res = await push(page.request, [
    bandRow(bandId, `Memo band ${bandId.slice(0, 6)}`),
    songRow(songId, bandId),
    partRow(partId, bandId, songId, hlc(NOW + 1)),
    memoRow(memoId, bandId, partId),
  ]);
  expect(res.ok()).toBe(true);
  expect((await res.json()).rejected).toEqual([]);
  expect((await stored(memoId)).part_id).toBe(partId);

  const [audio] = await sql`select bytes is null as erased_bytes, erased_at is not null as erased from memo_audio where memo_id = ${memoId}`;
  expect(audio).toEqual({ erased_bytes: true, erased: true });
});

test("a memo whose part is not in its band is refused", async ({ page }) => {
  await signUp(page);
  const bandId = randomUUID();
  const memoId = randomUUID();
  const res = await push(page.request, [
    bandRow(bandId, `Memo band ${bandId.slice(0, 6)}`),
    memoRow(memoId, bandId, randomUUID()),
  ]);
  const body = await res.json();
  expect(body.rejected).toHaveLength(1);
  expect(body.rejected[0]).toMatchObject({ table: "memos", reason: "invalid" });
  expect(await stored(memoId)).toBeUndefined();
});

test("the meta line reads You while the push is held, then the recorder's name, on both devices", async ({ browser }) => {
  test.setTimeout(180_000);
  const trio = await twoMembers(browser);
  try {
    await sharePartA(trio);
    const { owner, guest } = trio;
    const [row] = await sql`select name from "user" where email = ${owner.who.email}`;
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await owner.page.route("**/api/sync/push", async (route) => {
      await held;
      return route.continue().catch(() => {});
    });
    await recordMemo(owner.page, "A", 2_000);
    const metaOf = (p: typeof owner.page) => p.getByTestId("memo").first().locator("span.text-xs").first();
    await expect(metaOf(owner.page)).toContainText(/^You ·/);
    release();
    await expect(metaOf(owner.page)).toContainText(`${row.name} ·`, { timeout: 15_000 });
    await expect(metaOf(guest.page)).toContainText(`${row.name} ·`, { timeout: 15_000 });
  } finally {
    await trio.close();
  }
});
