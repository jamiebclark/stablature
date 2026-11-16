/** Spec 011 INV-025: 50 open/play/stop/back/reopen cycles each hold one context, close it, and release the wake lock. */
import { expect, test } from "@playwright/test";
import { clickStarts, installPlayRecorder, noteStarts, playRecord, recordedAudio, seedPlaybackSong } from "./play-helpers";

for (const scope of ["part", "song"] as const) {
  test(`INV-025 50 cycles of ${scope} playback`, async ({ page }) => {
    test.setTimeout(300_000);
    await installPlayRecorder(page);
    const s = await seedPlaybackSong(page);
    const url = scope === "part" ? `${s.songUrl}/play/${s.parts.t}` : s.playUrl;
    for (let i = 1; i <= 50; i++) {
      await page.goto(s.songUrl);
      await page.goto(url);
      await expect(page.getByTestId("click-start")).toBeEnabled();
      await page.getByTestId("click-start").click();
      await expect(page.getByTestId("click-stop")).toBeVisible();
      await page.getByTestId("click-stop").click();
      await expect(page.getByTestId("click-start")).toBeVisible();
      await page.goBack();
    }
    // Each goto is a fresh document, so the recorder restarts: the last cycle stands for the page's own account.
    const rec = await recordedAudio(page);
    expect(rec.closes).toBe(rec.contexts.length);
    expect(rec.wakeReleases).toBe(rec.wakeRequests);
    await page.goto(url);
    await page.getByTestId("click-start").click();
    await page.waitForTimeout(2500);
    // Notes are off by default for a whole song, so its count-in is a click.
    const rec2 = await playRecord(page);
    expect((scope === "part" ? noteStarts(rec2) : clickStarts(rec2)).length, "the count-in sounds").toBeGreaterThan(0);
    await expect(page.getByTestId("click-state")).toHaveText(/Counting in\.|Playing\.|Following|Plain/);
  });
}
