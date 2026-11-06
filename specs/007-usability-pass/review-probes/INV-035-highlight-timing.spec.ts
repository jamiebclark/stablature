/**
 * INV-035: a MutationObserver from before start logs each change of `.tab-column-reading` and of the beat box, with
 * timestamps. usability-highlight.spec.ts has the observer but never reads a time. Requirement: no more than 50 ms from a
 * beat, absent outside following.
 */
import { expect, test, type Page } from "@playwright/test";
import { n } from "../../../e2e/reading-helpers";
import { openCluster } from "../../../e2e/usability-helpers";
import { cols, deviceSets, patchSong, recorder, seed, type Col } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(60_000);
test.skip(({ isMobile }) => isMobile, "the engine and hook do not differ by device");

interface Log {
  at: number;
  kind: "reading" | "beat" | "state";
  value: string | null;
}

/** Installed before the page, and keeps watching across renders by observing the whole body. */
const observe = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as { __log: Log[] };
    w.__log = [];
    let reading: string | null = null;
    let beat: string | null = null;
    let words: string | null = null;
    const look = () => {
      const now = performance.now();
      const r = document.querySelector(".tab-column-reading")?.getAttribute("data-column") ?? null;
      if (r !== reading) {
        reading = r;
        w.__log.push({ at: now, kind: "reading", value: r });
      }
      const box = document.querySelector('[data-testid="click-beat"]');
      const b = box?.getAttribute("data-level") ?? null;
      const count = box?.querySelector('[data-role="count"]')?.textContent ?? "";
      const key = b === null ? null : `${b}|${count}`;
      if (key !== beat) {
        beat = key;
        w.__log.push({ at: now, kind: "beat", value: key });
      }
      const s = document.querySelector('[data-testid="click-state"]')?.textContent ?? null;
      if (s !== words) {
        words = s;
        w.__log.push({ at: now, kind: "state", value: s });
      }
    };
    const start = () => {
      new MutationObserver(look).observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
        attributeFilter: ["class", "data-level"],
      });
    };
    if (document.documentElement) start();
    else addEventListener("DOMContentLoaded", start);
  });

const log = (page: Page) => page.evaluate(() => (window as unknown as { __log: Log[] }).__log);

const begin = async (page: Page, list: Col[], bpm: number, passes = 1) => {
  await recorder(page, { audio: "ok" });
  await observe(page);
  const { playUrl } = await seed(page, list, { bpm, passes });
  await page.goto(playUrl);
  await expect(page.getByTestId("click-start")).toBeEnabled();
  return playUrl;
};

const start = (page: Page) => page.getByTestId("click-start").click();
const stateIs = (page: Page, text: string, timeout = 15_000) =>
  expect(page.getByTestId("click-state")).toHaveText(text, { timeout });

/** Each highlight change against the nearest change of the beat box. */
const drift = (entries: Log[]) => {
  const beats = entries.filter((e) => e.kind === "beat" && e.value && !e.value.startsWith("|")).map((e) => e.at);
  const moves = entries.filter((e) => e.kind === "reading" && e.value !== null);
  return moves.map((m) => Math.min(...beats.map((b) => Math.abs(b - m.at))));
};

const between = (entries: Log[], from: string, to: string | null) => {
  const a = entries.find((e) => e.kind === "state" && e.value === from)?.at ?? 0;
  const b = to ? (entries.find((e) => e.kind === "state" && e.value === to)?.at ?? Infinity) : Infinity;
  return { a, b };
};

test("INV-035 count-in shows nothing, and each column meets its beat across a barline and two passes", async ({ page }) => {
  await begin(page, cols("q", "q", "q", "q", "|", "q", "q", "q", "q"), 120, 2);
  await start(page);
  await stateIs(page, "Plain beat.", 20_000);
  const entries = await log(page);
  const count = between(entries, "Counting in.", "Following the notation.");
  const during = entries.filter((e) => e.kind === "reading" && e.value !== null && e.at >= count.a && e.at < count.b - 50);
  expect(during, "nothing lit during the count-in").toEqual([]);
  const d = drift(entries);
  expect(d.length, "every column of both passes").toBe(16);
  expect(Math.max(...d), `drift ${d.map((x) => x.toFixed(0))}`).toBeLessThanOrEqual(50);
  expect(entries.filter((e) => e.kind === "reading").at(-1)?.value, "it left at the last timed column").toBeNull();
});

test("INV-035 a repeat lights each repetition", async ({ page }) => {
  await begin(page, [{ d: "q", repeat: 3 }, { d: "q" }], 120);
  await start(page);
  await stateIs(page, "Plain beat.", 20_000);
  const entries = await log(page);
  const seen = entries.filter((e) => e.kind === "reading" && e.value !== null).map((e) => e.value);
  expect(new Set(seen).size, `one stop per repetition ${seen}`).toBe(4);
  expect(Math.max(...drift(entries))).toBeLessThanOrEqual(50);
});

test("INV-035 a tuplet keeps its own time, between beats", async ({ page }) => {
  const t = (): Col => ({ d: "8", tupletId: "t1", tupletCount: 3, tupletNotes: 3 }) as Col;
  await begin(page, [{ d: "q" }, t(), t(), t(), { d: "q" }, { d: "q" }], 60);
  await start(page);
  await stateIs(page, "Plain beat.", 20_000);
  const moves = (await log(page)).filter((e) => e.kind === "reading" && e.value !== null).map((e) => e.at);
  expect(moves.length).toBe(6);
  // 60 bpm: a quarter, three triplet eighths of 333 ms, two quarters.
  const want = [0, 1000, 1333, 1667, 2000, 3000];
  moves.forEach((at, i) => expect(Math.abs(at - moves[0] - want[i]), `column ${i}`).toBeLessThanOrEqual(50));
});

test("INV-035 a part that stops being timed leaves it, into the plain beat", async ({ page }) => {
  await begin(page, cols("q", "q", "q", "q", "|", null, null), 120);
  await start(page);
  await stateIs(page, "Plain beat.", 20_000);
  await page.waitForTimeout(1200);
  const entries = await log(page);
  const plain = entries.find((e) => e.kind === "state" && e.value === "Plain beat.")!.at;
  const lit = entries.filter((e) => e.kind === "reading" && e.value !== null && e.at > plain + 50);
  expect(lit, "nothing lights in the plain beat").toEqual([]);
  await expect(page.locator(".tab-column-reading")).toHaveCount(0);
});

test("INV-035 the follow choice off shows nothing", async ({ page }) => {
  await begin(page, cols("q", "q", "q", "q"), 240);
  await openCluster(page);
  await page.getByTestId("click-follow").click();
  await start(page);
  await page.waitForTimeout(2500);
  expect((await log(page)).filter((e) => e.kind === "reading" && e.value !== null)).toEqual([]);
});

test("INV-035 a tempo arriving mid-run does not break the run's own score", async ({ page }) => {
  await begin(page, cols(...Array.from({ length: 16 }, () => "q")), 120);
  await start(page);
  await stateIs(page, "Following the notation.");
  await page.waitForTimeout(800);
  await patchSong(page, { bpm: 200 });
  await stateIs(page, "Plain beat.", 20_000);
  const d = drift(await log(page));
  expect(d.length).toBe(16);
  expect(Math.max(...d)).toBeLessThanOrEqual(50);
});

const ENDINGS: { name: string; end: (page: Page) => Promise<void> }[] = [
  { name: "stop tap", end: (p) => p.getByTestId("click-stop").click() },
  {
    name: "page hidden",
    end: (p) =>
      p.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
      }),
  },
  { name: "pagehide", end: (p) => p.evaluate(() => void window.dispatchEvent(new Event("pagehide"))) },
  { name: "context suspended", end: (p) => deviceSets(p, "suspended") },
  { name: "context interrupted", end: (p) => deviceSets(p, "interrupted") },
  { name: "context closed", end: (p) => deviceSets(p, "closed") },
];

for (const ending of ENDINGS) {
  test(`INV-035 ${ending.name} clears the highlight at once`, async ({ page }) => {
    await begin(page, cols(...Array.from({ length: 32 }, () => "q")), 120);
    await start(page);
    await stateIs(page, "Following the notation.");
    await expect(page.locator(".tab-column-reading")).toHaveCount(1);
    await ending.end(page);
    await expect(page.getByTestId("click-start")).toBeVisible();
    await expect(page.locator(".tab-column-reading")).toHaveCount(0);
  });
}

test("INV-035 a part with notes but no durations follows nothing", async ({ page }) => {
  await begin(page, [n(3), n(5)], 120);
  await start(page);
  await page.waitForTimeout(1500);
  expect((await log(page)).filter((e) => e.kind === "reading" && e.value !== null)).toEqual([]);
});
