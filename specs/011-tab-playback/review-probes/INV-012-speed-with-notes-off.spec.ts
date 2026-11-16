/**
 * INV-012 over its {Notes off, Notes on} member, and FR-036 / US3 AS-7: "Given speed in use with Notes off, When the
 * click runs alone, Then it runs at the reduced speed too. One clock serves both." contracts/transport.md §4 shows
 * `play-slower`, `play-speed` and `play-faster` "always with playback", and FR-039 shows the reduced speed on the bar.
 *
 * Song at 160 bpm, speed set to 50%, Notes then switched off: the count-in must be 0.75 s apart (160 x 50% = 80 bpm),
 * the speed control must still be offered, and the bar must still show the reduced speed.
 */
import { expect, test } from "@playwright/test";
import { openCluster } from "../../../e2e/usability-helpers";
import { setStoredTempo } from "../../../e2e/rhythm-probe-helpers";
import { clickStarts, installPlayRecorder, playRecord, seedPlaybackSong } from "../../../e2e/play-helpers";

test("speed 50% with Notes off: the click alone runs at 80 bpm, and the speed stays offered and shown", async ({ page }) => {
  await installPlayRecorder(page);
  const s = await seedPlaybackSong(page);
  await setStoredTempo(page, 160);
  await page.goto(s.playUrl);
  await openCluster(page);
  const offeredBeforeNotes = await page.getByTestId("play-slower").count();
  // The only route the UI gives to the speed today is through Notes on.
  await page.getByTestId("play-notes").click();
  for (let i = 0; i < 10; i++) await page.getByTestId("play-slower").click();
  await expect(page.getByTestId("play-speed")).toContainText("50%");
  await page.getByTestId("play-notes").click();
  await expect(page.getByTestId("click-start")).toHaveText("Start click");
  const offeredWithNotesOff = await page.getByTestId("play-slower").count();
  const markWithNotesOff = await page.getByTestId("speed-mark").count();
  await page.getByTestId("click-start").click();
  await expect.poll(async () => clickStarts(await playRecord(page)).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(4);
  const starts = clickStarts(await playRecord(page)).map((c) => c.when);
  const gap = Number((starts[1] - starts[0]).toFixed(4));
  await page.getByTestId("click-stop").click();
  expect({ offeredBeforeNotes, offeredWithNotesOff, markWithNotesOff, countInGapSeconds: gap }).toEqual({
    offeredBeforeNotes: 1,
    offeredWithNotesOff: 1,
    markWithNotesOff: 1,
    countInGapSeconds: 0.75,
  });
});
