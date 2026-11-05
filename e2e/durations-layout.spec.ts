import { expect, test } from "@playwright/test";
import { PHONE, columns, details, fret, inspector, startCapturing } from "./capture-surface-helpers";

test.describe("duration row layout", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`inspector row is six equal-y, tappable, in-view buttons (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize(PHONE);
      await startCapturing(page);
      await fret(page, "E", 7).click();
      await columns(page).first().click();
      await details(page).click();
      await expect(inspector(page)).toBeVisible();
      const buttons = page.getByTestId("duration-row").getByRole("button");
      await expect(buttons).toHaveCount(6);
      const boxes = await buttons.evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height, t: el.textContent };
        }),
      );
      expect(boxes.map((b) => b.t)).toEqual(["w", "h", "q", "8", "16", "32"]);
      for (const b of boxes) {
        expect(b.y).toBeCloseTo(boxes[0].y, 0);
        expect(b.h).toBeGreaterThanOrEqual(44);
        expect(b.x + b.w).toBeLessThanOrEqual(375);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
});
