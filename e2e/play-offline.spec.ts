/** Spec 011 INV-016: once the page is in, a full run of part or arrangement playback makes no request. */
import { expect, test } from "@playwright/test";
import { openCluster } from "./usability-helpers";
import { installPlayRecorder, markRequests, noteStarts, playRecord, seedPlaybackSong } from "./play-helpers";

for (const scope of ["part", "song"] as const) {
  test(`INV-016 ${scope} playback offline makes no request and plays`, async ({ page, context }) => {
    await installPlayRecorder(page);
    const s = await seedPlaybackSong(page);
    await page.goto(scope === "part" ? `${s.songUrl}/play/${s.parts.t}` : s.playUrl);
    await expect(page.getByTestId("click-start")).toBeEnabled();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    if (scope === "song") {
      await openCluster(page);
      await page.getByTestId("play-notes").click();
    }
    await context.setOffline(true);
    await markRequests(page);
    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-stop")).toBeVisible();
    await page.waitForTimeout(4000);
    await page.getByTestId("click-stop").click();
    // Read while still offline: the reconnect's own fetches are not the run's.
    const rec = await playRecord(page);
    await context.setOffline(false);
    expect(rec.requests).toEqual([]);
    expect(noteStarts(rec).length).toBeGreaterThan(0);
  });
}
