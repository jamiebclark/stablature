/** Spec 011 INV-011: playing and its controls write nothing to the song; only `stablature.play` is added. */
import { expect, test } from "@playwright/test";
import { openCluster } from "./usability-helpers";
import { dumpDb } from "./click-helpers";
import { installPlayRecorder, seedPlaybackSong } from "./play-helpers";

test("three runs, eleven speed changes and every toggle write nothing", async ({ page }) => {
  await installPlayRecorder(page);
  const s = await seedPlaybackSong(page);
  await page.goto(s.playUrl);
  await expect(page.getByTestId("click-start")).toBeEnabled();
  const before = await dumpDb(page);
  const keysBefore = await page.evaluate(() => Object.keys(localStorage).sort());

  await openCluster(page);
  await page.getByTestId("play-notes").click();
  for (let run = 0; run < 3; run++) {
    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-stop")).toBeVisible();
    await page.getByTestId("click-stop").click();
    await expect(page.getByTestId("click-start")).toBeVisible();
  }
  for (let i = 0; i < 11; i++) await page.getByTestId(i % 2 ? "play-faster" : "play-slower").click();
  await page.getByTestId("play-click").click();
  await page.getByTestId("play-loop").click();

  expect(await dumpDb(page)).toBe(before);
  const added = (await page.evaluate(() => Object.keys(localStorage).sort())).filter((k) => !keysBefore.includes(k));
  expect(added.every((k) => k === "stablature.play")).toBe(true);

  await page.reload();
  await openCluster(page);
  await expect(page.getByTestId("play-notes")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("play-speed")).toHaveText("100%");
});
