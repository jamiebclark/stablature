/**
 * INV-004 (review round 1): never does either page scroll sideways. The hidden `tab-ruler` is absolutely positioned
 * in its card at the width of the whole one-line staff, and nothing clips it. Chromium leaves a zero-height box out of
 * the scrollable overflow; this checks the same pages in Firefox, at a narrow and a wide width, on both pages.
 */
import { expect, test } from "@playwright/test";
import { seedFitSong, seedWideSong } from "./wide-helpers";

test.setTimeout(300_000);

for (const name of ["long", "wide-bar", "fit"] as const) {
  test(`no sideways scroll in Firefox: ${name}`, async ({ page }) => {
    const { songUrl, playUrl } = name === "fit" ? await seedFitSong(page) : await seedWideSong(page, name);
    const out: string[] = [];
    for (const width of [375, 767, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [which, url] of [["song", songUrl], ["play", playUrl]] as const) {
        await page.goto(url);
        await expect(page.getByTestId("tab-staff").first()).toBeVisible();
        await page.waitForTimeout(300);
        const m = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          inner: document.documentElement.clientWidth,
          rulers: [...document.querySelectorAll<HTMLElement>('[data-testid="tab-ruler"]')].map((r) => Math.round(r.getBoundingClientRect().right)),
        }));
        if (m.scroll > m.inner) out.push(`${which} ${width}: scrollWidth ${m.scroll} > ${m.inner} (ruler rights ${m.rulers.join(",")})`);
      }
    }
    expect(out).toEqual([]);
  });
}
