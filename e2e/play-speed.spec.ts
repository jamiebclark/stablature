/** Spec 011 INV-012: the count-in, notes and click run at stored tempo x speed, and speed is never stored. */
import { expect, test, type Page } from "@playwright/test";
import { openCluster } from "./usability-helpers";
import { dumpDb } from "./click-helpers";
import { setStoredTempo } from "./rhythm-probe-helpers";
import { clickStarts, installPlayRecorder, playRecord, seedPlaybackSong, recordedAudio } from "./play-helpers";
import { landed } from "./reading-helpers";

const gaps = (xs: { when: number }[]) => xs.slice(1).map((x, i) => x.when - xs[i].when);
const setSpeedTo = async (page: Page, target: number) => {
  const read = async () => parseInt((await page.getByTestId("play-speed").textContent()) ?? "100", 10);
  for (let guard = 0; guard < 12 && (await read()) !== target; guard++)
    await page.getByTestId((await read()) > target ? "play-slower" : "play-faster").click();
  expect(await read()).toBe(target);
};

async function ready(page: Page) {
  await installPlayRecorder(page);
  const seeded = await seedPlaybackSong(page);
  await setStoredTempo(page, 160);
  await page.goto(seeded.playUrl);
  await openCluster(page);
  await page.getByTestId("play-notes").click();
  return seeded;
}

test("count-in at 160 bpm x 50% is 0.75 s apart; 100% mid-run halves the next interval without a new count-in", async ({
  page,
}) => {
  await ready(page);
  const before = await dumpDb(page);
  await setSpeedTo(page, 50);
  await expect(page.getByTestId("play-speed")).toContainText("80 bpm");
  await expect(page.getByTestId("speed-mark")).toHaveText("50%");
  await page.getByTestId("click-start").click();
  await expect.poll(async () => clickStarts(await playRecord(page)).length, { timeout: 15000 }).toBeGreaterThanOrEqual(4);
  const counted = clickStarts(await playRecord(page));
  for (const g of gaps(counted).slice(0, 3)) expect(Math.abs(g - 0.75)).toBeLessThan(0.001);

  await setSpeedTo(page, 100);
  const seen = counted.length;
  await expect
    .poll(async () => clickStarts(await playRecord(page)).length, { timeout: 15000 })
    .toBeGreaterThanOrEqual(seen + 3);
  const all = clickStarts(await playRecord(page));
  // The last gap after the change is the new spacing, and no second count-in began.
  const tail = gaps(all).slice(-1)[0];
  expect(Math.abs(tail - 0.375)).toBeLessThan(0.001);
  await page.getByTestId("click-stop").click();
  expect(await dumpDb(page)).toBe(before);
});

test("speed is per song and memory only: a reload reads 100%", async ({ page }) => {
  const s = await ready(page);
  await setSpeedTo(page, 70);
  await expect(page.getByTestId("speed-mark")).toHaveText("70%");
  await page.reload();
  await openCluster(page);
  await expect(page.getByTestId("play-speed")).toHaveText("100%");
  await expect(page.getByTestId("speed-mark")).toHaveCount(0);
  expect(s.playUrl).toBeTruthy();
});

test("speed 50% with Notes off: the click alone runs at 80 bpm, and the speed stays offered and shown", async ({ page }) => {
  await ready(page);
  await setSpeedTo(page, 50);
  await page.getByTestId("play-notes").click();
  await expect(page.getByTestId("click-start")).toHaveText("Start click");
  const offeredWithNotesOff = await page.getByTestId("play-slower").count();
  const markWithNotesOff = await page.getByTestId("speed-mark").count();
  await page.getByTestId("click-start").click();
  await expect.poll(async () => clickStarts(await playRecord(page)).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(4);
  const starts = clickStarts(await playRecord(page)).map((c) => c.when);
  const gap = Number((starts[1] - starts[0]).toFixed(4));
  await page.getByTestId("click-stop").click();
  expect({ offeredWithNotesOff, markWithNotesOff, countInGapSeconds: gap }).toEqual({
    offeredWithNotesOff: 1,
    markWithNotesOff: 1,
    countInGapSeconds: 0.75,
  });
});

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
