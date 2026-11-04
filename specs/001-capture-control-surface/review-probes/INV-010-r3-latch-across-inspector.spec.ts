/**
 * INV-010 / INV-009 / FR-005 (round 3): every earlier latch probe reaches the target from
 * the staff or the toolbar. This one reaches it from the sheet, which is new surface, with
 * `stack` armed throughout: opening, dismissing, editing and deleting.
 * Enumerated: hold-and-dismiss x 2 routes; hold-and-edit; delete another column; delete the
 * cursor's column with a previous column, and with none, via both surfaces.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  columns,
  deleteButton,
  fret,
  inspector,
  mouseHold,
  openDialog,
  stackLatch,
  startCapturing,
  status,
} from "./helpers";

async function armedOn(page: Page, index: number) {
  await startCapturing(page);
  await fret(page, "E", 7).click();
  await fret(page, "A", 5).click();
  await fret(page, "D", 3).click();
  await expect(columns(page)).toHaveCount(3);
  await columns(page).nth(index).click();
  await stackLatch(page).click();
  await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
}

const stacksOntoCursor = async (page: Page, expected: number) => {
  await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
  await expect(status(page).first()).toHaveText("stacking onto the marked column");
  await fret(page, "G", 2).click();
  await page.waitForTimeout(150);
  await expect(columns(page), "the press joined the column, it did not start one").toHaveCount(expected);
  await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
};

const inspectorDelete = async (page: Page, index: number) => {
  await mouseHold(page, columns(page).nth(index));
  await inspector(page).getByRole("button", { name: "delete column" }).click();
  await expect(openDialog(page)).toHaveCount(0);
};

test.describe("INV-010 r3 the latch across the sheet", () => {
  for (const route of ["Escape", "close"] as const) {
    test(`hold another column and dismiss by ${route}: still armed on the cursor's column`, async ({ page }) => {
      await armedOn(page, 1);
      await mouseHold(page, columns(page).nth(2));
      await expect(openDialog(page)).toHaveCount(1);
      if (route === "Escape") await page.keyboard.press("Escape");
      else await inspector(page).getByRole("button", { name: "close" }).click();
      await expect(openDialog(page)).toHaveCount(0);
      await stacksOntoCursor(page, 3);
    });
  }

  test("edit another column's repeat: still armed, cursor unmoved", async ({ page }) => {
    await armedOn(page, 1);
    await mouseHold(page, columns(page).nth(0));
    await inspector(page).getByRole("button", { name: "repeat count: one more" }).click();
    await expect(columns(page)).toHaveCount(4);
    await page.keyboard.press("Escape");
    await expect(openDialog(page)).toHaveCount(0);
    await stacksOntoCursor(page, 4);
  });

  test("delete another column: still armed, cursor unmoved", async ({ page }) => {
    await armedOn(page, 1);
    await inspectorDelete(page, 2);
    await expect(columns(page)).toHaveCount(2);
    await stacksOntoCursor(page, 2);
  });

  for (const surface of ["toolbar", "inspector"] as const) {
    test(`delete the cursor's column with one before it, via ${surface}: armed, as main is`, async ({ page }) => {
      await armedOn(page, 1);
      if (surface === "toolbar") await deleteButton(page).click();
      else await inspectorDelete(page, 1);
      await expect(columns(page)).toHaveCount(2);
      await stacksOntoCursor(page, 2);
    });

    test(`delete the first column with the cursor on it, via ${surface}: dark, and the next press is a new column`, async ({
      page,
    }) => {
      await armedOn(page, 0);
      if (surface === "toolbar") await deleteButton(page).click();
      else await inspectorDelete(page, 0);
      await expect(columns(page)).toHaveCount(2);
      await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "false");
      await fret(page, "G", 2).click();
      await expect(columns(page)).toHaveCount(3);
      await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "false");
    });
  }
});
