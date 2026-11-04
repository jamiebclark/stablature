/**
 * INV-010: never is a latch lit OR ARMED while it cannot apply to the cursor's target.
 *
 * Enumerated over the plan's 7 routes. The suite's own probe stops after ONE fret
 * press on the inapplicable target. This one also asserts the latch stays off
 * afterwards: a latch that merely went dark while inapplicable, and re-lights by
 * itself once the next note lands, was still armed -- and the press after that
 * stacks instead of starting a column, with nothing the capturer did to re-arm it.
 */
import { expect, test, type Page } from "@playwright/test";
import { addPart, columns, deleteButton, fret, stackLatch, startCapturing } from "./helpers";

async function armOnPlayable(page: Page) {
  await stackLatch(page).click();
  await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
}

/** Off now, and still off after the next two presses, each of which starts its own column. */
async function expectStaysDisarmed(page: Page, countBefore: number) {
  await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "false");
  await fret(page, "G", 2).click();
  await expect(columns(page)).toHaveCount(countBefore + 1);
  await expect(stackLatch(page), "latch re-lit itself after the next note").toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await fret(page, "D", 4).click();
  await expect(columns(page), "second press stacked instead of starting a column").toHaveCount(
    countBefore + 2,
  );
}

test.describe("INV-010 latch never armed while inapplicable", () => {
  test("route 1/7: tap a barline", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await page.getByTitle("Barline").click();
    await fret(page, "E", 5).click();
    await armOnPlayable(page);
    await columns(page).nth(1).click();
    await expectStaysDisarmed(page, 3);
  });

  test("route 2/7: insert a barline", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await armOnPlayable(page);
    await page.getByTitle("Barline").click();
    await expect(columns(page)).toHaveCount(2);
    await expectStaysDisarmed(page, 2);
  });

  test("route 3/7: jump to start", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await armOnPlayable(page);
    await page.getByRole("button", { name: /start/ }).click();
    await expectStaysDisarmed(page, 1);
  });

  test("route 4/7: switch part", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await addPart(page);
    await page.getByRole("link", { name: "A", exact: true }).click();
    await expect(columns(page)).toHaveCount(1);
    await armOnPlayable(page);
    await page.getByRole("link", { name: "B", exact: true }).click();
    await expect(columns(page)).toHaveCount(0);
    await expectStaysDisarmed(page, 0);
  });

  test("route 5/7: delete the target column", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await armOnPlayable(page);
    await deleteButton(page).click();
    await expect(columns(page)).toHaveCount(0);
    await expectStaysDisarmed(page, 0);
  });

  test("route 6/7: a sync delete of the target column", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await armOnPlayable(page);
    const other = await page.context().newPage();
    await other.goto(page.url());
    await expect(columns(other)).toHaveCount(1);
    await deleteButton(other).click();
    await expect(columns(other)).toHaveCount(0);
    await other.close();
    await expect(columns(page)).toHaveCount(0);
    await expectStaysDisarmed(page, 0);
  });

  test("route 7/7: open a part with no columns", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await armOnPlayable(page);
    await addPart(page);
    await expectStaysDisarmed(page, 0);
  });
});
