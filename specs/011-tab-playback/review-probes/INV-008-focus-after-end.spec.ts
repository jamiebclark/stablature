/**
 * INV-008 / FR-033's member `e2e/play-end.spec.ts` does not check: after a run ends by itself (Loop off), the start
 * control has focus if Stop had it, the bar shows no stopped line, and Play works again. Part playback, Click on and
 * Click off.
 */
import { expect, test } from "@playwright/test";
import { seedSong } from "../../../e2e/reading-helpers";
import { setStoredTempo } from "../../../e2e/rhythm-probe-helpers";
import { openFourString } from "../../../e2e/wide-helpers";
import { openCluster } from "../../../e2e/usability-helpers";
import { installPlayRecorder, noteStarts, playRecord, textToCols } from "../../../e2e/play-helpers";

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
