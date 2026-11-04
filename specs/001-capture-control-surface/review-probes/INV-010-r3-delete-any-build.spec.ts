/**
 * INV-010 r3 baseline: what `main` does to `stack` on a toolbar delete, so "as main is" in
 * INV-010-r3-latch-across-inspector.spec.ts is a number and not an inference. Runs on any
 * build; the MEASURE lines are the result.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, deleteButton, fret, startCapturing } from "./helpers";

const stack = (page: Page) => page.getByRole("button", { name: /^stack/ });
const stacking = (page: Page) => page.getByText("stacking onto the marked column");

for (const index of [0, 1]) {
  test(`toolbar delete with stack armed, cursor on column ${index}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "A", 5).click();
    await fret(page, "D", 3).click();
    await expect(columns(page)).toHaveCount(3);
    await columns(page).nth(index).click();
    await stack(page).click();
    await expect(stacking(page)).toHaveCount(1);
    await deleteButton(page).click();
    await expect(columns(page)).toHaveCount(2);
    await page.waitForTimeout(150);
    const lit = await stacking(page).count();
    await fret(page, "G", 2).click();
    await page.waitForTimeout(150);
    console.log(`MEASURE delete col ${index}: stackingAfter=${lit} columnsAfterPress=${await columns(page).count()}`);
  });
}
