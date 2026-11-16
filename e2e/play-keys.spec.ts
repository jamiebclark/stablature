/** Spec 011 INV-022: Space and r with Notes on and off, idle and running. */
import { expect, test, type Page } from "@playwright/test";
import { openCluster } from "./usability-helpers";
import { installPlayRecorder, noteStarts, playRecord, recordedAudio, seedPlaybackSong, clickStarts } from "./play-helpers";

async function ready(page: Page, notes: boolean) {
  await installPlayRecorder(page);
  const seeded = await seedPlaybackSong(page);
  await page.goto(seeded.playUrl);
  await expect(page.getByTestId("click-start")).toBeEnabled();
  if (notes) {
    await openCluster(page);
    await page.getByTestId("play-notes").click();
    await expect(page.getByTestId("click-start")).toHaveText("Play");
  }
  await page.locator("body").click({ position: { x: 5, y: 5 } });
}

test("Notes on: Space starts and stops, r restarts with one context", async ({ page }) => {
  await ready(page, true);
  await page.keyboard.press("Space");
  await expect(page.getByTestId("click-state")).toHaveText("Counting in.");
  await expect.poll(async () => noteStarts(await playRecord(page)).length, { timeout: 8000 }).toBeGreaterThan(0);
  await page.keyboard.press("r");
  await expect(page.getByTestId("click-state")).toHaveText("Counting in.");
  expect((await recordedAudio(page)).contexts.length).toBeLessThanOrEqual(2);
  await page.keyboard.press("Space");
  await expect(page.getByTestId("click-start")).toBeVisible();
  await page.keyboard.press("r");
  await expect(page.getByTestId("click-stop")).toBeVisible();
});

test("Notes off: today's behaviour", async ({ page }) => {
  await ready(page, false);
  await page.keyboard.press("Space");
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await page.waitForTimeout(2500);
  expect(noteStarts(await playRecord(page))).toEqual([]);
  await page.keyboard.press("Space");
  await expect(page.getByTestId("click-start")).toHaveText("Start click");
});

test("the help overlay's Space row reads both modes", async ({ page }) => {
  await ready(page, false);
  await page.keyboard.press("?");
  await expect(page.getByText("Start or stop the click, or the notes when Notes is on")).toBeVisible();
});

test("part scope: Space starts and stops, r restarts with a fresh count-in", async ({ page }) => {
  await installPlayRecorder(page);
  const s = await seedPlaybackSong(page);
  await page.goto(`${s.songUrl}/play/${s.parts.t}`);
  await expect(page.getByTestId("click-start")).toHaveText("Play");
  await expect(page.getByTestId("click-start")).toBeEnabled();
  await page.locator("body").click({ position: { x: 5, y: 200 } });
  await page.keyboard.press("Space");
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await expect.poll(async () => noteStarts(await playRecord(page)).length, { timeout: 10_000 }).toBeGreaterThan(0);
  await page.keyboard.press("Space");
  await expect(page.getByTestId("click-start")).toBeVisible();
  // A notes run lets its context go 40 ms after the stop, once the fade is done (src/lib/rhythm/audio.ts close()).
  await page.waitForTimeout(100);
  const afterSpace = await recordedAudio(page);

  await page.keyboard.press("Space");
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await page.waitForTimeout(2600);
  const clicksBefore = clickStarts(await playRecord(page)).length;
  await page.keyboard.press("r");
  await expect(page.getByTestId("click-state")).toHaveText("Counting in.");
  await expect.poll(async () => clickStarts(await playRecord(page)).length, { timeout: 10_000 }).toBeGreaterThanOrEqual(clicksBefore + 4);
  await page.keyboard.press("Space");
  await page.waitForTimeout(150);
  const end = await recordedAudio(page);
  expect({
    spaceStartedAndStopped: afterSpace.contexts.length === 1 && afterSpace.closes === 1,
    contextsAfterRestart: end.contexts.length,
    allClosed: end.closes === end.contexts.length,
  }).toEqual({ spaceStartedAndStopped: true, contextsAfterRestart: 3, allClosed: true });
});
