/** INV-005 (play view): the fit song fits the viewport at 1280x800 and 1440x900, without scrolling. */
import { expect, test, type Page } from "@playwright/test";
import { seedFitSong } from "./wide-helpers";

test.setTimeout(120_000);

/** The wide layout turns on after hydration; the track is written from the rulers, which move again when the font lands. */
async function settled(page: Page) {
  await page.waitForFunction(() => document.querySelector(".reading-cards")?.getAttribute("style")?.includes("--staff-line"));
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

/** Every card has its columns, the track is written, fonts are in, and the layout has had two frames to settle. */
async function playSettled(page: Page) {
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll("ol.reading-cards > li")];
    return cards.length > 0 && cards.every((li) => li.querySelectorAll("[data-column]").length > 0);
  });
  await settled(page);
}

for (const [width, height] of [[1280, 800], [1440, 900]]) {
  for (const colorScheme of ["dark", "light"] as const) {
    test(`fit song fits ${width}x${height} ${colorScheme}`, async ({ page }) => {
      const { playUrl } = await seedFitSong(page);
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height });
      await page.goto(playUrl);
      // The fit target is measured with a mouse (spec 010 Decision 8): touch cells are bigger, so the view may scroll.
      test.skip(await page.evaluate(() => !matchMedia("(pointer: fine)").matches), "fit is measured with a mouse");
      await expect(page.locator("ol.reading-cards > li")).toHaveCount(6);
      await expect(page.getByTestId("click-bar")).toBeVisible();
      await playSettled(page);
      const m = await page.evaluate(() => {
        const bar = document.querySelector('[data-testid="click-bar"]');
        const bottoms = [...document.querySelectorAll("ol.reading-cards > li")].map((li) => li.getBoundingClientRect().bottom);
        return {
          scrollHeight: document.documentElement.scrollHeight,
          innerHeight: window.innerHeight,
          lowest: Math.max(...bottoms),
          barTop: bar ? bar.getBoundingClientRect().top : window.innerHeight,
        };
      });
      console.log(`wide-fit ${width}x${height} ${colorScheme}`, JSON.stringify(m));
      expect(m.scrollHeight).toBeLessThanOrEqual(m.innerHeight);
      expect(m.lowest).toBeLessThanOrEqual(m.barTop);
    });
  }
}

/** INV-005 (song page): with the panels closed, the arrangement and all four parts fit the viewport. */
for (const [width, height] of [[1280, 800], [1440, 900]]) {
  test(`song page fits ${width}x${height}`, async ({ page }) => {
    const { songUrl } = await seedFitSong(page);
    await page.setViewportSize({ width, height });
    await page.goto(songUrl);
    // The fit target is measured with a mouse (spec 010 assumption 8): touch cells are bigger, so the song may scroll.
    test.skip(await page.evaluate(() => !matchMedia("(pointer: fine)").matches), "fit is measured with a mouse");
    await expect(page.locator("ul.reading-cards > li")).toHaveCount(4);
    await expect(page.getByTestId("tab-ruler").first()).toBeAttached();
    await settled(page);
    const m = await page.evaluate(() => {
      const section = [...document.querySelectorAll("section")].find((s) => /Arrangement/.test(s.textContent ?? ""));
      const bottoms = [...document.querySelectorAll("ul.reading-cards > li")].map((li) => li.getBoundingClientRect().bottom);
      return {
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
        arrangementBottom: section ? section.getBoundingClientRect().bottom : Infinity,
        lowest: Math.max(...bottoms),
      };
    });
    console.log(`wide-fit song ${width}x${height}`, JSON.stringify(m));
    expect(m.arrangementBottom).toBeLessThanOrEqual(m.innerHeight);
    expect(m.lowest).toBeLessThanOrEqual(m.innerHeight);
    expect(m.scrollHeight).toBeLessThanOrEqual(m.innerHeight);
  });
}
