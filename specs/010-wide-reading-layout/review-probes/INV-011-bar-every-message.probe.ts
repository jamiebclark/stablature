/**
 * INV-011 (review round 1), over its enumeration: **BarSt** × **Bw** × **Ptr** × **Clu** on a one-pass song.
 *
 * Every state's words come from `CLICK_WORDS`; the bar's height must not depend on which is shown. Each idle message
 * is written into `click-state` at rest (Start in the lead slot) and each running pair into `click-state` and
 * `click-help` while running (beat box and Stop in the lead slot), so every message is measured at the lead width it
 * really shows at. Start/beat, Stop, tempo and More hold still across start, stop and the cluster; the bar's bottom
 * is the screen's foot.
 */
import { expect, test, type Page } from "@playwright/test";
import { cols, seed } from "../../../e2e/rhythm-probe-helpers";
import { seedWideSong } from "../../../e2e/wide-helpers";

test.setTimeout(240_000);

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
const IDS = ["click-start", "click-beat", "click-stop", "tempo-control", "panel-play-cluster"];

const boxes = (page: Page) =>
  page.evaluate((ids) => {
    const out: Record<string, number[] | null> = {};
    for (const id of ids) {
      const r = document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect();
      out[id] = r ? [r.x, r.y, r.width, r.height] : null;
    }
    const bar = document.querySelector('[data-testid="click-bar"]')!.getBoundingClientRect();
    return { out, top: bar.top, bottom: bar.bottom, h: bar.height, inner: innerHeight };
  }, IDS);

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

    const rest = await boxes(page);
    if (rest.inner - rest.bottom > 1) bad.push(`bar bottom ${rest.bottom} is ${rest.inner - rest.bottom}px above the foot`);
    for (const words of IDLE) {
      const h = await heightWith(page, words, null);
      if (Math.abs(h - rest.h) > 0.5) bad.push(`idle "${words}": ${h} vs rest ${rest.h}`);
    }
    await page.goto(playUrl);
    await expect(page.getByTestId("click-bar")).toBeVisible();
    await page.waitForTimeout(300);
    const rest2 = await boxes(page);

    // Cluster open, at rest: Start and More hold; the bottom holds.
    await page.getByTestId("panel-play-cluster").click();
    const open = await boxes(page);
    for (const id of ["click-start", "tempo-control", "panel-play-cluster"]) {
      if (!close(rest2.out[id], open.out[id])) bad.push(`cluster open moves ${id}: ${rest2.out[id]} -> ${open.out[id]}`);
    }
    if (Math.abs(open.bottom - rest2.bottom) > 0.5) bad.push(`cluster open moves the bar bottom`);
    await page.getByTestId("panel-play-cluster").click();

    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-stop")).toBeVisible();
    const running = await boxes(page);
    if (Math.abs(running.h - rest2.h) > 0.5) bad.push(`running ${running.h} vs rest ${rest2.h}`);
    if (!close(rest2.out["click-start"], running.out["click-beat"])) bad.push(`beat box ${running.out["click-beat"]} is not where Start was ${rest2.out["click-start"]}`);
    for (const id of ["tempo-control", "panel-play-cluster"]) {
      if (!close(rest2.out[id], running.out[id])) bad.push(`start moves ${id}: ${rest2.out[id]} -> ${running.out[id]}`);
    }
    // Cluster open while running.
    await page.getByTestId("panel-play-cluster").click();
    const runOpen = await boxes(page);
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
    const stopped = await boxes(page);
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
    const b = await boxes(page);
    expect(b.inner - b.bottom).toBeLessThanOrEqual(1);
  });
}
