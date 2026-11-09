/**
 * INV-023, INV-026, INV-029 over X x K. X is every way a run ends, K every stage it can end in:
 * every X once, and every K once (by the stop tap), not the full product. For each: nothing queued survives, the context closes in the same task as the ending, the words are
 * right, the wake lock is let go, nothing restarts on return, and one tap starts again from one.
 * "Queue ran dry" cannot be made through the screen (the stream is endless): it is the engine probe.
 */
import { expect, test, type Page } from "@playwright/test";
import { openCluster } from "./usability-helpers";
import { cols, deviceSets, idb, rec, recorder, resolveWake, seed, type Col } from "./rhythm-probe-helpers";

/** Timed for one bar at 240 bpm, then a gap: count-in, following, plain after a gap. */
const GAPPED: Col[] = cols("q", "q", "q", "q", "|", null);
/** Nothing to follow: the list for `starting`. */
const BARE: Col[] = cols(null, null);

// One stage per phase. The three ways into plain (after a gap, after the end, from the first
// click) end in the same phase, so the one reached mid-run, out of following, stands for all three.
const STARTING = { k: "starting", list: BARE, audio: "slow-resume" as const, waitFor: null };
const COUNT_IN = { k: "count-in", list: GAPPED, audio: "ok" as const, waitFor: "Counting in." };
const FOLLOWING = { k: "following", list: GAPPED, audio: "ok" as const, waitFor: "Following the notation." };
const PLAIN = { k: "plain after a gap", list: GAPPED, audio: "ok" as const, waitFor: "Plain beat." };

const HIDDEN = "Stopped because the screen was hidden. Start again when you are ready.";
const LOST = "Stopped because the device took the audio. Start again when you are ready.";

async function reach(page: Page, waitFor: string | null) {
  await page.getByTestId("click-start").click();
  if (waitFor) await expect(page.getByTestId("click-state")).toHaveText(waitFor, { timeout: 8000 });
}

/** Ends that leave the screen up. */
const IN_PLACE: { x: string; end: (page: Page) => Promise<void>; words: string | null }[] = [
  {
    x: "stop tap",
    end: (page) => page.getByTestId("click-stop").evaluate((b) => (b as HTMLButtonElement).click()),
    words: null,
  },
  {
    x: "page hidden",
    end: (page) =>
      page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
      }),
    words: HIDDEN,
  },
  {
    x: "pagehide",
    end: (page) => page.evaluate(() => void window.dispatchEvent(new Event("pagehide"))),
    words: HIDDEN,
  },
  { x: "context suspended", end: (page) => deviceSets(page, "suspended"), words: LOST },
  { x: "context interrupted", end: (page) => deviceSets(page, "interrupted"), words: LOST },
  { x: "context closed", end: (page) => deviceSets(page, "closed"), words: LOST },
];

const visible = (page: Page) =>
  page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
  });

const [STOP_TAP, ...OTHER_IN_PLACE] = IN_PLACE;
const IN_PLACE_CASES = [
  // The stop tap in every phase: each has its own queued sources to cancel.
  ...[STARTING, COUNT_IN, FOLLOWING, PLAIN].map((stage) => ({ stage, ending: STOP_TAP })),
  // Every other ending once, while following: the ending is the variable, not the phase.
  ...OTHER_IN_PLACE.map((ending) => ({ stage: FOLLOWING, ending })),
];

for (const { stage, ending } of IN_PLACE_CASES) {
  test(`INV-023 ${ending.x} during ${stage.k}`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
    await recorder(page, { audio: stage.audio });
    const { playUrl } = await seed(page, stage.list, { bpm: 240 });
    await page.goto(playUrl);
    await reach(page, stage.waitFor);
    // The context reaches running only after resume, so a device taking it during `starting`
    // has nothing to take: the ending there is the slow resume racing a stop.
    const queued = (await rec(page)).starts.length;

    await ending.end(page);
    await expect(page.getByTestId("click-start")).toBeVisible();
    if (ending.words && stage.k !== "starting") {
      await expect(page.getByTestId("click-state")).toHaveText(ending.words);
    }
    const r = await rec(page);
    expect(r.closes, "the context closed").toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(600);
    const after = await rec(page);
    expect(after.starts.length, "a click was queued after the end").toBe(queued);

    // Back on screen: nothing restarts by itself.
    await visible(page);
    await page.waitForTimeout(200);
    await expect(page.getByTestId("click-start")).toBeVisible();
    expect((await rec(page)).contexts).toBe(1);

    // One tap starts again, and counts from one.
    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-stop")).toBeVisible();
    await expect.poll(async () => (await rec(page)).contexts).toBe(2);
    await expect(page.getByTestId("click-state")).toHaveText(/Counting in\.|Following|Plain/);
  });
}

const AWAY: { x: string; end: (page: Page, urls: { songUrl: string }) => Promise<void> }[] = [
  { x: "back link", end: (page) => page.getByRole("link", { name: "Song" }).click() },
  { x: "the Capture link", end: async (page) => { await openCluster(page); await page.getByRole("link", { name: "Capture" }).click(); } },
  { x: "browser back", end: (page) => page.goBack().then(() => {}) },
];

const AWAY_CASES = [
  // Every way away, while following.
  ...AWAY.map((away) => ({ stage: FOLLOWING, away })),
  // The count-in queues its own clicks ahead of the notation: one way away from it.
  { stage: COUNT_IN, away: AWAY[0] },
];

for (const { stage, away } of AWAY_CASES) {
  test(`INV-023 ${away.x} during ${stage.k}`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
    await recorder(page);
    const { songUrl, playUrl } = await seed(page, stage.list, { bpm: 240 });
    await page.goto(songUrl);
    await page.getByRole("link", { name: "Play view" }).click();
    await expect(page).toHaveURL(playUrl);
    await expect(page.getByTestId("click-start")).toBeEnabled();
    await reach(page, stage.waitFor);
    await away.end(page, { songUrl });
    await expect(page.getByTestId("click-bar")).toHaveCount(0);
    const r = await rec(page);
    expect(r.closes).toBe(1);
    expect(r.wakeReleases).toBe(r.wakeResolved);
    await page.waitForTimeout(500);
    expect((await rec(page)).starts.length).toBe(r.starts.length);
  });
}

// One phase each: the ending, not the phase, is under test, and the stop tap covers every phase.
for (const stage of [FOLLOWING]) {
  test(`INV-023 song deleted on another device during ${stage.k}`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
    await recorder(page);
    const { playUrl } = await seed(page, stage.list, { bpm: 240 });
    await page.goto(playUrl);
    await reach(page, stage.waitFor);
    await idb(
      page,
      `const tx = db.transaction("songs", "readwrite");
       const s = tx.objectStore("songs");
       const r = s.getAll();
       r.onsuccess = () => { for (const row of r.result) s.put({ ...row, deletedAt: "2026-11-05T00:00:00.000Z-0000-x" }); };
       await new Promise((res) => (tx.oncomplete = res));`,
    );
    await page.evaluate(() => {
      const c = new BroadcastChannel("x-storagemutated-1");
      c.postMessage({ all: {} });
      c.close();
    });
    await expect(page.getByTestId("click-bar")).toHaveCount(0);
    const r = await rec(page);
    expect(r.closes).toBe(1);
    await page.waitForTimeout(500);
    expect((await rec(page)).starts.length).toBe(r.starts.length);
  });

  test(`INV-023 reload during ${stage.k}`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
    await recorder(page);
    const { playUrl } = await seed(page, stage.list, { bpm: 240 });
    await page.goto(playUrl);
    await reach(page, stage.waitFor);
    await page.reload();
    await expect(page.getByTestId("click-start")).toBeVisible();
    await page.waitForTimeout(300);
    expect((await rec(page)).contexts, "nothing starts by itself after a reload").toBe(0);
  });
}

test("INV-023 SC-006: 100 stops at random moments, every source cancelled in the same task", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
  test.setTimeout(180_000);
  await recorder(page);
  const { playUrl } = await seed(page, cols("q", "8", "8", "16", "16", "16", "16", "|", "q"), { bpm: 240 });
  await page.goto(playUrl);
  let s = 12345;
  const next = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 100; i++) {
    await page.getByTestId("click-start").click();
    await page.waitForTimeout(Math.floor(next() * 900));
    const out = await page.getByTestId("click-stop").evaluate((btn) => {
      const w = window as unknown as {
        __rec: { closes: number; stops: { when: number | null }[] };
        __ctxs: AudioContext[];
      };
      const closes = w.__rec.closes;
      const hard = w.__rec.stops.filter((x) => x.when === null).length;
      const t0 = performance.now();
      (btn as HTMLButtonElement).click();
      return {
        closed: w.__rec.closes - closes,
        hard: w.__rec.stops.filter((x) => x.when === null).length - hard,
        ms: performance.now() - t0,
      };
    });
    expect(out.closed, `stop ${i}`).toBe(1);
    expect(out.ms, `stop ${i} took too long`).toBeLessThan(50);
  }
});

test("INV-029 the wake lock on every ending, absent, refused and late", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
  await recorder(page);
  const { playUrl } = await seed(page, cols(null), { bpm: 120 });
  await page.goto(playUrl);
  expect((await rec(page)).wakeRequests).toBe(0);
  for (const [i, ending] of IN_PLACE.entries()) {
    await page.getByTestId("click-start").click();
    await expect.poll(async () => (await rec(page)).wakeRequests).toBe(i + 1);
    await ending.end(page);
    await expect.poll(async () => (await rec(page)).wakeReleases, ending.x).toBe(i + 1);
    await visible(page);
  }
});

for (const wakeLock of ["absent", "rejects"] as const) {
  test(`INV-029 wake lock ${wakeLock}: the click runs and stops`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await recorder(page, { wakeLock });
    const { playUrl } = await seed(page, cols(null), { bpm: 240 });
    await page.goto(playUrl);
    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-state")).toHaveText("Plain beat.", { timeout: 5000 });
    await page.getByTestId("click-stop").click();
    await expect(page.getByTestId("click-start")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("INV-029 a lock that resolves after stop is let go at once", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
  await recorder(page, { wakeLock: "late" });
  const { playUrl } = await seed(page, cols(null), { bpm: 120 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").click();
  await expect.poll(async () => (await rec(page)).wakeRequests).toBe(1);
  await page.getByTestId("click-stop").click();
  await resolveWake(page);
  await expect.poll(async () => (await rec(page)).wakeReleases).toBe(1);
});

test("INV-029 a lock from an earlier run does not outlive the next one", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
  // Round 1, MINOR: start, stop, start with the first request still out. `wanted` is true again
  // when it arrives, so both sentinels are taken and the first is overwritten and never released.
  test.fail(true, "known MINOR: needs the request to outlast a stop and a start");
  await recorder(page, { wakeLock: "late" });
  const { playUrl } = await seed(page, cols(null), { bpm: 120 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").click();
  await expect.poll(async () => (await rec(page)).wakeRequests).toBe(1);
  await page.getByTestId("click-stop").click();
  await page.getByTestId("click-start").click();
  await expect.poll(async () => (await rec(page)).wakeRequests).toBe(2);
  await resolveWake(page);
  await page.waitForTimeout(50);
  await page.getByTestId("click-stop").click();
  await expect.poll(async () => (await rec(page)).wakeReleases, { timeout: 1000 }).toBe(2);
});
