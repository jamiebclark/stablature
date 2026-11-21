/**
 * INV-002 through the push path (review round 1, F1).
 *
 * "Never does an account read or write audio outside its authority." The audio routes check the memo's band; push
 * checks the band the INCOMING row names, then updates whatever row has that id. So E, who edits band X and only
 * views band Y, pushes Y's memo (or Y's part) re-labelled as band X with a newer tombstone clock: the role check sees
 * X (editor: allowed), the part check sees X's part, `upsert` finds Y's row by id and tombstones it, and
 * `eraseAfterUpsert` erases Y's audio. ERASED is terminal (FR-063), so this cannot be undone.
 *
 * Holds when: both forged pushes are rejected, Y's memo rows stay live, and Y's audio stays STORED.
 */
import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import postgres from "postgres";
import { signUp } from "../../../e2e/memo-helpers";

const DB_URL = process.env.STABLATURE_DATABASE_URL;
const sql = postgres(DB_URL ?? "postgres://unset", { max: 2, onnotice: () => {} });
test.skip(!DB_URL, "STABLATURE_DATABASE_URL is not set");
test.afterAll(async () => {
  await sql.end();
});

const FORMAT = "audio/webm;codecs=opus";
const SIZE = 4096;
const NOW = Date.now();
const hlc = (ms: number) => `${String(ms).padStart(15, "0")}:0000:e2e`;
const meta = () => ({ updatedAt: hlc(NOW), deletedAt: null, fieldClocks: { deletedAt: hlc(NOW), label: hlc(NOW) }, serverSeq: 0 });
const tomb = (at: number) => ({ deletedAt: hlc(at), updatedAt: hlc(at), fieldClocks: { deletedAt: hlc(at), label: hlc(NOW) } });

const band = (id: string) => ({ table: "bands", row: { id, name: `Probe ${id.slice(0, 6)}`, slug: `probe-${id.slice(0, 8)}`, ...meta() } });
const song = (id: string, bandId: string) => ({ table: "songs", row: { id, bandId, title: "Probe song", tuningId: null, bpm: null, notes: null, ...meta() } });
const part = (id: string, bandId: string, songId: string, over: Record<string, unknown> = {}) => ({
  table: "parts",
  row: { id, bandId, songId, label: "A", name: null, rank: "a0", variantOfPartId: null, notes: null, ...meta(), ...over },
});
const memo = (id: string, bandId: string, partId: string, over: Record<string, unknown> = {}) => ({
  table: "memos",
  row: {
    id, bandId, partId, recordedById: null, recordedByName: null, durationMs: 2000, format: FORMAT, size: SIZE,
    recordedAt: NOW, label: null, ...meta(), ...over,
  },
});
const clip = () => {
  const b = Buffer.alloc(SIZE, 3);
  b.set([0x1a, 0x45, 0xdf, 0xa3]);
  return b;
};
const push = (r: APIRequestContext, mutations: unknown[]) => r.post("/api/sync/push", { data: { mutations } });

const stateOf = async (memoId: string) => {
  const [m] = await sql`select deleted_at from memos where id = ${memoId}`;
  const [a] = await sql`select bytes is not null as stored, erased_at from memo_audio where memo_id = ${memoId}`;
  return { memoDeleted: m?.deleted_at ?? null, audioStored: a?.stored ?? false, erasedAt: a?.erased_at ?? null };
};

test("a viewer of band Y cannot erase Y's memo audio by pushing Y's rows under band X", async ({ browser }) => {
  // N owns band Y, with two parts, each with a memo whose audio is on the server.
  const nCtx = await browser.newContext();
  const nPage = await nCtx.newPage();
  await signUp(nPage);
  const [bandY, songY, partY1, partY2, memoY1, memoY2] = Array.from({ length: 6 }, () => randomUUID());
  const made = await push(nPage.request, [band(bandY), song(songY, bandY), part(partY1, bandY, songY), part(partY2, bandY, songY),
    memo(memoY1, bandY, partY1), memo(memoY2, bandY, partY2)]);
  expect((await made.json()).rejected).toEqual([]);
  for (const id of [memoY1, memoY2]) {
    const up = await nPage.request.put(`/api/memos/${id}/audio`, { data: clip(), headers: { "content-type": FORMAT } });
    expect(up.status()).toBe(201);
  }

  // E owns band X (so is an editor somewhere) and is only a VIEWER of band Y.
  const eCtx = await browser.newContext();
  const ePage = await eCtx.newPage();
  const eWho = await signUp(ePage);
  const [bandX, songX, partX] = [randomUUID(), randomUUID(), randomUUID()];
  expect((await (await push(ePage.request, [band(bandX), song(songX, bandX), part(partX, bandX, songX)])).json()).rejected).toEqual([]);
  const [eUser] = await sql`select id from "user" where email = ${eWho.email}`;
  await sql`insert into band_members (id, band_id, user_id, role) values (${randomUUID()}, ${bandY}, ${eUser.id}, 'viewer')`;

  // As a viewer, E sees Y's memo ids in an ordinary pull, and E's honest delete is refused.
  const pulled = await (await ePage.request.get("/api/sync/pull?since=0")).json();
  expect(JSON.stringify(pulled)).toContain(memoY1);
  const honest = await (await push(ePage.request, [memo(memoY1, bandY, partY1, tomb(NOW + 10))])).json();
  expect(honest.rejected.map((r: { reason: string }) => r.reason)).toEqual(["read_only"]);
  expect(await stateOf(memoY1)).toMatchObject({ memoDeleted: null, audioStored: true });

  // The forged deletes: Y's memo, and Y's part, each re-labelled as band X.
  const forgedMemo = await (await push(ePage.request, [memo(memoY1, bandX, partX, tomb(NOW + 20))])).json();
  const forgedPart = await (await push(ePage.request, [part(partY2, bandX, songX, tomb(NOW + 20))])).json();

  const after1 = await stateOf(memoY1);
  const after2 = await stateOf(memoY2);
  const [p2] = await sql`select deleted_at from parts where id = ${partY2}`;
  const report = { forgedMemo: forgedMemo.rejected, forgedPart: forgedPart.rejected, memoY1: after1, memoY2: after2, partY2Deleted: p2.deleted_at };
  console.log("INV-002 push cross-band:", JSON.stringify(report));

  expect(forgedMemo.rejected.length, "the forged memo tombstone was accepted").toBe(1);
  expect(after1, "band Y's memo was tombstoned / its audio erased by a viewer").toMatchObject({ memoDeleted: null, audioStored: true, erasedAt: null });
  expect(forgedPart.rejected.length, "the forged part tombstone was accepted").toBe(1);
  expect(p2.deleted_at, "band Y's part was tombstoned by a viewer").toBeNull();
  expect(after2, "band Y's part's memo audio was erased by a viewer").toMatchObject({ audioStored: true, erasedAt: null });

  await nCtx.close();
  await eCtx.close();
});
