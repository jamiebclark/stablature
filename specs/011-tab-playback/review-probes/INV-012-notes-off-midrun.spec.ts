/**
 * Round 2. INV-012's {Notes off} member past the count-in, which review F1's fix made reachable: FR-036 ("with Notes
 * on or off") and FR-038 ("Changing speed, or the stored tempo changing, while running MUST apply from the next note
 * or click not yet queued, with no restart and no count-in").
 *
 * Whole song, Notes off (fresh storage), stored 160 bpm. Speed 50% from the Notes-off cluster, Start click: the
 * count-in is 0.75 s apart. Mid-run: speed 100% -> 0.375 s; stored tempo 120 (a sync landing) -> 0.5 s; speed 50% ->
 * 1.0 s. One context throughout, and the words never go back to "Counting in.".
 */
import { expect, test, type Page } from "@playwright/test";
import { openCluster } from "../../../e2e/usability-helpers";
import { landed } from "../../../e2e/reading-helpers";
import { setStoredTempo } from "../../../e2e/rhythm-probe-helpers";
import { clickStarts, installPlayRecorder, playRecord, recordedAudio, seedPlaybackSong } from "../../../e2e/play-helpers";

const read = async (page: Page) => parseInt((await page.getByTestId("play-speed").textContent()) ?? "100", 10);
async function speedTo(page: Page, target: number) {
  for (let guard = 0; guard < 12 && (await read(page)) !== target; guard++)
    await page.getByTestId((await read(page)) > target ? "play-slower" : "play-faster").click();
  expect(await read(page)).toBe(target);
}
/** Waits for `more` new clicks, then returns the last gap. */
async function nextGap(page: Page, more: number) {
  const seen = clickStarts(await playRecord(page)).length;
  await expect.poll(async () => clickStarts(await playRecord(page)).length, { timeout: 20_000 }).toBeGreaterThanOrEqual(seen + more);
  const all = clickStarts(await playRecord(page)).map((c) => c.when);
  return Number((all[all.length - 1] - all[all.length - 2]).toFixed(4));
}

test("Notes off: speed and stored tempo changed mid-run apply x speed, with no new count-in", async ({ page }) => {
  test.setTimeout(90_000);
  await installPlayRecorder(page);
  const s = await seedPlaybackSong(page);
  await setStoredTempo(page, 160);
  await page.goto(s.playUrl);
  await openCluster(page);
  await expect(page.getByTestId("play-notes")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("click-start")).toHaveText("Start click");
  await speedTo(page, 50);
  await expect(page.getByTestId("play-speed")).toHaveText("50% · 80 bpm");
  await page.getByTestId("click-start").click();
  await expect.poll(async () => clickStarts(await playRecord(page)).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(4);
  const countIn = clickStarts(await playRecord(page)).slice(0, 4).map((c) => c.when);
  const countInGaps = countIn.slice(1).map((t, i) => Number((t - countIn[i]).toFixed(4)));
  await expect(page.getByTestId("click-state")).not.toHaveText("Counting in.", { timeout: 10_000 });

  await speedTo(page, 100);
  const at100 = await nextGap(page, 4);
  // Written as a sync would land it: the row, then the broadcast that makes every live query read again.
  await setStoredTempo(page, 120);
  await landed(page);
  await expect(page.getByTestId("tempo-control")).toContainText("120 bpm");
  const tempo120 = await nextGap(page, 4);
  await speedTo(page, 50);
  const tempo120at50 = await nextGap(page, 3);
  const words = await page.getByTestId("click-state").textContent();
  const contexts = (await recordedAudio(page)).contexts.length;
  await page.getByTestId("click-stop").click();
  expect({ countInGaps, at100, tempo120, tempo120at50, countingAgain: words === "Counting in.", contexts }).toEqual({
    countInGaps: [0.75, 0.75, 0.75],
    at100: 0.375,
    tempo120: 0.5,
    tempo120at50: 1,
    countingAgain: false,
    contexts: 1,
  });
});
