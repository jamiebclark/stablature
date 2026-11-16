/**
 * Spec 011 US4 (INV-010, INV-006): with Notes on, the reading-position outline follows the column sounding, in
 * document order, and leaves at the stop; with Notes off it is today's click outline.
 */
import { expect, test, type Page } from "@playwright/test";
import { installPlayRecorder, seedPlaybackSong, noteStarts, playRecord } from "./play-helpers";
import { setStoredTempo } from "./rhythm-probe-helpers";
import { openCluster } from "./usability-helpers";

const watch = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __hl: { card: string | null; key: string | null }[] };
    w.__hl = [];
    const read = () => {
      const el = document.querySelector(".tab-column-reading");
      return { card: el?.closest("[data-card]")?.getAttribute("data-card") ?? null, key: el?.getAttribute("data-column") ?? null };
    };
    let last = read();
    new MutationObserver(() => {
      const now = read();
      if (now.key !== last.key || now.card !== last.card) w.__hl.push((last = now));
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"], childList: true });
  });

const log = (page: Page) =>
  page.evaluate(() => (window as unknown as { __hl: { card: string | null; key: string | null }[] }).__hl);

test("part playback (notes always on): the outline walks the drawn columns in document order and leaves at the stop", async ({ page }) => {
  await installPlayRecorder(page);
  const seeded = await seedPlaybackSong(page);
  await page.goto(`${seeded.songUrl}/play/${seeded.parts.t}`);
  await expect(page.getByTestId("click-start")).toBeEnabled();
  const drawn = await page.locator("[data-card] [data-column]").evaluateAll((els) => [
    ...new Set(els.map((e) => e.getAttribute("data-column")!)),
  ]);
  await watch(page);
  await page.getByTestId("click-start").click();
  await expect(page.locator(".tab-column-reading")).toHaveCount(1);
  await page.waitForTimeout(6000);
  const seen = (await log(page)).filter((e) => e.key !== null);
  expect(seen.length).toBeGreaterThan(5);
  const at = seen.map((e) => drawn.indexOf(e.key!));
  expect(at.every((i) => i >= 0)).toBe(true);
  // Each step moves forward through the page (a wrap is only the loop's return).
  for (let i = 1; i < at.length; i++) expect(at[i] > at[i - 1] || at[i] <= at[0]).toBe(true);
  expect(new Set(seen.map((e) => e.card)).size).toBe(1);
  await page.getByTestId("click-stop").click();
  await expect(page.locator(".tab-column-reading")).toHaveCount(0);
  const after = (await log(page)).length;
  await page.waitForTimeout(500);
  expect((await log(page)).length).toBe(after);
});

test("with Notes off the outline is the click's own", async ({ page }) => {
  await installPlayRecorder(page);
  const seeded = await seedPlaybackSong(page);
  await page.goto(`${seeded.songUrl}/play/${seeded.parts.t}`);
  await expect(page.getByTestId("click-start")).toBeEnabled();
  await watch(page);
  await page.getByTestId("click-start").click();
  await expect(page.locator(".tab-column-reading")).toHaveCount(1, { timeout: 15_000 });
  await page.getByTestId("click-stop").click();
  await expect(page.locator(".tab-column-reading")).toHaveCount(0);
});

test("variant part playback: the outline walks exactly the variant's drawn columns", async ({ page }) => {
  test.setTimeout(90_000);
  await installPlayRecorder(page);
  const s = await seedPlaybackSong(page);
  await setStoredTempo(page, 600);
  await page.goto(`${s.songUrl}/play/${s.parts.a2}`);
  await expect(page.getByTestId("part-playback")).toContainText("Part A'");
  await expect(page.getByTestId("click-start")).toHaveText("Play");
  await openCluster(page);
  if ((await page.getByTestId("play-loop").getAttribute("aria-pressed")) === "true") await page.getByTestId("play-loop").click();
  await expect(page.getByTestId("play-loop")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("panel-play-cluster").click();

  const expected = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("li[data-card]")];
    return {
      cards: cards.length,
      keys: cards.flatMap((li) =>
        [...li.querySelectorAll('[data-column]:not([data-barline="true"])')].map((c) => c.getAttribute("data-column")!),
      ),
    };
  });
  await page.evaluate(() => {
    const w = window as unknown as { __keys: string[] };
    w.__keys = [];
    let last = "";
    new MutationObserver(() => {
      const key = document.querySelector(".tab-column-reading")?.getAttribute("data-column") ?? "";
      if (key && key !== last) w.__keys.push(key);
      last = key;
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
  });
  await page.getByTestId("click-start").click();
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await expect(page.getByTestId("click-start")).toBeVisible({ timeout: 60_000 });
  const keys = await page.evaluate(() => (window as unknown as { __keys: string[] }).__keys);
  const notes = noteStarts(await playRecord(page)).length;
  expect(expected.cards).toBe(1);
  expect(expected.keys.length).toBeGreaterThan(4);
  expect(keys).toEqual(expected.keys);
  expect(notes, "a note sounded for each column").toBeGreaterThanOrEqual(expected.keys.length);
  await expect(page.locator(".tab-column-reading")).toHaveCount(0);
});
