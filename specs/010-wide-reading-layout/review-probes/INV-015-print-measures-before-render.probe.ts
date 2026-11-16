/**
 * INV-015 (review round 2): `e2e/wide-print.spec.ts` flakes red on "click bar display none at 718". This separates the
 * product from the test. (a) Measured the way the suite does (straight after `goto`, no wait), it records how often the
 * bar or the cards are not drawn yet. (b) Measured after the cards and the bar are drawn, the bar must be `display: none`
 * at both print widths, every card must be present, and nothing may be cut.
 */
import { expect, test } from "@playwright/test";
import { seedFitSong } from "../../../e2e/wide-helpers";

test.setTimeout(180_000);

const snapshot = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>('[data-testid="click-bar"]');
    return {
      bar: bar === null ? "absent" : getComputedStyle(bar).display,
      cards: document.querySelectorAll("ol.reading-cards > li").length,
      scroll: document.documentElement.scrollWidth,
      vw: innerWidth,
    };
  });

test("print: what the suite sees straight after goto, and what is there once drawn", async ({ page }) => {
  const { playUrl } = await seedFitSong(page);
  const early: string[] = [];
  for (let i = 0; i < 6; i++) {
    await page.emulateMedia({ media: null });
    await page.goto(playUrl);
    await page.emulateMedia({ media: "print" });
    await page.setViewportSize({ width: 718, height: 900 });
    const s = await snapshot(page);
    early.push(`${s.bar}/${s.cards}`);
  }
  console.log("straight after goto (bar display / cards):", early.join(" "));

  for (const width of [718, 1047]) {
    await page.emulateMedia({ media: null });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(playUrl);
    await expect(page.locator("ol.reading-cards > li")).toHaveCount(6);
    await expect(page.getByTestId("click-bar")).toBeAttached();
    await page.emulateMedia({ media: "print" });
    const s = await snapshot(page);
    expect(s.bar, `bar at ${width}`).toBe("none");
    expect(s.cards).toBe(6);
    expect(s.scroll).toBeLessThanOrEqual(s.vw);
  }
});
