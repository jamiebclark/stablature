/**
 * INV-016: never do the CSS and JS thresholds differ. `WIDE_QUERY` and `@custom-variant wide` say `(min-width: 768px)`.
 * Round 1 found the `.reading-cards` grid in `@media (min-width: 48rem)`: a media query's rem is the browser's default
 * font size, so at 20px (Chrome's "Large") a 768–959px window was wide to JS and narrow to the grid (review F2).
 *
 * Round 2: the round-1 version of this probe also asserted `matchMedia("(min-width: 48rem)")` was true at 900px with a
 * 20px font. That is the probe's own query, which can never match there, so it failed after the fix as before. It now
 * asserts the invariant itself: with the default font size at 20px, 767 is one column and no wrap, and 768 and 900 are
 * two columns or more with the song page wrapped, on both pages.
 *
 * Also enumerates the plain case (default font size): 767 and 768 on both pages, mouse and touch.
 */
import { expect, test, type Page } from "@playwright/test";
import { seedFitSong } from "../../../e2e/wide-helpers";

test.setTimeout(180_000);

const state = (page: Page) =>
  page.evaluate(() => {
    const list = document.querySelector<HTMLElement>(".reading-cards")!;
    return {
      columns: getComputedStyle(list).gridTemplateColumns.split(" ").filter(Boolean).length,
      wrapped: document.querySelectorAll(".tab-staff-wrapped").length,
      rulers: document.querySelectorAll('[data-testid="tab-ruler"]').length,
      jsWide: matchMedia("(min-width: 768px)").matches,
    };
  });

async function check(page: Page, songUrl: string, playUrl: string, widths: number[], label: string) {
  const bad: string[] = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const [which, url] of [["song", songUrl], ["play", playUrl]] as const) {
      await page.goto(url);
      await expect(page.getByTestId("tab-staff").first()).toBeVisible();
      await page.waitForTimeout(300);
      const s = await state(page);
      const where = `${label} ${which} at ${width}: ${JSON.stringify(s)}`;
      if (width < 768) {
        if (s.columns !== 1) bad.push(`${where} — columns`);
        if (which === "song" && s.wrapped !== 0) bad.push(`${where} — wrapped`);
      } else {
        if (!s.jsWide) bad.push(`${where} — JS narrow`);
        if (s.columns < 2) bad.push(`${where} — grid narrow`);
        if (s.wrapped === 0) bad.push(`${where} — not wrapped`);
      }
    }
  }
  return bad;
}

test("767 and 768: both pages switch together", async ({ page }) => {
  const { songUrl, playUrl } = await seedFitSong(page);
  expect(await check(page, songUrl, playUrl, [767, 768], "16px")).toEqual([]);
});

test("a 20px default font size: the grid and the wrap switch at 768px, not 48rem", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "CDP font settings; Chromium desktop");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.enable");
  await cdp.send("Page.setFontSizes", { fontSizes: { standard: 20 } });
  const { songUrl, playUrl } = await seedFitSong(page);
  expect(await check(page, songUrl, playUrl, [767, 768, 900], "20px")).toEqual([]);
});
