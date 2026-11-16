/**
 * Round 2. INV-018's e2e F0 member, not run in round 1 and not in `e2e/play-mix.spec.ts` (which measures part T on four
 * strings): "During F0 on `bass5-drop-f`, analyser energy above 200 Hz is >= 0.45 of the total."
 *
 * A part of F0 notes (string 4 open on Drop F), 120 bpm, part playback with Click off so only the notes are measured
 * after the count-in. The destination analyser's spectrum is read ten times, 100 ms apart, from 0.6 s after the count-in.
 */
import { expect, test } from "@playwright/test";
import { analyse, installPlayRecorder, textToCols } from "../../../e2e/play-helpers";
import { seedSong } from "../../../e2e/reading-helpers";
import { setStoredTempo } from "../../../e2e/rhythm-probe-helpers";
import { openCluster } from "../../../e2e/usability-helpers";

test("F0 on Drop F keeps at least 0.45 of the measured energy above 200 Hz", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "measured once, on desktop");
  test.setTimeout(90_000);
  await installPlayRecorder(page);
  const s = await seedSong(page, [{ key: "f", label: "F", columns: textToCols("4:0 4:0 4:0 4:0 | 4:0 4:0 4:0 4:0 |") }], [
    { part: "f" },
  ]);
  await setStoredTempo(page, 120);
  await page.goto(s.songUrl);
  await page.getByRole("link", { name: "Band" }).first().click();
  await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);
  await page.goto(`${page.url()}/tunings`);
  await page.getByRole("button", { name: "Bass 5", exact: true }).click();
  await page.getByRole("button", { name: "Add Drop F" }).first().click();
  await page.waitForTimeout(300);
  await page.goto(s.songUrl);
  const tools = page.getByTestId("panel-song-tools");
  if ((await tools.getAttribute("aria-expanded")) !== "true") await tools.click();
  const select = page.locator("select").first();
  const value = await select.evaluate(
    (el) => [...(el as HTMLSelectElement).options].find((o) => o.textContent === "Drop F (Bass 5)")?.value ?? "",
  );
  expect(value, "a Drop F tuning to choose").not.toBe("");
  await select.selectOption(value);
  await page.waitForTimeout(300);

  await page.goto(`${s.songUrl}/play/${s.parts.f}`);
  await expect(page.getByTestId("click-start")).toBeEnabled();
  await openCluster(page);
  await page.getByTestId("play-click").click();
  await expect(page.getByTestId("play-click")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("click-start").click();
  await page.waitForTimeout(2_600);
  const shares: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = await analyse(page, 200);
    if (a && a.peak > 0.001) shares.push(Number(a.above.toFixed(3)));
    await page.waitForTimeout(100);
  }
  await page.getByTestId("click-stop").click();
  console.log(`F0 shares above 200 Hz: ${shares.join(" ")}`);
  expect(shares.length, "the notes were sounding").toBeGreaterThanOrEqual(8);
  expect(Math.min(...shares)).toBeGreaterThanOrEqual(0.45);
});
