/**
 * INV-008: never does the inspector stay open on a column that no longer exists.
 *
 * Enumerated over the plan's 5 routes:
 *   1. the inspector's own delete
 *   2. the toolbar's delete -- unreachable while the modal sheet is open (the
 *      page behind a showModal() dialog is inert); asserted as unreachable
 *   3. a sync delete from another device (a second tab on the same store)
 *   4. switching part (history back, the only part switch reachable while the
 *      modal is open)
 *   5. deleting the part (from the song page in a second tab)
 */
import { expect, test } from "@playwright/test";
import {
  addPart,
  columns,
  deleteButton,
  fret,
  inspector,
  mouseHold,
  openDialog,
  startCapturing,
} from "./helpers";

test.describe("INV-008 the inspector closes when its column is gone", () => {
  test("route 1/5: the inspector's own delete", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "A", 5).click();
    await mouseHold(page, columns(page).nth(0));
    await expect(openDialog(page)).toHaveCount(1);
    await inspector(page).getByRole("button", { name: "delete column" }).click();
    await expect(openDialog(page)).toHaveCount(0);
    await expect(columns(page)).toHaveCount(1);
  });

  test("route 2/5: the toolbar's delete is unreachable while the sheet is open", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await mouseHold(page, columns(page).nth(0));
    await expect(openDialog(page)).toHaveCount(1);
    // Inert behind the modal: a click at the delete button's coordinates lands on
    // the backdrop (which dismisses the sheet) and must not delete anything.
    await deleteButton(page).click({ force: true, timeout: 2000 }).catch(() => {});
    await expect(columns(page)).toHaveCount(1);
  });

  test("route 3/5: a sync delete from another device", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "A", 5).click();
    await mouseHold(page, columns(page).nth(1));
    await expect(openDialog(page)).toHaveCount(1);

    const other = await page.context().newPage();
    await other.goto(page.url());
    await expect(columns(other)).toHaveCount(2);
    await deleteButton(other).click();
    await expect(columns(other)).toHaveCount(1);
    await other.close();

    await expect(openDialog(page)).toHaveCount(0);
    await expect(columns(page)).toHaveCount(1);
  });

  test("route 4/5: switching part (history back)", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await addPart(page);
    await fret(page, "A", 5).click();
    await expect(columns(page)).toHaveCount(1);
    await mouseHold(page, columns(page).nth(0));
    await expect(openDialog(page)).toHaveCount(1);
    await page.goBack();
    await expect(openDialog(page)).toHaveCount(0);
  });

  test("route 5/5: deleting the part", async ({ page }) => {
    const { songUrl } = await startCapturing(page);
    await fret(page, "E", 7).click();
    await mouseHold(page, columns(page).nth(0));
    await expect(openDialog(page)).toHaveCount(1);

    const other = await page.context().newPage();
    await other.goto(songUrl);
    await other.getByRole("button", { name: "Delete part A" }).click();
    await expect(other.getByRole("button", { name: "Delete part A" })).toHaveCount(0);
    await other.close();

    await expect(openDialog(page)).toHaveCount(0);
  });
});
