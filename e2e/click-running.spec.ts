/**
 * INV-025, INV-027, INV-028, INV-030, INV-039, INV-041: what a running click does when the tempo
 * moves, when the notation moves, when there is no sound; how it shows; what it writes; what it says.
 * Changes "from another device" arrive as a raw row and a landing, which is what a pull looks like
 * to the screen. e2e/click-state.spec.ts's mid-run edit wrote a field that does not exist, through a
 * path Dexie cannot see.
 */
import { expect, test, type Page } from "@playwright/test";
import { openCluster } from "./usability-helpers";
import {
  cols,
  dump,
  level,
  patchEvent,
  patchSong,
  rec,
  recorder,
  seed,
  setTempoBySheet,
  tapAt,
  tapsFor,
  type Col,
} from "./rhythm-probe-helpers";

const gaps = async (page: Page) => {
  const s = (await rec(page)).starts;
  return s.slice(1).map((x, i) => Math.round((x.when - s[i].when) * 1000) / 1000);
};

const state = (page: Page) => page.getByTestId("click-state");

for (const stage of ["count-in", "following", "plain"] as const) {
  test(`INV-025 a tempo set on the sheet during ${stage}: no restart, queued clicks stay`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
    await recorder(page);
    const list = stage === "plain" ? cols(null) : cols("q", "q", "q", "q", "q", "q", "q", "q", "q", "q");
    const { playUrl } = await seed(page, list, { bpm: 60 });
    await page.goto(playUrl);
    await page.getByTestId("click-start").click();
    if (stage === "following") await expect(state(page)).toHaveText("Following the notation.", { timeout: 7000 });
    if (stage === "plain") await expect(state(page)).toHaveText("Plain beat.", { timeout: 7000 });
    await setTempoBySheet(page, 120);
    const at = (await rec(page)).starts.length;
    await expect.poll(async () => (await rec(page)).starts.length, { timeout: 6000 }).toBeGreaterThan(at + 4);
    const g = await gaps(page);
    expect((await rec(page)).contexts).toBe(1);
    expect(g.every((x) => x === 1 || x === 0.5), JSON.stringify(g)).toBe(true);
    expect(g.at(-1)).toBe(0.5);
    // Once it changes it stays changed, and nothing is counted in again.
    const first = g.indexOf(0.5);
    expect(g.slice(first).every((x) => x === 0.5)).toBe(true);
    if (stage !== "count-in") {
      await expect(page.getByTestId("click-beat").locator("[data-role=count]")).toHaveText("");
    }
  });
}

for (const [from, to] of [
  [240, 60],
  [60, 240],
] as const) {
  test(`INV-025 ${from} to ${to} from another device`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
    await recorder(page);
    const { playUrl } = await seed(page, cols(null), { bpm: from });
    await page.goto(playUrl);
    await page.getByTestId("click-start").click();
    await expect(state(page)).toHaveText("Plain beat.", { timeout: 8000 });
    await patchSong(page, { bpm: to });
    await expect(page.getByTestId("tempo-control")).toHaveText(`${to} bpm`);
    const at = (await rec(page)).starts.length;
    await expect.poll(async () => (await rec(page)).starts.length, { timeout: 8000 }).toBeGreaterThan(at + 2);
    const g = await gaps(page);
    expect(g.at(-1)).toBeCloseTo(60 / to, 3);
    expect(new Set(g).size).toBe(2);
    expect((await rec(page)).contexts).toBe(1);
  });
}

test("INV-025 10 to 120 with the last click seconds old does not read as falling behind", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
  test.setTimeout(60_000);
  await recorder(page);
  const { playUrl } = await seed(page, cols(null), { bpm: 10 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").click();
  await page.waitForTimeout(5900);
  await patchSong(page, { bpm: 120 });
  await expect(page.getByTestId("tempo-control")).toHaveText("120 bpm");
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("click-stop")).toBeVisible();
  const g = await gaps(page);
  expect(g.at(-1)).toBe(0.5);
  await expect(state(page)).not.toContainText("could not keep time");
});

for (const value of [null, 120.5, 120] as const) {
  test(`INV-025 a tempo of ${value} landing keeps what is running`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
    await recorder(page);
    const { playUrl } = await seed(page, cols(null), { bpm: 120 });
    await page.goto(playUrl);
    await page.getByTestId("click-start").click();
    await expect(state(page)).toHaveText("Plain beat.", { timeout: 5000 });
    await patchSong(page, { bpm: value });
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("click-stop")).toBeVisible();
    expect((await gaps(page)).every((x) => x === 0.5)).toBe(true);
  });
}

test("INV-025 a tempo landing while the audio is still starting takes effect", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
  // Round 1, MINOR: useClick.ts only forwards a change while `running`, and its effect does not
  // re-run on the move from `starting`, so the run keeps the old tempo while the control shows the new.
  test.fail(true, "known MINOR: a change inside the resume window is dropped");
  await recorder(page, { audio: "slow-resume" });
  const { playUrl } = await seed(page, cols(null), { bpm: 120 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").click();
  await patchSong(page, { bpm: 60 });
  await expect(page.getByTestId("tempo-control")).toHaveText("60 bpm");
  await expect.poll(async () => (await rec(page)).starts.length, { timeout: 4000 }).toBeGreaterThan(2);
  expect((await gaps(page))[0]).toBe(1);
});

for (const audio of ["absent", "throws", "never-resumes"] as const) {
  test(`INV-027 audio ${audio}: the beat shows and the words say so through every stage`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
    await recorder(page, { audio });
    const { playUrl } = await seed(page, cols("q", "q", "q", "q", "|", null), { bpm: 240 });
    await page.goto(playUrl);
    await expect(page.getByTestId("click-help")).toHaveCount(0);
    await page.getByTestId("click-start").click();
    const SILENT = "No sound on this device. The beat is still shown.";
    await expect(page.getByTestId("click-help")).toHaveText(SILENT, { timeout: 3000 });
    await expect(state(page)).toHaveText("Counting in.");
    await expect(page.getByTestId("click-beat")).toHaveAttribute("data-level", /beat/, { timeout: 3000 });
    await expect(state(page)).toHaveText("Following the notation.", { timeout: 4000 });
    await expect(page.getByTestId("click-help")).toHaveText(SILENT);
    await expect(state(page)).toHaveText("Plain beat.", { timeout: 4000 });
    await expect(page.getByTestId("click-help")).toHaveText(SILENT);
    await page.getByTestId("click-stop").click();
    await expect(page.getByTestId("click-help")).toHaveCount(0);
    const r = await rec(page);
    expect([r.audioSessionWrites, r.mediaPlays, r.newAudios]).toEqual([0, 0, 0]);
  });
}

const TRIPLET: Col[] = [
  ...cols("q", "q"),
  { kind: "barline" },
  { d: "8", tupletId: "t", tupletCount: 3, groupKind: "tuplet" },
  { d: "8", tupletId: "t", tupletCount: 3, groupKind: "tuplet" },
  { d: "8", tupletId: "t", tupletCount: 3, groupKind: "tuplet" },
  ...cols("q"),
];

for (const reduced of ["reduce", "no-preference"] as const) {
  test(`INV-028 every shown click within 50ms of its moment, by shape, not by colour (${reduced})`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
    await page.emulateMedia({ reducedMotion: reduced });
    await recorder(page);
    const { playUrl } = await seed(page, TRIPLET, { bpm: 240 });
    await page.goto(playUrl);
    await page.getByTestId("click-start").click();
    await page.getByTestId("click-beat").evaluate((el) => {
      if (el.getAnimations({ subtree: true }).length) throw new Error("the indicator animates");
      const w = window as unknown as {
        __shown: { level: string; t: number; w: number; h: number; radius: string; fill: string }[];
        __ctxs: AudioContext[];
      };
      w.__shown = [];
      const shape = el.querySelector("span") as HTMLElement;
      new MutationObserver(() => {
        const l = (el as HTMLElement).dataset.level ?? "";
        if (!l) return;
        const t = w.__ctxs.at(-1)!.currentTime;
        // A frame later: globals.css gives reduced motion a 0.01ms transition, so a read in this
        // microtask sees the size the last level left, which no frame ever paints.
        setTimeout(() => {
          if ((el as HTMLElement).dataset.level !== l) return;
          const s = getComputedStyle(shape);
          w.__shown.push({
            level: l,
            t,
            w: shape.getBoundingClientRect().width,
            h: shape.getBoundingClientRect().height,
            radius: s.borderTopLeftRadius,
            fill: s.backgroundColor,
          });
        }, 34);
      }).observe(el, { attributes: true, attributeFilter: ["data-level"] });
    });
    await page.waitForTimeout(3500);
    const shown = await page.evaluate(
      () => (window as unknown as { __shown: { level: string; t: number; w: number; h: number; radius: string }[] }).__shown,
    );
    const starts = (await rec(page)).starts;
    await page.getByTestId("click-stop").click();
    expect(shown.length).toBeGreaterThan(8);
    for (const s of shown) {
      const near = starts.reduce((a, b) => (Math.abs(b.when - s.t) < Math.abs(a.when - s.t) ? b : a));
      expect(Math.abs(near.when - s.t), `${s.level} at ${s.t}`).toBeLessThan(0.05);
      expect(level(near.hz)).toBe(s.level);
    }
    // Every showing of a level, not the last: one level drawn at another's size is the defect.
    const sizes = (l: string) => [...new Set(shown.filter((s) => s.level === l).map((s) => s.w))];
    expect(JSON.stringify({ accent: sizes("accent"), beat: sizes("beat"), soft: sizes("soft") })).toBe(
      JSON.stringify({ accent: [32], beat: [20], soft: [10] }),
    );
    expect(shown.filter((s) => s.level === "accent").every((s) => s.radius === "0px")).toBe(true);
  });
}

test("INV-030 a run through every stage, the follow choice and the endings writes nothing", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
  await recorder(page);
  const { playUrl } = await seed(page, cols("q", "q", "|", null), { bpm: 240 });
  await page.goto(playUrl);
  await openCluster(page);
  await expect(page.getByTestId("click-follow")).toBeVisible();
  await page.waitForTimeout(500);
  const before = await dump(page);
  const local = await page.evaluate(() => JSON.stringify(localStorage));
  const sync: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/")) sync.push(r.url());
  });
  await page.getByTestId("click-follow").click();
  await page.getByTestId("click-follow").click();
  await page.getByTestId("click-start").click();
  await expect(state(page)).toHaveText("Plain beat.", { timeout: 5000 });
  await page.getByTestId("click-stop").click();
  await openCluster(page);
  await page.getByTestId("click-follow").click();
  await page.getByTestId("click-start").click();
  await expect(state(page)).toHaveText("Plain beat.", { timeout: 5000 });
  await page.evaluate(() => void window.dispatchEvent(new Event("pagehide")));
  await expect(page.getByTestId("click-start")).toBeVisible();
  expect(await dump(page)).toBe(before);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(local);
  expect(sync).toEqual([]);
});

test("INV-039 a duration and a barline landing mid-run change nothing until the next start", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
  await recorder(page);
  const { playUrl } = await seed(page, cols("q", "q", "q", "q", "q", "q", "q", "q", "q", "q", "q", "q"), { bpm: 120 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").click();
  await expect(state(page)).toHaveText("Following the notation.", { timeout: 4000 });
  await patchEvent(page, 6, { durationHint: null });
  await patchEvent(page, 3, { kind: "barline", frets: {} });
  await expect(page.getByTestId("tab-rhythm").nth(6)).not.toHaveAttribute("data-duration", /.+/);
  await page.waitForTimeout(3500);
  const levels = (await rec(page)).starts.map((s) => level(s.hz));
  // Twelve quarters, one bar: an accent once, no second accent from the new barline, no fall to plain.
  expect(levels.slice(0, 5)).toEqual(["beat", "beat", "beat", "beat", "accent"]);
  expect(levels.slice(5).every((l) => l === "beat")).toBe(true);
  await expect(state(page)).toHaveText("Following the notation.");
  await page.getByTestId("click-stop").click();

  const held = (await rec(page)).starts.length;
  await page.getByTestId("click-start").click();
  await expect.poll(async () => (await rec(page)).starts.length, { timeout: 6000 }).toBeGreaterThan(held + 8);
  const next = (await rec(page)).starts.slice(held).map((s) => level(s.hz));
  // Bar 1 is now three quarters, and bar 2 holds the gap: it plays three and falls to plain.
  expect(next.slice(4, 8)).toEqual(["accent", "beat", "beat", "beat"]);
  expect(next.slice(5).every((l) => l === "beat")).toBe(true);
});

test("INV-039 the part deleted mid-run changes nothing in the run", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
  await recorder(page);
  const { playUrl } = await seed(page, cols("q", "q", "q", "q", "q", "q", "q", "q"), { bpm: 120 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").click();
  await expect(state(page)).toHaveText("Following the notation.", { timeout: 4000 });
  for (let i = 0; i < 8; i++) await patchEvent(page, 0, { deletedAt: "2026-11-05T00:00:00.000Z-0000-x" });
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("click-stop")).toBeVisible();
  expect((await gaps(page)).every((x) => x === 0.5)).toBe(true);
});

test("INV-041 sixteen beats add no announcement; each change is one; the beat is hidden from readers", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
  await recorder(page);
  const { playUrl } = await seed(page, cols("q", "q", "|", null), { bpm: 240 });
  await page.goto(playUrl);
  await openCluster(page);
  await expect(page.getByTestId("click-follow")).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as { __said: string[] };
    w.__said = [];
    const el = document.querySelector("[data-testid=click-state]")!;
    new MutationObserver(() => w.__said.push(el.textContent ?? "")).observe(el, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  await page.getByTestId("click-start").click();
  await expect(page.getByTestId("click-stop")).toBeFocused();
  await expect(page.getByTestId("click-beat")).toHaveAttribute("aria-hidden", "true");
  await page.waitForTimeout(4500);
  await page.getByTestId("click-stop").click();
  const said = await page.evaluate(() => (window as unknown as { __said: string[] }).__said);
  expect(said).toEqual([
    "Counting in.",
    "Following the notation.",
    "Plain beat.",
    "Click follows the notation.",
  ]);
});

test("INV-025 same value from the sheet: nothing moves", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
  await recorder(page);
  const { playUrl } = await seed(page, cols(null), { bpm: 120 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").click();
  await expect(state(page)).toHaveText("Plain beat.", { timeout: 5000 });
  await page.getByTestId("tempo-control").click();
  await tapAt(page, tapsFor(120));
  await page.getByTestId("tempo-set").click();
  await page.waitForTimeout(1000);
  expect((await gaps(page)).every((x) => x === 0.5)).toBe(true);
  expect((await rec(page)).contexts).toBe(1);
});
