/**
 * Round 4's ruling on `e2e/variant-marks.spec.ts:255`, which failed once under load with the play view's line read as null.
 * That test reads the line once, straight after `tab-staff` is visible. A staff is drawn before the song's content has
 * arrived, so this asks the one question that separates a test race from a lost caption: does the caption always come?
 * It takes the same early read, then waits. A null early read that later arrives is a race. One that never arrives is a defect.
 * Filter: the row's own text. No class is read.
 */
import { expect, test } from "@playwright/test";
import { bar, n, seedSong } from "../../../e2e/reading-helpers";

test.setTimeout(60_000);
test.skip(({ isMobile }) => isMobile, "failed on desktop");

const A = [n(1), n(2), bar(), n(3), n(4), bar(), n(5), n(6)];

test("INV-038 a variant's caption comes on the play view, however early it is read", async ({ page }) => {
  const { playUrl } = await seedSong(
    page,
    [
      { key: "a", label: "A", columns: A },
      { key: "v", label: "A'", variantOf: "a", columns: [...A, n(4), n(6)] },
    ],
    [{ part: "v" }, { part: "v", fromBar: 1, toBar: 1 }, { part: "v", fromBar: 2, toBar: 3 }],
  );
  await page.goto(playUrl);
  await expect(page.getByTestId("tab-staff").nth(2)).toBeVisible();
  const early = await page.evaluate(() => {
    const staff = document.querySelectorAll('[data-testid="tab-staff"]')[0];
    return staff.parentElement!.querySelector('[data-testid="variant-line"]')?.textContent ?? null;
  });
  console.log(`EARLY ${early === null ? "null" : "text"}`);
  await expect(page.getByTestId("variant-line").first()).toHaveText(/^Differs from A in bar 3: 2 added$/, { timeout: 20_000 });
});
