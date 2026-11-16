/** Spec 011 INV-008 (e2e): a run that ends by itself goes quiet and idle; a looping one has no seam gap. */
import { expect, test } from "@playwright/test";
import { seedSong } from "./reading-helpers";
import { setStoredTempo } from "./rhythm-probe-helpers";
import { openFourString } from "./wide-helpers";
import { openCluster } from "./usability-helpers";
import { analyse, installPlayRecorder, noteStarts, playRecord, recordedAudio, textToCols } from "./play-helpers";

async function seeded(page: import("@playwright/test").Page) {
  const s = await seedSong(page, [{ key: "a", label: "A", columns: textToCols("3:5 3:7 3:9 3:5 |") }], []);
  await setStoredTempo(page, 240);
  await openFourString(page, s.songUrl);
  await page.goto(`${s.songUrl}/play/${s.parts.a}`);
  await expect(page.getByTestId("click-start")).toBeEnabled();
  return s;
}

test("Loop off: the run ends into idle words and silence", async ({ page }) => {
  await installPlayRecorder(page);
  await seeded(page);
  // A part opens with Loop on; the control to turn it off lives in the cluster.
  await openCluster(page);
  await page.getByTestId("play-loop").click();
  await page.getByTestId("click-start").click();
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await expect(page.getByTestId("click-start")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("click-state")).not.toContainText("Stopped because");
  await page.waitForTimeout(100);
  // A closed context leaves its analyser holding the last buffer, so only a live one can be read.
  const live = await page.evaluate(() => (window as unknown as { __ctxs: AudioContext[] }).__ctxs.at(-1)?.state === "running");
  if (live) expect((await analyse(page))!.peak).toBeLessThan(0.001);
});

test("Loop on: round 2 begins where round 1 ends, with no click between", async ({ page }) => {
  await installPlayRecorder(page);
  await seeded(page);
  await page.getByTestId("click-start").click();
  await page.waitForTimeout(4000);
  const rec = await playRecord(page);
  const sets = rec.freq.filter((f) => f.kind === "set").map((f) => f.when).sort((a, b) => a - b);
  expect(sets.length).toBeGreaterThanOrEqual(8);
  // 4 notes a round: the 5th note's start sits one round (4 beats at 240 bpm = 1 s) after the 1st.
  expect(sets[4] - sets[0]).toBeCloseTo(1, 3);
  const audio = await recordedAudio(page);
  expect(audio.contexts.length).toBe(1);
});

for (const click of [true, false]) {
  test(`Loop off, Click ${click ? "on" : "off"}: the end returns focus to Play when Stop had it`, async ({ page }) => {
    await installPlayRecorder(page);
    const s = await seedSong(page, [{ key: "a", label: "A", columns: textToCols("3:5 3:7 3:9 3:5 |") }], []);
    await setStoredTempo(page, 240);
    await openFourString(page, s.songUrl);
    await page.goto(`${s.songUrl}/play/${s.parts.a}`);
    await expect(page.getByTestId("click-start")).toBeEnabled();
    await openCluster(page);
    await page.getByTestId("play-loop").click();
    await expect(page.getByTestId("play-loop")).toHaveAttribute("aria-pressed", "false");
    if (!click) await page.getByTestId("play-click").click();
    await page.getByTestId("panel-play-cluster").click();
    await page.getByTestId("click-start").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("click-stop")).toBeFocused();
    await expect(page.getByTestId("click-start")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("click-start")).toBeFocused();
    await expect(page.getByTestId("click-state")).not.toContainText("Stopped because");
    const before = noteStarts(await playRecord(page)).length;
    expect(before).toBe(4);
    await page.keyboard.press("Enter");
    await expect.poll(async () => noteStarts(await playRecord(page)).length, { timeout: 8000 }).toBeGreaterThan(before);
  });
}
