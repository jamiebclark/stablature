/**
 * INV-040: `?` straight after the help closed opens it again, at any delay.
 *
 * Adopted from specs/007-usability-pass/review-probes/INV-040-help-closes-then-opens.spec.ts (FU24). `Sheet` closes its
 * dialog in an effect, and the dialog's `close` event comes a task later. Before the fix that late event closed the
 * sheet a press had just reopened, so a quick second `?` was lost.
 */
import { expect, test } from "@playwright/test";
import { n, seedSong } from "./reading-helpers";

test.skip(({ isMobile }) => isMobile, "a key is a desktop's");

for (const delay of [0, 5, 20, 50, 100, 200]) {
  test(`INV-040 \`?\` ${delay}ms after the help closed opens it`, async ({ page }) => {
    const { playUrl } = await seedSong(page, [{ key: "a", label: "A", columns: [n(3), n(5)] }], [{ part: "a" }]);
    await page.goto(playUrl);
    await expect(page.getByTestId("tab-staff").first()).toBeVisible();
    const help = page.getByTestId("help-overlay");
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Shift+?");
      await expect(help).toBeVisible();
      await page.keyboard.press("Shift+?");
      await expect(help).toBeHidden();
      if (delay) await page.waitForTimeout(delay);
      await page.keyboard.press("Shift+?");
      await expect(help, `press ${i + 1}`).toBeVisible({ timeout: 1500 });
      await page.keyboard.press("Escape");
      await expect(help).toBeHidden();
      // Escape closes the dialog natively and tells React a task later, so a `?` in the same task toggles a help
      // React still thinks is open. No hand is that quick; the probe paused here too.
      await page.waitForTimeout(120);
    }
  });
}
