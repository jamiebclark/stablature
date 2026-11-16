/**
 * INV-005, INV-012, INV-015 (review round 1).
 *
 * wide-fit.spec.ts and wide-print.spec.ts find the bar with `main > div.sticky`. The bar is `fixed` now, so that
 * selector matches nothing: wide-fit's "every card above the bar" compares against `innerHeight`, and wide-print's
 * "click-bar hidden" is always true. These probes find the bar by its test id.
 *
 * INV-005: the fit song's play view at 1280×800 and 1440×900, both themes: no scroll, six cards, every `li` bottom ≤
 * the bar's top. INV-012: scrolled to the end of a 40-entry song, the last card is ≥ 7.5px above the bar at rest and
 * running, cluster closed and open, at every **Bw**. INV-015: in print the bar and the panels are not drawn.
 */
import { expect, test, type Page } from "@playwright/test";
import { cols, seed } from "../../../e2e/rhythm-probe-helpers";
import { FOLD, seedFitSong, seedFold } from "../../../e2e/wide-helpers";

test.setTimeout(400_000);

const clearance = (page: Page) =>
  page.evaluate(() => {
    const bar = document.querySelector('[data-testid="click-bar"]')!.getBoundingClientRect();
    const lis = [...document.querySelectorAll("ol.reading-cards > li")];
    const lowest = Math.max(...lis.map((li) => li.getBoundingClientRect().bottom));
    return {
      count: lis.length,
      lowest,
      barTop: bar.top,
      scrollHeight: document.documentElement.scrollHeight,
      inner: innerHeight,
    };
  });

for (const [width, height] of [[1280, 800], [1440, 900]]) {
  for (const colorScheme of ["dark", "light"] as const) {
    test(`INV-005 fit song clear of the bar at ${width}x${height} ${colorScheme}`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "measured with a mouse");
      const { playUrl } = await seedFitSong(page);
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height });
      await page.goto(playUrl);
      await expect(page.locator("ol.reading-cards > li")).toHaveCount(6);
      await page.waitForFunction(() => document.querySelector<HTMLElement>(".reading-cards")!.style.getPropertyValue("--staff-line") !== "");
      await page.evaluate(() => document.fonts.ready);
      const m = await clearance(page);
      console.log(`INV-005 ${width}x${height} ${colorScheme}`, JSON.stringify(m));
      expect(m.scrollHeight).toBeLessThanOrEqual(m.inner);
      expect(m.lowest).toBeLessThanOrEqual(m.barTop);
    });
  }
}

for (const width of [375, 412, 768, 1024, 1280, 1440]) {
  test(`INV-012 the last card clears the bar at ${width}, rest and running, cluster closed and open`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const { playUrl } = await seed(page, cols("q", "q", "|", "q", "q"), { bpm: 120, entries: 40 });
    await page.goto(playUrl);
    await expect(page.locator("ol.reading-cards > li")).toHaveCount(40);
    await page.waitForFunction(() => [...document.querySelectorAll("ol.reading-cards > li")].every((li) => li.querySelector("[data-column]")));
    const bad: string[] = [];
    const check = async (what: string) => {
      // Let the bar settle at its new height (and the padding follow it) before going to the end.
      await page.waitForTimeout(400);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(400);
      const m = await clearance(page);
      if (m.barTop - m.lowest < 7.5) bad.push(`${what}: last card bottom ${m.lowest}, bar top ${m.barTop}`);
    };
    await check("rest, closed");
    await page.getByTestId("panel-play-cluster").click();
    await check("rest, open");
    await page.getByTestId("panel-play-cluster").click();
    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-stop")).toBeVisible();
    await check("running, closed");
    await page.getByTestId("panel-play-cluster").click();
    await check("running, open");
    expect(bad).toEqual([]);
  });
}

for (const song of ["fit", "F5"] as const) {
  test(`INV-015 print hides the bar: ${song}`, async ({ page }) => {
    const { playUrl } = song === "fit" ? await seedFitSong(page) : await seedFold(page, FOLD.find((r) => r.id === "F5")!);
    await page.goto(playUrl);
    await expect(page.getByTestId("click-bar")).toBeVisible();
    await page.emulateMedia({ media: "print" });
    for (const width of [718, 1047]) {
      await page.setViewportSize({ width, height: 900 });
      const m = await page.evaluate(() => {
        const bar = document.querySelector<HTMLElement>('[data-testid="click-bar"]')!;
        const lis = [...document.querySelectorAll("ol.reading-cards > li")];
        return {
          display: getComputedStyle(bar).display,
          right: Math.max(...lis.map((li) => li.getBoundingClientRect().right)),
          vw: innerWidth,
          scroll: document.documentElement.scrollWidth,
        };
      });
      expect(m.display, `bar at ${width}`).toBe("none");
      expect(m.right, `right edge at ${width}`).toBeLessThanOrEqual(m.vw);
      expect(m.scroll, `nothing cut at ${width}`).toBeLessThanOrEqual(m.vw);
    }
  });
}
