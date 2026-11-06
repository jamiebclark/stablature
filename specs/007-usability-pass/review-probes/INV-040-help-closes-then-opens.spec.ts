/**
 * INV-040, round 4. `e2e/usability-keys.spec.ts:47` failed at its third `?`: the help closed, the test saw it gone, and the
 * next `?` left it closed. T172 had called that a load flake without saying why. `Sheet` drops its children on commit, but
 * `dialog.close()` runs in an effect and the `close` event comes later still, and `onClose` sets the state. So this asks how
 * long after closing the next `?` can be lost, because that decides whether a person can ever reach it.
 *
 * Each delay runs close-then-open and records what the page saw. A press inside the window that is lost prints LOST.
 * Filter: the overlay's presence, and the dialog's own `open` and `close` event. No class is read.
 */
import { expect, test } from "@playwright/test";
import { n, seedSong } from "../../../e2e/reading-helpers";

test.setTimeout(120_000);
test.skip(({ isMobile }) => isMobile, "a key is a desktop's");

const DELAYS = [0, 5, 20, 50, 100, 200];

for (const delay of DELAYS) {
  test(`INV-040 \`?\` ${delay}ms after the help closed opens it`, async ({ page }) => {
    const { playUrl } = await seedSong(page, [{ key: "a", label: "A", columns: [n(3), n(5)] }], [{ part: "a" }]);
    await page.goto(playUrl);
    await expect(page.getByTestId("tab-staff").first()).toBeVisible();
    await page.evaluate(() => {
      const w = window as unknown as { __log: string[] };
      w.__log = [];
      const t0 = performance.now();
      const stamp = (what: string) => w.__log.push(`${(performance.now() - t0).toFixed(1)} ${what}`);
      document.querySelector("dialog")!.addEventListener("close", () => stamp("close event"));
      window.addEventListener("keydown", (e) => { if (e.key === "?") stamp("key ?"); }, true);
    });
    const help = page.getByTestId("help-overlay");
    let lost = 0;
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Shift+?");
      await expect(help).toBeVisible();
      await page.keyboard.press("Shift+?");
      await expect(help).toBeHidden();
      if (delay) await page.waitForTimeout(delay);
      await page.keyboard.press("Shift+?");
      try {
        await expect(help).toBeVisible({ timeout: 1500 });
      } catch {
        lost += 1;
        const log = await page.evaluate(() => (window as unknown as { __log: string[] }).__log.slice(-6));
        console.log(`LOST at ${delay}ms: ${log.join(" | ")}`);
        continue;
      }
      await page.keyboard.press("Escape");
      await expect(help).toBeHidden();
      await page.waitForTimeout(120);
    }
    console.log(`DELAY ${delay}: lost ${lost} of 6`);
    // Past any delay a person could produce, a press must land.
    if (delay >= 50) expect(lost).toBe(0);
  });
}
