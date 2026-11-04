/**
 * INV-019 / FR-028 / FR-029, geometry half: numerals 2 to 16 x 2 themes, `getBBox()` of the text
 * against each `[data-rail]`, gap above 0, as the plan states it, and the gap again with the
 * round cap's half stroke included, because that is what paints. Then the triplet button's pixels
 * against main's actual markup, in real Chromium, in both themes.
 */
import { expect, test } from "@playwright/test";
import {
  addNotes,
  cancelSelection,
  groupControl,
  selectColumns,
  startCapturing,
  THEMES,
  triplet,
  tupletControl,
} from "./probe-helpers";

const CAP = 1.4 / 2;
/** Main's TripletGlyph path, pinned as a literal so the test survives the feature being committed. */
const MAIN_PATH = "M1.5 12V8.5h3.6M10.9 8.5h3.6V12";

test.describe("INV-019", () => {
  for (const theme of THEMES) {
    test(`numerals 2 to 16 clear the rails (${theme})`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
      test.setTimeout(120_000);
      await page.emulateMedia({ colorScheme: theme });
      await startCapturing(page);
      await addNotes(page, 16);
      const report: Record<number, number[]> = {};
      for (let n = 2; n <= 16; n++) {
        await selectColumns(page, 0, n - 1);
        const gaps = await tupletControl(page).evaluate((b) => {
          const text = b.querySelector("text")!.getBBox();
          return [...b.querySelectorAll("[data-rail]")].map((rail) => {
            const r = (rail as SVGGraphicsElement).getBBox();
            return r.x < text.x ? text.x - (r.x + r.width) : r.x - (text.x + text.width);
          });
        });
        report[n] = gaps;
        expect(gaps).toHaveLength(2);
        for (const gap of gaps) expect(gap, `numeral ${n}`).toBeGreaterThan(0);
        await cancelSelection(page);
      }
      console.log(JSON.stringify({ theme, report, cap: CAP }));
    });
  }

  test("the empty form has no text", async ({ page }) => {
    await startCapturing(page);
    await addNotes(page, 2);
    await selectColumns(page, 0, 1);
    await expect(groupControl(page).locator("text")).toHaveCount(0);
    await expect(groupControl(page).locator("path")).toHaveCount(1);
  });

  for (const theme of THEMES) {
    test(`the triplet button paints exactly as main's glyph did (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await startCapturing(page);
      await addNotes(page, 1);
      const svg = triplet(page).locator("svg");
      const ours = await svg.screenshot();
      const d = MAIN_PATH;
      await svg.evaluate((el, path) => {
        const rails = [...el.querySelectorAll("path")];
        rails[0].setAttribute("d", path);
        rails[0].removeAttribute("data-rail");
        rails[1].remove();
      }, d);
      expect(await svg.screenshot()).toEqual(ours);
    });
  }
});
