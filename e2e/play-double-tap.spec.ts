/** Spec 011 INV-015: two quick taps on Play give one context, one count-in, one run. */
import { expect, test } from "@playwright/test";
import { installPlayRecorder, recordedAudio, seedPlaybackSong } from "./play-helpers";

test("two taps 30 ms apart on Play start one run", async ({ page }) => {
  await installPlayRecorder(page);
  const seeded = await seedPlaybackSong(page);
  await page.goto(`${seeded.songUrl}/play/${seeded.parts.t}`);
  const start = page.getByTestId("click-start");
  await expect(start).toBeEnabled();
  const box = (await start.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.click(x, y);
  await page.waitForTimeout(30);
  await page.mouse.click(x, y);
  await page.waitForTimeout(150);
  expect((await recordedAudio(page)).contexts.length).toBe(1);
  await expect(page.getByTestId("click-stop")).toHaveCount(1);
  await expect(page.getByTestId("click-start")).toHaveCount(0);
});
