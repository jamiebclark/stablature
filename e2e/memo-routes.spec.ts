import { createHash, randomUUID } from "node:crypto";
import net from "node:net";
import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import postgres from "postgres";
import { seedServerAudio, signUp, twoMembers, type Member } from "./memo-helpers";

/**
 * The audio routes, over real HTTP (INV-001, INV-002, INV-014; contracts/memo-audio-routes.md §5, H1–H22).
 *
 * Accounts: O owns band X, E edits it, V views it (demoted in the database), N belongs to band Y only. The clips are
 * synthetic: the right magic number for the memo's format, padded to the declared size. The routes check exactly
 * that, so a recorded clip would prove nothing more.
 */

const DB_URL = process.env.STABLATURE_DATABASE_URL;
const sql = postgres(DB_URL ?? "postgres://unset", { max: 2, onnotice: () => {} });

test.skip(!DB_URL, "STABLATURE_DATABASE_URL is not set");
test.afterAll(async () => {
  await sql.end();
});

const MIB = 1024 * 1024;
const BAND_TOTAL = 500 * MIB;
const FORMAT = "audio/webm;codecs=opus";
const SIZE = 4096;

const hlc = (ms: number) => `${String(ms).padStart(15, "0")}:0000:e2e`;
const NOW = Date.now();
const meta = () => ({
  updatedAt: hlc(NOW),
  deletedAt: null,
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
    ...meta(),
    // A tombstone must carry a newer clock than the row it deletes.
    ...(deletedAt ? { deletedAt, updatedAt: deletedAt, fieldClocks: { deletedAt, label: hlc(NOW) } } : {}),
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
    format: FORMAT,
    size: SIZE,
    recordedAt: NOW,
    label: null,
    ...meta(),
    ...over,
  },
});

/** A clip of `size` bytes that sniffs as WebM; `salt` makes two clips differ. */
function clip(size = SIZE, salt = 0): Buffer {
  const out = Buffer.alloc(size, salt);
  out.set([0x1a, 0x45, 0xdf, 0xa3]);
  return out;
}

const push = (request: APIRequestContext, mutations: unknown[]) =>
  request.post("/api/sync/push", { data: { mutations } });
const audioUrl = (id: string) => `/api/memos/${id}/audio`;
const put = (request: APIRequestContext, id: string, body: Buffer, type: string | null = FORMAT) =>
  request.put(audioUrl(id), { data: body, headers: type === null ? {} : { "content-type": type } });

const audioRow = async (id: string) =>
  (await sql`select bytes is not null as stored, sha256, erased_at::text as erased_at, uploaded_at::text as uploaded_at from memo_audio where memo_id = ${id}`)[0] ?? null;

async function shape(res: APIResponse) {
  const headers = { ...res.headers() };
  delete headers.date;
  return { status: res.status(), headers, body: (await res.body()).toString("base64") };
}

/** One request over a raw socket. Resolves with the first response, or `closed` if the server hung up first. */
function raw(
  base: URL,
  cookie: string,
  { path, method = "PUT", headers, write }: { path: string; method?: string; headers: Record<string, string>; write: (s: net.Socket) => void },
): Promise<{ status: number | null; body: string; ms: number; closed: boolean }> {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = net.connect(Number(base.port), base.hostname);
    let data = "";
    let settled = false;
    const done = (closed: boolean) => {
      if (settled) return;
      settled = true;
      const status = /^HTTP\/1\.1 (\d{3})/.exec(data)?.[1];
      resolve({ status: status ? Number(status) : null, body: data.split("\r\n\r\n").slice(1).join("\r\n\r\n"), ms: Date.now() - started, closed });
      socket.destroy();
    };
    socket.on("data", (chunk) => {
      data += chunk.toString("latin1");
      const end = data.indexOf("\r\n\r\n");
      if (end >= 0) {
        const length = /content-length: (\d+)/i.exec(data)?.[1];
        if (length === undefined || data.length - end - 4 >= Number(length)) done(false);
      }
    });
    socket.on("error", () => done(true));
    socket.on("close", () => done(true));
    socket.on("connect", () => {
      const head = Object.entries({ host: base.host, cookie, connection: "close", ...headers })
        .map(([k, v]) => `${k}: ${v}`)
        .join("\r\n");
      socket.write(`${method} ${path} HTTP/1.1\r\n${head}\r\n\r\n`);
      write(socket);
    });
    setTimeout(() => done(true), 15_000);
  });
}

const cookieOf = async (m: Member) =>
  (await m.context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");

test("the audio routes answer every case of contracts §5", async ({ browser }, testInfo) => {
  test.setTimeout(240_000);
  const base = new URL(testInfo.project.use.baseURL ?? "http://localhost:3000");
  const bandName = `Memo band ${randomUUID().slice(0, 8)}`;
  const trio = await twoMembers(browser, bandName);
  const strangerContext = await browser.newContext();
  try {
    const O = trio.owner;
    const E = trio.guest;
    const bandId = (await sql`select id from bands where name = ${bandName}`)[0].id as string;
    const songId = (await sql`select id from songs where band_id = ${bandId} limit 1`)[0].id as string;
    const [eUser] = await sql`select id from "user" where email = ${E.who.email}`;
    await sql`update band_members set role = 'editor' where band_id = ${bandId} and user_id = ${eUser.id}`;

    // V: a third account, a viewer of X. N: a stranger with a band of their own (Y).
    const V = { context: await browser.newContext(), who: undefined as never, page: undefined as never } as unknown as Member;
    V.page = await V.context.newPage();
    V.who = await signUp(V.page);
    const [vUser] = await sql`select id from "user" where email = ${V.who.email}`;
    await sql`insert into band_members (id, band_id, user_id, role) values (${randomUUID()}, ${bandId}, ${vUser.id}, 'viewer')`;
    const N = { context: strangerContext, page: await strangerContext.newPage(), who: undefined as never } as unknown as Member;
    N.who = await signUp(N.page);
    const bandY = randomUUID();
    const songY = randomUUID();
    const partY = randomUUID();
    const memoY = randomUUID();
    expect((await push(N.page.request, [bandRow(bandY, "Y band"), songRow(songY, bandY), partRow(partY, bandY, songY), memoRow(memoY, bandY, partY)])).ok()).toBe(true);

    const partId = randomUUID();
    const m = randomUUID();
    const pushed = await push(E.page.request, [partRow(partId, bandId, songId), memoRow(m, bandId, partId)]);
    expect((await pushed.json()).rejected).toEqual([]);

    const good = clip();

    // H1
    const nobody = await strangerContext.browser()!.newContext();
    expect((await nobody.request.get(new URL(audioUrl(m), base).href)).status()).toBe(401);
    expect((await nobody.request.put(new URL(audioUrl(m), base).href, { data: good, headers: { "content-type": FORMAT } })).status()).toBe(401);
    await nobody.close();
    expect(await audioRow(m)).toBeNull();

    // H2, H3: N cannot tell a memo in X from one that does not exist; neither can E about Y's memo.
    const unknown = randomUUID();
    for (const who of [N, E]) {
      const foreign = who === N ? m : memoY;
      for (const verb of ["GET", "PUT"] as const) {
        const call = (id: string) =>
          verb === "GET" ? who.page.request.get(audioUrl(id)) : put(who.page.request, id, good);
        const a = await shape(await call(foreign));
        const b = await shape(await call(unknown));
        expect(a.status).toBe(404);
        expect(a).toEqual(b);
        expect(JSON.parse(Buffer.from(a.body, "base64").toString()).code).toBe("not_found");
      }
    }
    expect(await audioRow(m)).toBeNull();

    // H4, H5
    expect((await put(V.page.request, m, good)).status()).toBe(403);
    expect(((await (await put(V.page.request, m, good)).json()) as { code: string }).code).toBe("read_only");
    for (const who of [V, E, O]) {
      const res = await who.page.request.get(audioUrl(m));
      expect(res.status()).toBe(404);
      expect((await res.json()).code).toBe("not_uploaded");
    }
    expect(await audioRow(m)).toBeNull();

    // H6: a declared length of 1000, then 9 MiB on the wire.
    const cookie = await cookieOf(E);
    const h6 = await raw(base, cookie, {
      path: audioUrl(m),
      headers: { "content-type": FORMAT, "content-length": "1000" },
      write: (s) => s.write(Buffer.alloc(9 * MIB, 1)),
    });
    // The route says 422; Node's parser may answer 400 first, because the surplus bytes are not a request.
    expect([422, 413, 400]).toContain(h6.status);
    expect(await audioRow(m)).toBeNull();

    // H7: chunked, no length, 9 MiB.
    const h7 = await raw(base, cookie, {
      path: audioUrl(m),
      headers: { "content-type": FORMAT, "transfer-encoding": "chunked" },
      write: (s) => {
        const chunk = Buffer.alloc(MIB, 1);
        for (let i = 0; i < 9; i++) {
          s.write(`${chunk.length.toString(16)}\r\n`);
          s.write(chunk);
          s.write("\r\n");
        }
        s.write("0\r\n\r\n");
      },
    });
    expect(h7.status).toBe(413);

    // H8: a length over the cap is answered before any body is sent.
    const h8 = await raw(base, cookie, {
      path: audioUrl(m),
      headers: { "content-type": FORMAT, "content-length": String(9 * MIB) },
      write: () => undefined,
    });
    expect(h8.status).toBe(413);
    expect(h8.ms).toBeLessThan(1000);

    // H9
    for (const type of ["audio/wav", "audio/mpeg", "video/webm", "audio/webm;codecs=vorbis", "audio/webm;codecs=opus,vp8", "audio/mp4;codecs=avc1.42E01E", "text/html", "application/octet-stream", null]) {
      const res = await put(E.page.request, m, good, type);
      expect(res.status(), String(type)).toBe(415);
      expect((await res.json()).code).toBe("format");
    }
    // H10, H11
    const html = Buffer.alloc(SIZE, 0x20);
    html.write("<html>");
    const h10 = await put(E.page.request, m, html);
    expect(h10.status()).toBe(422);
    expect((await h10.json()).code).toBe("content_mismatch");
    const h11 = await put(E.page.request, m, clip(SIZE - 1));
    expect(h11.status()).toBe(422);
    expect((await h11.json()).code).toBe("size_mismatch");
    expect(await audioRow(m)).toBeNull();

    // H12, H13, H14, H15
    const h12 = await put(E.page.request, m, good);
    expect(h12.status()).toBe(201);
    const stored1 = await audioRow(m);
    expect(stored1).toMatchObject({ stored: true, sha256: createHash("sha256").update(good).digest("hex"), erased_at: null });
    const h13 = await put(E.page.request, m, good);
    expect(h13.status()).toBe(200);
    expect(await audioRow(m)).toEqual(stored1);
    const h14 = await put(O.page.request, m, clip(SIZE, 7));
    expect(h14.status()).toBe(409);
    expect((await h14.json()).code).toBe("different_file");
    expect(await audioRow(m)).toEqual(stored1);
    for (const who of [V, E, O]) {
      const res = await who.page.request.get(audioUrl(m));
      expect(res.status()).toBe(200);
      expect(Buffer.compare(await res.body(), good)).toBe(0);
      expect(res.headers()["content-type"]).toBe(FORMAT);
      expect(res.headers()["x-content-type-options"]).toBe("nosniff");
      expect(res.headers()["cache-control"]).toBe("private, no-store");
    }

    // H16, H17: tombstone the memo; the audio is erased in the same push.
    const tomb = memoRow(m, bandId, partId, { deletedAt: hlc(NOW + 10), updatedAt: hlc(NOW + 10), fieldClocks: { deletedAt: hlc(NOW + 10), label: hlc(NOW) } });
    expect((await push(E.page.request, [tomb])).ok()).toBe(true);
    expect(await audioRow(m)).toMatchObject({ stored: false, sha256: null });
    expect((await audioRow(m))?.erased_at).not.toBeNull();
    const h17g = await E.page.request.get(audioUrl(m));
    expect(h17g.status()).toBe(410);
    expect((await h17g.json()).code).toBe("erased");
    const h17p = await put(E.page.request, m, good);
    expect(h17p.status()).toBe(410);
    expect(["erased", "deleted"]).toContain((await h17p.json()).code);

    // H18: un-delete with a newer clock; the audio is still gone.
    const back = memoRow(m, bandId, partId, { deletedAt: null, updatedAt: hlc(NOW + 20), fieldClocks: { deletedAt: hlc(NOW + 20), label: hlc(NOW) } });
    await push(E.page.request, [back]);
    const h18 = await E.page.request.get(audioUrl(m));
    expect(h18.status()).toBe(410);
    expect((await h18.json()).code).toBe("erased");

    // H19: a memo on a part that is then deleted.
    const p2 = randomUUID();
    const m2 = randomUUID();
    await push(E.page.request, [partRow(p2, bandId, songId), memoRow(m2, bandId, p2)]);
    await push(E.page.request, [partRow(p2, bandId, songId, hlc(NOW + 30))]);
    const h19 = await put(E.page.request, m2, good);
    expect(h19.status()).toBe(410);
    // Push already erased the audio when the part was tombstoned (sync-and-storage contract 3.3), and the erased
    // check (row 12) comes before the part check (row 13), so the route answers `erased`. Either way: 410.
    expect(["erased", "part_deleted"]).toContain((await h19.json()).code);
    expect(await audioRow(m2)).toMatchObject({ stored: false });
    expect((await audioRow(m2))?.erased_at).not.toBeNull();

    // H20, H21: the band total. A seed memo holds the room.
    const seed = randomUUID();
    const p3 = randomUUID();
    await push(E.page.request, [partRow(p3, bandId, songId), memoRow(seed, bandId, p3)]);
    const [m3, m4, m5] = [randomUUID(), randomUUID(), randomUUID()];
    await push(E.page.request, [memoRow(m3, bandId, p3), memoRow(m4, bandId, p3), memoRow(m5, bandId, p3)]);
    await seedServerAudio(sql, { bandId, memoId: seed, size: BAND_TOTAL - SIZE + 1 });
    const h20 = await put(E.page.request, m3, good);
    expect(h20.status()).toBe(507);
    expect((await h20.json()).code).toBe("band_full");
    expect(await audioRow(m3)).toBeNull();
    await seedServerAudio(sql, { bandId, memoId: seed, size: BAND_TOTAL - SIZE });
    const both = await Promise.all([put(E.page.request, m4, good), put(O.page.request, m5, good)]);
    expect(both.map((r) => r.status()).sort()).toEqual([201, 507]);
    const [{ total }] = await sql`select sum(size)::bigint as total from memo_audio where band_id = ${bandId} and bytes is not null`;
    expect(Number(total)).toBeLessThanOrEqual(BAND_TOTAL);

    // H22: a socket closed after half the body stores nothing.
    const m6 = randomUUID();
    await push(E.page.request, [memoRow(m6, bandId, p3)]);
    const h22 = await raw(base, cookie, {
      path: audioUrl(m6),
      headers: { "content-type": FORMAT, "content-length": String(SIZE) },
      write: (s) => {
        s.write(good.subarray(0, SIZE / 2));
        setTimeout(() => s.destroy(), 200);
      },
    });
    expect(h22.status === null || h22.status >= 400).toBe(true);
    expect(await audioRow(m6)).toBeNull();
  } finally {
    await trio.close();
    await strangerContext.close();
  }
});
