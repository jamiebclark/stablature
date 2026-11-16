/** Spec 011 INV-004 (e2e): with Notes, Click and following on, a note and a click at one tick start together. */
import { expect, test } from "@playwright/test";
import { openCluster } from "./usability-helpers";
import { clickStarts, installPlayRecorder, noteStarts, playRecord, seedPlaybackSong } from "./play-helpers";

test("every note start lands exactly on a click start where the ticks agree", async ({ page }) => {
  await installPlayRecorder(page);
  const s = await seedPlaybackSong(page);
  await page.goto(s.playUrl);
  await openCluster(page);
  await page.getByTestId("play-notes").click();
  await expect(page.getByTestId("play-click")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("click-start").click();
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await page.waitForTimeout(6000);
  const rec = await playRecord(page);
  const notes = noteStarts(rec);
  const clicks = clickStarts(rec).map((c) => c.when);
  expect(notes.length).toBeGreaterThan(0);
  // Notes on a beat share the click's clock exactly; off-beat notes have no click to match.
  expect(notes.filter((n) => clicks.some((c) => Math.abs(c - n.when) <= 1e-9)).length).toBeGreaterThan(0);
  for (const n of notes) {
    for (const c of clicks.filter((c) => Math.abs(c - n.when) < 1e-4)) expect(Math.abs(c - n.when)).toBeLessThanOrEqual(1e-9);
  }
});
