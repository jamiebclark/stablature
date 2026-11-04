/**
 * INV-010 / FR-005 (round 2): the render-time prune that closed F1 reads `target`, and
 * `target` is "no-column" for as long as the cursor names a column the live query has
 * not delivered yet. These are the routes that move the cursor WITHOUT clearing `armed`
 * explicitly, plus the two part routes that bypass the chip's onClick.
 *
 * FR-005: the latch's behaviour MUST be unchanged from main. main keeps `stacking` true
 * across paste (its paste handler never calls setStacking).
 */
import { expect, test, type Page } from "@playwright/test";
import { addPart, columns, fret, stackLatch, startCapturing } from "./helpers";

const stable = (page: Page) => page.getByTestId("toolbar-stable");

async function copyFirst(page: Page) {
  await columns(page).nth(0).click();
  await stable(page).getByRole("button", { name: /select/ }).click();
  await page.getByRole("button", { name: "copy", exact: true }).click();
  await expect(stable(page).getByRole("button", { name: /paste/ })).toBeEnabled();
}

test.describe("INV-010 r2", () => {
  test("paste with the cursor mid-part keeps the latch, as main does", async ({ page }) => {
    test.setTimeout(15_000);
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "A", 5).click();
    await expect(columns(page)).toHaveCount(2);
    await copyFirst(page);
    await columns(page).nth(0).click();
    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
    await stable(page).getByRole("button", { name: /paste/ }).click();
    await expect(columns(page)).toHaveCount(3);
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
  });

  test("paste with the cursor at the end keeps the latch, as main does", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "A", 5).click();
    await expect(columns(page)).toHaveCount(2);
    await copyFirst(page);
    await page.getByRole("button", { name: /end/ }).click();
    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
    await stable(page).getByRole("button", { name: /paste/ }).click();
    await expect(columns(page)).toHaveCount(3);
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
  });

  test("history back to another part leaves the latch unlit (story 1 scenario 3)", async ({
    page,
  }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await addPart(page); // router.push, so there is a history entry to go back over
    await fret(page, "A", 5).click();
    await expect(columns(page)).toHaveCount(1);
    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
    await page.goBack();
    await expect(page.getByRole("button", { name: /string, fret 7,.*in this column/ })).toHaveCount(1);
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "false");
  });
});
