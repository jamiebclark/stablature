/**
 * FR-014 / FR-019 / FR-022 / contracts/components.md guarantee 4 (round 3): the gesture over
 * every SHAPE a column can take, not just a plain note. A repeated column renders as several
 * columns from one event, a tuplet draws a bracket, a chord draws a label, each inside the
 * pressed button. Also the spec's empty-part edge case, and tap-to-extend by real touch.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  addPart,
  caret,
  centre,
  columns,
  fret,
  inspector,
  mouseHold,
  openDialog,
  space,
  startCapturing,
  touchHold,
} from "./helpers";

const sheetCount = (page: Page) => inspector(page).getByLabel("repeat count", { exact: true });

test.describe("FR-014 r3 shapes", () => {
  for (const repetition of [0, 1, 2]) {
    test(`a repeated column is one event from repetition ${repetition}`, async ({ page }) => {
      await startCapturing(page);
      await fret(page, "E", 7).click();
      await page.getByRole("button", { name: "Repeat one more time" }).click();
      await expect(page.getByLabel("Repeat count")).toHaveText("×2");
      await page.getByRole("button", { name: "Repeat one more time" }).click();
      await expect(page.getByLabel("Repeat count")).toHaveText("×3");
      await fret(page, "A", 5).click();
      await expect(columns(page)).toHaveCount(4);

      await mouseHold(page, columns(page).nth(repetition));
      await expect(openDialog(page)).toHaveCount(1);
      await expect(inspector(page).getByRole("heading")).toHaveText("Column 1");
      await expect(sheetCount(page)).toHaveText("×3");
      await page.keyboard.press("Escape");
      await expect(openDialog(page)).toHaveCount(0);

      await columns(page).nth(repetition).click();
      await expect(page.locator('[data-testid="tab-column"][aria-current="true"]')).toHaveCount(3);
      await expect(page.getByLabel("Repeat count")).toHaveText("×3");
    });
  }

  test("the stepper keeps working as it unrolls the column under the sheet", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await mouseHold(page, columns(page).first());
    const more = inspector(page).getByRole("button", { name: "repeat count: one more" });
    for (let n = 2; n <= 6; n++) {
      await more.click();
      await expect(sheetCount(page)).toHaveText(`×${n}`);
    }
    await expect(columns(page)).toHaveCount(6);
    await expect(openDialog(page)).toHaveCount(1);
  });

  test("every column in a tuplet opens its own sheet", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "A", 5).click();
    await fret(page, "A", 7).click();
    await fret(page, "A", 9).click();
    await expect(columns(page)).toHaveCount(3);
    await page.getByTitle(/triplet/).click();
    await expect(page.getByTestId("tab-staff")).toContainText("3");
    for (const index of [0, 1, 2]) {
      await mouseHold(page, columns(page).nth(index));
      await expect(inspector(page).getByRole("heading")).toHaveText(`Column ${index + 1}`);
      await page.keyboard.press("Escape");
      await expect(openDialog(page)).toHaveCount(0);
    }
  });

  test("a hold on a column's chord label inspects that column", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await page.getByRole("button", { name: "chord symbol" }).click();
    await page.getByLabel("Chord", { exact: true }).fill("Am");
    await page.getByRole("button", { name: "Set", exact: true }).click();
    const label = columns(page).first().getByText("Am");
    await expect(label).toBeVisible();
    await mouseHold(page, label);
    await expect(openDialog(page)).toHaveCount(1);
    await expect(inspector(page).getByLabel("chord symbol")).toHaveValue("Am");
  });

  test("a rest between notes counts as a column in the title", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await space(page);
    await fret(page, "A", 5).click();
    await expect(columns(page)).toHaveCount(3);
    await mouseHold(page, columns(page).nth(2));
    await expect(inspector(page).getByRole("heading")).toHaveText("Column 3");
  });

  test("a long press on an empty part does nothing", async ({ page }, info) => {
    await startCapturing(page);
    await expect(columns(page)).toHaveCount(0);
    const staff = page.getByTestId("tab-staff");
    await mouseHold(page, staff);
    if (info.project.name === "mobile") await touchHold(page, staff);
    await expect(openDialog(page)).toHaveCount(0);
    await expect(caret(page)).toHaveCount(1);
  });

  test("a real touch tap still extends a selection, and a real hold does not", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "touch needs a touch device");
    await startCapturing(page);
    await addPart(page);
    for (const n of [3, 5, 7, 9]) await fret(page, "E", n).click();
    await expect(columns(page)).toHaveCount(4);
    await columns(page).nth(0).click();
    await page.getByRole("button", { name: "select" }).click();
    await expect(page.getByText(/^1 selected/)).toBeVisible();

    await touchHold(page, columns(page).nth(3));
    await expect(openDialog(page)).toHaveCount(0);
    await expect(page.getByText(/^1 selected/)).toBeVisible();

    const { x, y } = await centre(columns(page).nth(2));
    await page.touchscreen.tap(x, y);
    await expect(page.getByText(/^3 selected/)).toBeVisible();
  });
});
