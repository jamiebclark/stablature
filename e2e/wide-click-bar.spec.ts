/** INV-011 / INV-012: the click bar sits at the foot, keeps one height, and its controls do not move. */
import { expect, test, type Page } from "@playwright/test";
import { cols, seed } from "./rhythm-probe-helpers";
import { seedFitSong, seedWideSong } from "./wide-helpers";

test.setTimeout(180_000);

const IDS = ["click-start", "click-stop", "click-beat", "tempo-control", "panel-play-cluster"];

async function boxes(page: Page) {
  return page.evaluate((ids) => {
    const out: Record<string, { x: number; y: number; w: number; h: number } | null> = {};
    for (const id of ids) {
      const el = document.querySelector(`[data-testid="${id}"]`);
      const r = el?.getBoundingClientRect();
      out[id] = r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
    }
    const bar = document.querySelector('[data-testid="click-bar"]')!.getBoundingClientRect();
    return { out, bar: { top: bar.top, bottom: bar.bottom, h: bar.height }, inner: innerHeight };
  }, IDS);
}

function same(a: Awaited<ReturnType<typeof boxes>>, b: Awaited<ReturnType<typeof boxes>>, ids: string[], what: string) {
  for (const id of ids) {
    const p = a.out[id];
    const q = b.out[id];
    if (!p || !q) continue;
    for (const k of ["x", "y", "w", "h"] as const) expect(Math.abs(p[k] - q[k]), `${what} ${id}.${k}`).toBeLessThanOrEqual(0.5);
  }
}

for (const width of [375, 412, 768, 1024, 1280, 1440]) {
  test(`click bar holds still at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const { playUrl } = await seedFitSong(page);
    await page.goto(playUrl);
    const bar = page.getByTestId("click-bar");
    await expect(bar).toBeVisible();

    const rest = await boxes(page);
    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-stop")).toBeVisible();
    const running = await boxes(page);
    expect(Math.abs(running.bar.h - rest.bar.h), "bar height rest vs running").toBeLessThanOrEqual(0.5);
    expect(Math.abs(running.bar.top - rest.bar.top), "bar top rest vs running").toBeLessThanOrEqual(0.5);
    same(rest, running, ["tempo-control", "panel-play-cluster"], "start");
    await page.getByTestId("click-stop").click();
    await expect(page.getByTestId("click-start")).toBeVisible();
    const stopped = await boxes(page);
    same(rest, stopped, ["click-start", "tempo-control", "panel-play-cluster"], "stop");
    expect(Math.abs(stopped.bar.h - rest.bar.h)).toBeLessThanOrEqual(0.5);

    // Opening the cluster moves only the bar's top edge, upward.
    await page.getByTestId("panel-play-cluster").click();
    const open = await boxes(page);
    same(rest, open, ["click-start", "tempo-control", "panel-play-cluster"], "cluster");
    expect(open.bar.top).toBeLessThanOrEqual(rest.bar.top);
    expect(Math.abs(open.bar.bottom - rest.bar.bottom)).toBeLessThanOrEqual(0.5);
    await page.getByTestId("panel-play-cluster").click();

    // The end of the scroll leaves the last card clear of the bar.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const gap = await page.evaluate(() => {
      const lis = document.querySelectorAll("ul.reading-cards > li, main li");
      const last = lis[lis.length - 1].getBoundingClientRect();
      return document.querySelector('[data-testid="click-bar"]')!.getBoundingClientRect().top - last.bottom;
    });
    expect(gap).toBeGreaterThanOrEqual(7.5);
  });
}

test("a one-pass song's bar is at the foot of the screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { playUrl } = await seedWideSong(page, "short");
  await page.goto(playUrl);
  await expect(page.getByTestId("click-bar")).toBeVisible();
  const b = await boxes(page);
  expect(b.inner - b.bar.bottom).toBeLessThanOrEqual(1);
});

/** INV-012 (review): scrolled to the end of a 40-entry song, the last card clears the bar, at rest and running. */
const barClearance = (page: Page) =>
  page.evaluate(() => {
    const bar = document.querySelector('[data-testid="click-bar"]')!.getBoundingClientRect();
    const lis = [...document.querySelectorAll("ol.reading-cards > li")];
    const lowest = Math.max(...lis.map((li) => li.getBoundingClientRect().bottom));
    return {
      count: lis.length,
      lowest,
      barTop: bar.top,
      scrollHeight: document.documentElement.scrollHeight,
      inner: innerHeight,
    };
  });

for (const width of [375, 412, 768, 1024, 1280, 1440]) {
  test(`INV-012 the last card clears the bar at ${width}, rest and running, cluster closed and open`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const { playUrl } = await seed(page, cols("q", "q", "|", "q", "q"), { bpm: 120, entries: 40 });
    await page.goto(playUrl);
    await expect(page.locator("ol.reading-cards > li")).toHaveCount(40);
    await page.waitForFunction(() => [...document.querySelectorAll("ol.reading-cards > li")].every((li) => li.querySelector("[data-column]")));
    const bad: string[] = [];
    const check = async (what: string) => {
      // Let the bar settle at its new height (and the padding follow it) before going to the end.
      await page.waitForTimeout(400);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(400);
      const m = await barClearance(page);
      if (m.barTop - m.lowest < 7.5) bad.push(`${what}: last card bottom ${m.lowest}, bar top ${m.barTop}`);
    };
    await check("rest, closed");
    await page.getByTestId("panel-play-cluster").click();
    await check("rest, open");
    await page.getByTestId("panel-play-cluster").click();
    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-stop")).toBeVisible();
    await check("running, closed");
    await page.getByTestId("panel-play-cluster").click();
    await check("running, open");
    expect(bad).toEqual([]);
  });
}


// --- INV-011 every message (adopted from the review probe; review round 1) ---
const IDLE = [
  "Set a tempo to use the click.",
  "Click follows the notation.",
  "Click is a plain beat. Nothing at the start has a note length to follow.",
  "Click is a plain beat.",
  "Stopped because the screen was hidden. Start again when you are ready.",
  "Stopped because the device took the audio. Start again when you are ready.",
  "Stopped because the click could not keep time. Start again when you are ready.",
];
const RUNNING = ["Counting in.", "Following the notation.", "Plain beat."];
const HELP = ["Can't hear it? Check the silent switch and volume.", "No sound on this device. The beat is still shown."];
const ALL_IDS = ["click-start", "click-beat", "click-stop", "tempo-control", "panel-play-cluster"];

const allBoxes = (page: Page) =>
  page.evaluate((ids) => {
    const out: Record<string, number[] | null> = {};
    for (const id of ids) {
      const r = document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
      out[id] = r ? [r.x, r.y, r.width, r.height] : null;
    }
    const bar = document.querySelector('[data-testid="click-bar"]')!.getBoundingClientRect();
    return { out, top: bar.top, bottom: bar.bottom, h: bar.height, inner: innerHeight };
  }, ALL_IDS);

/** Writes the words as the bar would show them and returns the bar's height. */
const heightWith = (page: Page, state: string, help: string | null) =>
  page.evaluate(
    ({ state, help }) => {
      const p = document.querySelector<HTMLElement>('[data-testid="click-state"]')!;
      p.className = "text-xs text-text-dim";
      p.textContent = state;
      const h = document.querySelector<HTMLElement>('[data-testid="click-help"]');
      if (h && help !== null) h.textContent = help;
      return document.querySelector('[data-testid="click-bar"]')!.getBoundingClientRect().height;
    },
    { state, help },
  );

const close = (a: number[] | null, b: number[] | null) => !a || !b || a.every((v, i) => Math.abs(v - b[i]) <= 0.5);

for (const width of [375, 412, 768, 1024, 1280, 1440]) {
  test(`bar holds its height and its controls for every message at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const { playUrl } = await seed(page, cols("8", "8", "8", "8", "|", "8", "8", "8", "8"), { bpm: 120 });
    await page.goto(playUrl);
    await expect(page.getByTestId("click-bar")).toBeVisible();
    await page.waitForTimeout(300);
    const bad: string[] = [];

    const rest = await allBoxes(page);
    if (rest.inner - rest.bottom > 1) bad.push(`bar bottom ${rest.bottom} is ${rest.inner - rest.bottom}px above the foot`);
    for (const words of IDLE) {
      const h = await heightWith(page, words, null);
      if (Math.abs(h - rest.h) > 0.5) bad.push(`idle "${words}": ${h} vs rest ${rest.h}`);
    }
    await page.goto(playUrl);
    await expect(page.getByTestId("click-bar")).toBeVisible();
    await page.waitForTimeout(300);
    const rest2 = await allBoxes(page);

    // Cluster open, at rest: Start and More hold; the bottom holds.
    await page.getByTestId("panel-play-cluster").click();
    const open = await allBoxes(page);
    for (const id of ["click-start", "tempo-control", "panel-play-cluster"]) {
      if (!close(rest2.out[id], open.out[id])) bad.push(`cluster open moves ${id}: ${rest2.out[id]} -> ${open.out[id]}`);
    }
    if (Math.abs(open.bottom - rest2.bottom) > 0.5) bad.push(`cluster open moves the bar bottom`);
    await page.getByTestId("panel-play-cluster").click();

    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-stop")).toBeVisible();
    const running = await allBoxes(page);
    if (Math.abs(running.h - rest2.h) > 0.5) bad.push(`running ${running.h} vs rest ${rest2.h}`);
    if (!close(rest2.out["click-start"], running.out["click-beat"])) bad.push(`beat box ${running.out["click-beat"]} is not where Start was ${rest2.out["click-start"]}`);
    for (const id of ["tempo-control", "panel-play-cluster"]) {
      if (!close(rest2.out[id], running.out[id])) bad.push(`start moves ${id}: ${rest2.out[id]} -> ${running.out[id]}`);
    }
    // Cluster open while running.
    await page.getByTestId("panel-play-cluster").click();
    const runOpen = await allBoxes(page);
    for (const id of ["click-beat", "click-stop", "tempo-control", "panel-play-cluster"]) {
      if (!close(running.out[id], runOpen.out[id])) bad.push(`cluster open (running) moves ${id}`);
    }
    await page.getByTestId("panel-play-cluster").click();
    for (const words of RUNNING) {
      for (const help of HELP) {
        const h = await heightWith(page, words, help);
        if (Math.abs(h - rest2.h) > 0.5) bad.push(`running "${words}" + "${help}": ${h} vs rest ${rest2.h}`);
      }
    }
    await page.getByTestId("click-stop").click();
    await expect(page.getByTestId("click-start")).toBeVisible();
    const stopped = await allBoxes(page);
    if (Math.abs(stopped.h - rest2.h) > 0.5) bad.push(`stopped ${stopped.h} vs rest ${rest2.h}`);
    for (const id of ["click-start", "tempo-control", "panel-play-cluster"]) {
      if (!close(rest2.out[id], stopped.out[id])) bad.push(`stop moves ${id}`);
    }
    console.log(`bar ${width} rest ${rest2.h}`);
    expect(bad).toEqual([]);
  });
}

/** The plan's edge case "a song with no arrangement" (INV-011, the bar on *none*): the empty state, bar at the foot. */
for (const width of [375, 1280]) {
  test(`a song with no arrangement keeps the bar at the foot at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const { playUrl } = await seedWideSong(page, "none");
    await page.goto(playUrl);
    await expect(page.getByText("No arrangement yet")).toBeVisible();
    await expect(page.getByTestId("click-bar")).toBeVisible();
    const b = await allBoxes(page);
    expect(b.inner - b.bottom).toBeLessThanOrEqual(1);
  });
}
