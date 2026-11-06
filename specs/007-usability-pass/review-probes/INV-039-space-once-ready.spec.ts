/**
 * Settles whether `usability-keys.spec.ts:21` failing 2 of 8 is the product or the test. That test presses Space as soon
 * as a staff shows, and `toggle-click` declines until the click is `ready` (`ClickBar.tsx`), which a staff does not imply.
 * Here Space waits for the same condition the Start button shows. Run with --repeat-each=8. If this holds, it is the test.
 */
import { expect, test } from "@playwright/test";
import { cols, seed } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(60_000);

test("INV-039 Space starts and stops the click once the Start button is enabled", async ({ page }) => {
  const { playUrl } = await seed(page, cols("q", "q", "|", "q", "q"), { bpm: 120 });
  await page.goto(playUrl);
  await expect(page.getByTestId("tab-staff").first()).toBeVisible();
  await expect(page.getByTestId("click-start")).toBeEnabled();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("click-start")).toBeVisible();
});
