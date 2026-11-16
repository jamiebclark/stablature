/**
 * Spec 011 INV-001 (e2e): with Notes off the bar, the click and its words are today's. A regression oracle on the
 * whole-song play view, which passes before the change by design.
 */
import { expect, test } from "@playwright/test";
import { installPlayRecorder, noteStarts, playRecord, recordedAudio, seedPlaybackSong } from "./play-helpers";

test("whole song, Notes off: the click alone, with today's words", async ({ page }) => {
  await installPlayRecorder(page);
  const seeded = await seedPlaybackSong(page);
  await page.goto(seeded.playUrl);
  const start = page.getByTestId("click-start");
  await expect(start).toHaveText("Start click");
  await expect(start).toBeEnabled();
  await expect(page.getByTestId("click-state")).toHaveText(/^Click (follows the notation|is a plain beat)\./);
  await start.click();
  await expect(page.getByTestId("click-state")).toHaveText("Counting in.");
  await page.waitForTimeout(2500);
  const rec = await recordedAudio(page);
  expect(rec.contexts.length).toBe(1);
  expect(rec.starts.length).toBeGreaterThan(4);
  expect(noteStarts(await playRecord(page))).toEqual([]);
  await expect(page.getByTestId("click-state")).toHaveText(/^(Following the notation|Plain beat)\.$/);
  await page.getByTestId("click-stop").click();
  await expect(start).toHaveText("Start click");
  await expect(page.getByTestId("click-state")).toHaveText(/^Click /);
});
