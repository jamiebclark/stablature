/**
 * INV-017 / FR-024, round 2. T064 stopped the status row wrapping by truncating it, so the
 * refusal no longer costs a string. FR-024 still says the status line MUST say why. This reads
 * whether it does: a span whose `scrollWidth` beats its `clientWidth` is showing an ellipsis.
 * Then the burst round 1 could not check: a refusal from a render that has not seen the last fret.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  addNotes,
  addRests,
  columns,
  PHONE,
  REFUSAL,
  refusal,
  setChordOn,
  space,
  startCapturing,
  startWith,
  triplet,
  TUNINGS,
} from "./probe-helpers";

const measure = (page: Page) =>
  refusal(page).evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return {
      needs: Math.ceil(range.getBoundingClientRect().width),
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      row: el.parentElement!.clientWidth,
      siblings: [...el.parentElement!.children]
        .filter((c) => c !== el)
        .map((c) => [c.textContent?.trim(), Math.round(c.getBoundingClientRect().width)]),
    };
  });

test.describe("the refusal can be read at 375x667", () => {
  test.use({ viewport: PHONE });

  test("with no chord", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
    await startWith(page, TUNINGS[1]);
    await addRests(page, 2);
    await triplet(page).click();
    await expect(refusal(page)).toBeVisible();
    const m = await measure(page);
    console.log(JSON.stringify({ chord: null, ...m }));
    expect(m.scrollWidth, "the whole sentence shows").toBeLessThanOrEqual(m.clientWidth);
  });

  for (const symbol of ["Am", "Cmaj7", "F#m7b5", "Zork"]) {
    test(`beside the chord ${symbol}`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
      await startWith(page, TUNINGS[1]);
      await addRests(page, 2);
      await setChordOn(page, 0, symbol);
      await columns(page).nth(1).click();
      await triplet(page).click();
      await expect(refusal(page)).toBeVisible();
      const m = await measure(page);
      console.log(JSON.stringify({ chord: symbol, ...m }));
      expect(m.scrollWidth, "the whole sentence shows").toBeLessThanOrEqual(m.clientWidth);
    });
  }

  /** A barline among the three: the capturer has three columns, so the cut words are the reason. */
  test("three columns across a bar, beside Cmaj7", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
    await startWith(page, TUNINGS[1]);
    await addRests(page, 1);
    await page.getByRole("button", { name: "Barline" }).click();
    await page.getByTestId("tab-barline").or(page.locator(".tab-barline")).first().waitFor();
    await space(page);
    await space(page);
    await expect(columns(page).nth(2)).toBeVisible();
    await setChordOn(page, 0, "Cmaj7");
    await columns(page).last().click();
    await triplet(page).click();
    await expect(refusal(page)).toBeVisible();
    const m = await measure(page);
    const shows = Math.floor((m.clientWidth / m.needs) * REFUSAL.length);
    console.log(JSON.stringify({ ...m, shows: REFUSAL.slice(0, shows) }));
    expect(m.scrollWidth, "the whole sentence shows").toBeLessThanOrEqual(m.clientWidth);
  });
});

/**
 * `setRefusedAt` keeps the `columns.length` of the render that took the tap, so a refusal from a
 * render one fret behind clears itself as soon as the fret arrives. The gap says how wide that
 * window is: no write is lost either way, only the sentence.
 */
for (const gap of [0, 10, 25, 50, 100]) {
  test(`a refusal ${gap}ms after a fret still says why`, async ({ page }) => {
    await startCapturing(page);
    await addNotes(page, 1);
    await page.evaluate(async (wait) => {
      const label = (b: Element) => b.getAttribute("aria-label") ?? "";
      const find = (test: (b: Element) => boolean) =>
        [...document.querySelectorAll("button")].find(test);
      find((b) => / string, fret \d+,/.test(label(b)))?.click();
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      find((b) => label(b) === "Triplet")?.click();
    }, gap);
    await expect(columns(page)).toHaveCount(2);
    await expect(refusal(page)).toBeVisible();
  });
}
