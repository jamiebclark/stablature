/** INV-015: print draws the same cards, none split, none off the page. */
import { expect, test } from "@playwright/test";
import { FOLD, seedFitSong, seedFold } from "./wide-helpers";

test.setTimeout(120_000);

const F5 = FOLD.find((r) => r.id === "F5")!;

for (const colorScheme of ["dark", "light"] as const) {
  for (const song of ["fit", "F5"] as const) {
    test(`print ${song} ${colorScheme}`, async ({ page }) => {
      const { playUrl } = song === "fit" ? await seedFitSong(page) : await seedFold(page, F5);
      await page.emulateMedia({ colorScheme });
      await page.goto(playUrl);
      const cards = song === "fit" ? 6 : 2;
      await expect(page.locator("ol.reading-cards > li")).toHaveCount(cards);
      await expect(page.getByTestId("click-bar")).toBeAttached();
      await page.emulateMedia({ media: "print", colorScheme });
      for (const width of [718, 1047]) {
        await page.setViewportSize({ width, height: 900 });
        const info = await page.evaluate(() => {
          const lis = [...document.querySelectorAll("ol.reading-cards > li")] as HTMLElement[];
          const shown = (li: Element, sel: string) => {
            const t = li.querySelector(sel);
            return t ? getComputedStyle(t).display !== "none" && getComputedStyle(t).visibility !== "hidden" : null;
          };
          const bar = document.querySelector<HTMLElement>('[data-testid="click-bar"]');
          return {
            count: lis.length,
            avoid: lis.every((li) => getComputedStyle(li).breakInside === "avoid"),
            right: Math.max(...lis.map((li) => li.getBoundingClientRect().right)),
            tops: new Set(lis.map((li) => Math.round(li.getBoundingClientRect().top))).size,
            numbers: lis.every((li) => shown(li, '[data-testid="card-number"]')),
            rest: lis.map((li) => shown(li, '[data-testid="card-passes-rest"]')).filter((v) => v !== null),
            live: lis
              .map((li) => li.querySelector('[data-testid="card-passes-live"]'))
              .filter((e): e is Element => e !== null)
              .map((e) => getComputedStyle(e).display),
            barHidden: bar !== null && getComputedStyle(bar).display === "none",
            scroll: document.documentElement.scrollWidth,
            vw: window.innerWidth,
          };
        });
        expect(info.count, `cards at ${width}`).toBe(cards);
        expect(info.avoid).toBe(true);
        expect(info.right).toBeLessThanOrEqual(info.vw);
        expect(info.numbers).toBe(true);
        expect(info.rest.every(Boolean)).toBe(true);
        expect(info.live.every((d) => d === "none")).toBe(true);
        expect(info.barHidden, `click bar display none at ${width}`).toBe(true);
        expect(info.scroll, `nothing cut at ${width}`).toBeLessThanOrEqual(info.vw);
        if (width === 718) expect(info.tops).toBe(info.count);
        else expect(info.tops).toBeLessThan(info.count);
      }
    });
  }
}
