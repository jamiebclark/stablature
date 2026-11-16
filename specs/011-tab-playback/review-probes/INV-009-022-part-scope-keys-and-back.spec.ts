/**
 * Round 2. Two members round 1 left "not run":
 *   - INV-022 over Sc = part: Space starts (count-in, then `custom` sources) and Space stops; `r` while running restarts
 *     with a fresh count-in and no second context left open.
 *   - INV-009 Stop = browser back: reached by the card menu's Play (client navigation), started, then history back.
 *     Every source stopped by t + 0.05 or the context closed, and the view is the song page.
 */
import { expect, test } from "@playwright/test";
import {
  clickStarts,
  installPlayRecorder,
  noteStarts,
  playRecord,
  recordedAudio,
  seedPlaybackSong,
} from "../../../e2e/play-helpers";

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

test("part scope: browser back from a running part leaves nothing sounding", async ({ page }) => {
  await installPlayRecorder(page);
  const s = await seedPlaybackSong(page);
  await page.goto(s.songUrl);
  await page.getByRole("button", { name: /^Actions for part T/ }).click();
  await page.getByRole("menuitem", { name: /^Play part T/ }).click();
  await expect(page).toHaveURL(new RegExp(`/play/${s.parts.t}$`));
  await expect(page.getByTestId("click-start")).toBeEnabled();
  await page.getByTestId("click-start").click();
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await page.waitForTimeout(2700);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/songs/${s.songId}$`));
  await page.waitForTimeout(60);
  const t = await page.evaluate(() => (window as unknown as { __ctxs: AudioContext[] }).__ctxs.at(-1)!.currentTime);
  await page.waitForTimeout(40);
  const rec = await recordedAudio(page);
  const late = rec.stops.filter((x) => x.when !== null && x.when > t + 0.05).length;
  expect({ contexts: rec.contexts.length, closed: rec.closes, ok: rec.closes > 0 || late === 0 }).toEqual({
    contexts: 1,
    closed: 1,
    ok: true,
  });
});
