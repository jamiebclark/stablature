/**
 * Shared drivers for the voice-memo specs (spec 012, T007; data-model §9).
 *
 * Observation only: the wrappers below count or keep what the browser does and never change it. The two stated
 * exceptions in plan § Invariants (a deleted `MediaRecorder`, a `canPlayType` that answers "" for one seeded format)
 * are the only behaviour replaced, and each stands in for an older browser.
 */
import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import type postgres from "postgres";
import { INSECURE_HOST_RULE } from "./insecure-host";
import { dump, idb, n, seedSong, type PartSpec } from "./reading-helpers";

/** Chromium's documented switches: a fake microphone that loops the committed tone, and no permission prompt. */
export const FAKE_MICROPHONE = [
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
  "--use-file-for-fake-audio-capture=e2e/fixtures/memo-tone.wav",
  // test.use replaces the project's launch args, so the `insecure` project's host rule rides along here.
  INSECURE_HOST_RULE,
];

/** Call at the top of a spec file (or a describe) that records. */
export function withFakeMicrophone() {
  test.use({ permissions: ["microphone"], launchOptions: { args: FAKE_MICROPHONE } });
}

/** A fresh account per test, so nothing shares band membership. */
export function credentials() {
  const id = randomUUID().slice(0, 8);
  return { name: `Memo ${id}`, email: `memo-${id}@example.test`, password: "practice-space-5" };
}
export type Who = ReturnType<typeof credentials>;

export async function signUp(page: Page, who: Who = credentials()): Promise<Who> {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(who.name);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  return who;
}

// --- Song M (data-model §9) ----------------------------------------------------------------------------------

/** Song M: parts A (no memos), B (memos), and B-prime, a variant of B with no memos. Returns what seedSong returns. */
export async function seedSongM(page: Page) {
  const parts: PartSpec[] = [
    { key: "a", label: "A", columns: [n(5)] },
    { key: "b", label: "B", columns: [n(7)] },
    { key: "bv", label: "B'", variantOf: "b", columns: [n(9)] },
  ];
  return seedSong(page, parts);
}

// --- seedMemo ------------------------------------------------------------------------------------------------

/** One per `St` kind of data-model §5. */
export type MemoKind =
  | "deleted"
  | "unplayable"
  | "failed-play"
  | "refused"
  | "local-signed-out"
  | "local-offline"
  | "uploading"
  | "ready"
  | "downloading"
  | "full"
  | "fetch-failed"
  | "waiting";

export interface SeedMemo {
  partLabel: string;
  durationMs?: number;
  format?: string;
  label?: string | null;
  /** The clip. Defaults to a short silent WAV that every browser decodes; pass garbage for `failed-play`. */
  bytes?: Uint8Array;
  state: MemoKind;
  recordedAt?: number;
}

/** A ~0.1 s silent 8 kHz mono WAV: small, and decodable everywhere. */
export function silentWav(): Uint8Array {
  const samples = 800;
  const out = Buffer.alloc(44 + samples * 2);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + samples * 2, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(8000, 24);
  out.writeUInt32LE(16000, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(samples * 2, 40);
  return out;
}

/**
 * Writes raw IndexedDB, the way `seedSong` does: the `memos` row, plus the `memoAudio`, `memoUploads` or `memoFetches`
 * entries the wanted state needs. Run it after the app has opened the database at version 2, then reload or `landed`.
 * `downloading` is a row with no entry at all: the fetch step starts on it, and the spec holds the GET to keep it there.
 */
export async function seedMemo(page: Page, spec: SeedMemo): Promise<string> {
  const bytes = Array.from(spec.bytes ?? silentWav());
  const arg = { ...spec, bytes, id: randomUUID(), recordedAt: spec.recordedAt ?? Date.now() };
  return idb<string>(
    page,
    `
    const s = arg;
    const part = (await all("parts")).find((p) => p.label === s.partLabel && !p.deletedAt);
    if (!part) throw new Error("no part " + s.partLabel);
    const [template] = await all("events");
    const recordedHere = ["refused", "local-signed-out", "local-offline", "uploading"].includes(s.state);
    const hasAudio = recordedHere || ["ready", "unplayable", "failed-play"].includes(s.state);
    const format = s.format ?? (s.state === "unplayable" ? "audio/webm;codecs=opus" : "audio/wav");
    const row = {
      id: s.id, bandId: part.bandId, partId: part.id, recordedById: null, recordedByName: null,
      durationMs: s.durationMs ?? 4000, format, size: s.bytes.length, recordedAt: s.recordedAt, label: s.label ?? null,
      updatedAt: template.updatedAt, deletedAt: null, fieldClocks: {}, serverSeq: recordedHere ? 0 : template.serverSeq || 1,
    };
    await write("memos", (st) => st.put(row));
    if (hasAudio) await write("memoAudio", (st) => st.put({ memoId: s.id, bytes: new Uint8Array(s.bytes).buffer, format, size: s.bytes.length }));
    if (recordedHere) await write("memoUploads", (st) => st.put({
      memoId: s.id, bandId: part.bandId, attempts: 0, nextAt: 0, account: null,
      refusal: s.state === "refused" ? { code: "band_full", message: "This band's recordings are full." } : null,
    }));
    const fetch = { deleted: "erased", full: "full", "fetch-failed": "failed" }[s.state];
    if (fetch) await write("memoFetches", (st) => st.put({ memoId: s.id, status: fetch, attempts: 0, nextAt: 0 }));
    return s.id;
    `,
    arg,
  );
}

/** INV-011's one stated exception: `canPlayType` answers "" for exactly this format, as an older browser would. */
export async function denyCanPlay(page: Page, format: string) {
  await page.addInitScript((deny) => {
    const real = HTMLMediaElement.prototype.canPlayType;
    HTMLMediaElement.prototype.canPlayType = function (type: string) {
      return type === deny ? "" : real.call(this, type);
    };
  }, format);
}

/** INV-020's other stated exception: no `MediaRecorder`, as in an older browser. */
export async function withoutMediaRecorder(page: Page) {
  await page.addInitScript(() => {
    delete (window as unknown as { MediaRecorder?: unknown }).MediaRecorder;
  });
}

/** The server side of a clip, for the band-total probes: the declared `size`, one byte of payload (data-model §9). */
export async function seedServerAudio(
  sql: ReturnType<typeof postgres>,
  { bandId, memoId, size, contentType = "audio/webm" }: { bandId: string; memoId: string; size: number; contentType?: string },
) {
  await sql`
    insert into memo_audio (memo_id, band_id, content_type, size, sha256, bytes, uploaded_at)
    values (${memoId}, ${bandId}, ${contentType}, ${size}, 'seeded', ${Buffer.from([0])}, now())
    on conflict (memo_id) do update set size = excluded.size, bytes = excluded.bytes, erased_at = null`;
}

// --- observation-only wrappers -------------------------------------------------------------------------------

/** Keeps every stream `getUserMedia` returns on `window.__memoStreams`, so a spec can check `readyState`, and `.stop()` one. */
export async function keepMicrophoneStreams(page: Page) {
  await page.addInitScript(() => {
    const streams: MediaStream[] = [];
    (window as unknown as { __memoStreams: MediaStream[] }).__memoStreams = streams;
    const md = navigator.mediaDevices;
    if (!md?.getUserMedia) return;
    const real = md.getUserMedia.bind(md);
    md.getUserMedia = async (constraints) => {
      const stream = await real(constraints);
      streams.push(stream);
      return stream;
    };
  });
}

/** The `readyState` of every track of every stream kept so far. */
export const microphoneTrackStates = (page: Page) =>
  page.evaluate(() =>
    ((window as unknown as { __memoStreams?: MediaStream[] }).__memoStreams ?? []).flatMap((s) => s.getTracks().map((t) => t.readyState)),
  );

/** Counts calls to `navigator.storage.persist()` (the call goes through) in `window.__persistCalls`. */
export async function countPersistCalls(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __persistCalls: number };
    w.__persistCalls = 0;
    const storage = navigator.storage;
    if (!storage?.persist) return;
    const real = storage.persist.bind(storage);
    storage.persist = () => {
      w.__persistCalls++;
      return real();
    };
  });
}
export const persistCalls = (page: Page) => page.evaluate(() => (window as unknown as { __persistCalls?: number }).__persistCalls ?? 0);

/**
 * The push-400 tripwire (INV-001): a memo must never make `/api/sync/push` answer 400. Any such response fails the
 * test at once (a soft failure, so the test still ends cleanly), and `check()` asserts none has been seen.
 */
export function pushTripwire(page: Page) {
  const seen: string[] = [];
  page.on("response", (response) => {
    if (response.status() === 400 && new URL(response.url()).pathname === "/api/sync/push") {
      seen.push(`${response.request().method()} ${response.url()}`);
      expect.soft(false, `/api/sync/push answered 400 (${response.url()})`).toBe(true);
    }
  });
  return {
    seen,
    check: () => expect(seen, "/api/sync/push answered 400").toEqual([]),
  };
}

/** Every IndexedDB record, for a before/after comparison. */
export { dump, idb };

// --- two members in one band ---------------------------------------------------------------------------------

export interface Member {
  context: BrowserContext;
  page: Page;
  who: Who;
}

/**
 * Two signed-in contexts in one band: the owner creates the band and a song and invites; the guest accepts and
 * waits for the band's history to arrive. Returns both, and the owner's song URL.
 */
export async function twoMembers(browser: Browser, bandName = `Memo band ${randomUUID().slice(0, 6)}`) {
  const ownerContext = await browser.newContext({ permissions: ["microphone"] });
  const owner = await ownerContext.newPage();
  const ownerWho = await signUp(owner);
  await owner.goto("/");
  await owner.getByLabel("Band name").fill(bandName);
  await owner.getByRole("button", { name: "Add band" }).click();
  await expect(owner).toHaveURL(/\/bands\/[0-9a-f-]+$/);
  const bandUrl = owner.url();
  await owner.getByLabel("Song title").fill("Memo song");
  await owner.getByRole("button", { name: "Add song" }).click();
  await expect(owner).toHaveURL(/\/songs\/[0-9a-f-]+$/);
  const songUrl = owner.url();

  await owner.goto(bandUrl);
  // The band must reach the server first, so ask again until the link appears.
  await expect(async () => {
    await owner.getByRole("button", { name: "Invite a bandmate" }).click();
    await expect(owner.getByLabel("Invite link")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  const link = await owner.getByLabel("Invite link").inputValue();

  const guestContext = await browser.newContext({ permissions: ["microphone"] });
  const guest = await guestContext.newPage();
  const guestWho = await signUp(guest);
  await guest.goto(new URL(link).pathname);
  await guest.getByRole("button", { name: "Accept invite" }).click();
  await expect(guest).toHaveURL(/\/bands\//, { timeout: 25_000 });
  await expect(guest.getByRole("link", { name: "Memo song" })).toBeVisible({ timeout: 30_000 });

  return {
    owner: { context: ownerContext, page: owner, who: ownerWho } satisfies Member,
    guest: { context: guestContext, page: guest, who: guestWho } satisfies Member,
    bandUrl,
    songUrl,
    close: async () => {
      await ownerContext.close();
      await guestContext.close();
    },
  };
}

// --- recording through the real menu (US1) -------------------------------------------------------------------

/**
 * Observation only: notes when the page's MediaRecorder fires `start`. The record panel shows while the recorder is
 * still asking for the microphone, so a helper that times a recording from the panel can press Stop before the
 * recorder ran for a second (E11). Safe to call again; each call clears the last observation.
 */
async function watchRecorderStart(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __recStarted?: boolean; __recWatched?: boolean };
    w.__recStarted = false;
    if (w.__recWatched) return;
    w.__recWatched = true;
    const start = MediaRecorder.prototype.start;
    MediaRecorder.prototype.start = function (this: MediaRecorder, slice?: number) {
      this.addEventListener("start", () => (w.__recStarted = true));
      return start.call(this, slice);
    };
  });
}

/** Chooses **Record memo** and waits for the panel, then, bounded, for the recorder to start. A refusal never starts. */
async function openRecorder(page: Page, partLabel: string) {
  await watchRecorderStart(page);
  await page.getByRole("button", { name: new RegExp(`^Actions for part ${partLabel}(,|$)`) }).click();
  await page.getByRole("menuitem", { name: `Record a memo on part ${partLabel}` }).click();
  await expect(page.getByTestId("record-panel")).toBeVisible();
  await page
    .waitForFunction(() => (window as unknown as { __recStarted?: boolean }).__recStarted === true, undefined, { timeout: 5_000 })
    .catch(() => {});
}

/** Chooses **Record memo** from a part's menu, waits `ms` of recording, presses **Stop**. Returns once the memo is playable. */
export async function recordMemo(page: Page, partLabel: string, ms = 4000) {
  await openRecorder(page, partLabel);
  await page.waitForTimeout(ms);
  await page.getByTestId("record-stop").click();
  await expect(page.getByTestId("memo-play").first()).toBeEnabled({ timeout: 1_000 });
}

/** Chooses **Record memo** from a part's menu and waits for the recording to start. Leaves the recording running. */
export async function startRecording(page: Page, partLabel: string) {
  await openRecorder(page, partLabel);
}

/** The ids of the memos drawn now, in order. */
export const memoIds = (page: Page) =>
  page.getByTestId("memo").evaluateAll((els) => els.map((e) => e.getAttribute("data-memo-id") ?? ""));

/** The list draws only the newest 3, so a new memo is found by its id, not by counting. Returns Stop to playable, in ms. */
export async function stopToPlayable(page: Page, recordMs: number): Promise<number> {
  const before = new Set(await memoIds(page));
  await startRecording(page, "A");
  await page.waitForTimeout(recordMs);
  const stoppedAt = Date.now();
  await page.getByTestId("record-stop").click();
  await expect
    .poll(
      async () => {
        const fresh = (await memoIds(page)).find((id) => !before.has(id));
        if (!fresh) return false;
        return page.locator(`[data-memo-id="${fresh}"]`).getByTestId("memo-play").isEnabled();
      },
      { intervals: [25], timeout: 15_000 },
    )
    .toBe(true);
  return Date.now() - stoppedAt;
}

/** Every stream's tracks are `ended` within a second (INV-007). */
export async function expectMicrophoneReleased(page: Page) {
  await expect
    .poll(
      async () => {
        const states = await microphoneTrackStates(page);
        return states.length > 0 && states.every((s) => s === "ended");
      },
      { timeout: 1_000 },
    )
    .toBe(true);
}

/**
 * A full device. Chromium's `Storage.overrideQuotaForOrigin` is not honoured for this origin's IndexedDB under the
 * test runner (the reported quota does not change, and a 2 MB write still lands), so instead a write of a clip
 * (`memoAudio`) fails with a real `QuotaExceededError` while `window.__deviceFull` is true. Everything after the
 * failed write is the app's own code. Flip it with `setDeviceFull`.
 */
export async function fillDevice(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __deviceFull: boolean };
    w.__deviceFull = false;
    const real = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["put"]>) {
      if (w.__deviceFull && this.name === "memoAudio") throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      return real.apply(this, args);
    };
  });
}
export const setDeviceFull = (page: Page, full: boolean) =>
  page.evaluate((f) => ((window as unknown as { __deviceFull: boolean }).__deviceFull = f), full);

// --- a shared part, for two-context specs (US2) --------------------------------------------------------------

/**
 * Adds part A to the band's song through the owner's own push (a plain sync mutation), then opens the song on both
 * members' pages. `bandUrl` and `songUrl` come from `twoMembers`.
 */
export async function sharePartA(trio: { owner: Member; guest: Member; bandUrl: string; songUrl: string }) {
  const bandId = trio.bandUrl.split("/").pop()!;
  const songId = trio.songUrl.split("/").pop()!;
  const hlc = `${String(Date.now()).padStart(15, "0")}:0000:e2e`;
  const res = await trio.owner.page.request.post("/api/sync/push", {
    data: {
      mutations: [
        {
          table: "parts",
          row: {
            id: randomUUID(),
            bandId,
            songId,
            label: "A",
            name: null,
            rank: "a0",
            variantOfPartId: null,
            notes: null,
            updatedAt: hlc,
            deletedAt: null,
            fieldClocks: { deletedAt: hlc, label: hlc },
            serverSeq: 0,
          },
        },
      ],
    },
  });
  expect(res.ok()).toBe(true);
  for (const m of [trio.owner, trio.guest]) {
    await m.page.goto(trio.songUrl);
    await expect(async () => {
      await m.page.reload();
      await expect(m.page.getByRole("button", { name: /^Actions for part A/ })).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
  }
}
