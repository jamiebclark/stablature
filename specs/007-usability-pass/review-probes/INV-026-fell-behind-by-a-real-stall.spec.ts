/**
 * INV-026, round 3. Two rounds recorded `fell behind` as unreachable through the screen. `scheduler.ts` stops with it when
 * the next click's time has already passed, which is what a stalled main thread does, so this stalls the page for real and
 * reads the same things INV-026-cluster-states reads. No engine call is stubbed: the real audio clock keeps running.
 */
import { expect, test } from "@playwright/test";
import { cols, seed } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(90_000);
test.skip(({ isMobile }) => !isMobile, "the cluster's budget is the touch column");

const WORDS = "Stopped because the click could not keep time. Start again when you are ready.";

for (const size of [{ width: 375, height: 667 }, { width: 390, height: 844 }]) {
  test(`INV-026 fell behind at ${size.width}x${size.height}: a stalled page says why it stopped`, async ({ page }) => {
    const { playUrl } = await seed(page, cols(...Array.from({ length: 64 }, () => "q")), { bpm: 240 });
    await page.setViewportSize(size);
    await page.goto(playUrl);
    await expect(page.getByTestId("click-start")).toBeEnabled();
    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-stop")).toBeVisible();
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const until = performance.now() + 2500;
      while (performance.now() < until);
    });
    await expect(page.getByTestId("click-state")).toHaveText(WORDS, { timeout: 5000 });
    const panel = page.getByTestId("panel-play-cluster");
    for (const open of [false, true]) {
      if ((await panel.getAttribute("aria-expanded")) !== String(open)) await panel.click();
      await page.waitForTimeout(80);
      const bar = (await page.getByTestId("click-bar").boundingBox())!;
      expect(bar.height, "at least 44 high").toBeGreaterThanOrEqual(44);
      await expect(page.getByTestId("click-state"), `open=${open}`).toBeVisible();
      const state = (await page.getByTestId("click-state").boundingBox())!;
      expect(state.y + state.height, "the words inside the bar").toBeLessThanOrEqual(bar.y + bar.height + 0.5);
      expect(bar.y + bar.height, "the bar on screen").toBeLessThanOrEqual(size.height + 0.5);
    }
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(80);
    const staff = (await page.getByTestId("tab-staff").last().boundingBox())!;
    const bar = (await page.getByTestId("click-bar").boundingBox())!;
    expect(staff.y + staff.height, "the last staff clears the bar").toBeLessThanOrEqual(bar.y + 0.5);
    await page.emulateMedia({ media: "print" });
    await expect(page.getByTestId("click-bar")).toBeHidden();
  });
}
