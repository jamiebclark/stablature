/**
 * Round 3. `INV-039-space-once-ready` failed 1 of 16 with the Start button enabled and the page idle. This asks what the
 * key saw: how long after the button was enabled it arrived, and whether the same key a moment later works. A key that
 * only fails inside a few ms of the button enabling is a window no person can hit, so it is the test's, not the product's.
 * Run with --repeat-each=12. WAIT is how long the test waits after the button enables.
 */
import { expect, test } from "@playwright/test";
import { cols, seed } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(60_000);

for (const wait of [0, 100]) {
  test(`INV-039 Space ${wait}ms after Start enables`, async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __enabledAt: number | null; __keyAt: number | null };
      w.__enabledAt = null;
      w.__keyAt = null;
      window.addEventListener("keydown", () => (w.__keyAt ??= performance.now()), true);
      new MutationObserver(() => {
        const b = document.querySelector('[data-testid="click-start"]') as HTMLButtonElement | null;
        if (b && !b.disabled && w.__enabledAt === null) w.__enabledAt = performance.now();
      }).observe(document, { subtree: true, childList: true, attributes: true });
    });
    const { playUrl } = await seed(page, cols("q", "q", "|", "q", "q"), { bpm: 120 });
    await page.goto(playUrl);
    await expect(page.getByTestId("click-start")).toBeEnabled();
    if (wait) await page.waitForTimeout(wait);
    await page.keyboard.press("Space");
    const started = await page.getByTestId("click-stop").isVisible().catch(() => false)
      || await page.getByTestId("click-stop").waitFor({ timeout: 1000 }).then(() => true, () => false);
    const seen = await page.evaluate(() => {
      const w = window as unknown as { __enabledAt: number | null; __keyAt: number | null };
      return { gap: Math.round((w.__keyAt ?? 0) - (w.__enabledAt ?? 0)), active: document.activeElement?.tagName };
    });
    console.log(`space wait=${wait} started=${started} ${JSON.stringify(seen)}`);
    if (!started) {
      await page.waitForTimeout(150);
      await page.keyboard.press("Space");
      await expect(page.getByTestId("click-stop"), "the same key a moment later").toBeVisible();
    }
    expect(started, `declined ${seen.gap}ms after the button enabled`).toBe(true);
  });
}
