/**
 * INV-014 / FR-019: 3 toolbar actions x {cursor at the end, mid-part, on a barline}. The suite's
 * "barline" case (e2e/grouping.spec.ts:374) selects from column 3 in both branches, so its cursor
 * is never on a barline; these put it there.
 * INV-015 / FR-021: names and titles at 2, 3, 16; group; ungroup; the sheet row; and the
 * substrings existing locators match on.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  addNotes,
  columns,
  fret,
  groupControl,
  inspector,
  selectColumns,
  selectionBar,
  startCapturing,
  status,
  triplet,
  tupletControl,
  ungroupControl,
} from "./probe-helpers";

const activeIndex = (page: Page) =>
  columns(page).evaluateAll((els) => els.findIndex((e) => e.getAttribute("aria-current") === "true"));
const caretX = async (page: Page) => (await page.getByTestId("tab-caret").boundingBox())!.x;

/** Notes 0 and 1, a barline at 2, notes 3, 4 and 5. */
async function seed(page: Page) {
  await startCapturing(page);
  await addNotes(page, 2);
  await page.getByTitle("Barline").click();
  await expect(columns(page)).toHaveCount(3);
  for (const n of [1, 2, 3]) await fret(page, "E", n).click();
  await expect(columns(page)).toHaveCount(6);
}

const control = (page: Page, action: string) =>
  action === "tuplet"
    ? tupletControl(page)
    : action === "group"
      ? groupControl(page)
      : ungroupControl(page);

test.describe("INV-014", () => {
  for (const action of ["tuplet", "group", "ungroup"] as const) {
    test(`${action}, cursor at the end`, async ({ page }) => {
      await seed(page);
      if (action === "ungroup") {
        await selectColumns(page, 3, 5);
        await groupControl(page).click();
        await expect(selectionBar(page)).toHaveCount(0);
      }
      await page.getByRole("button", { name: /^end/ }).click();
      await expect(status(page)).toHaveText("adding at the end");
      // Selecting from the end: anchor is the last column, and the cursor stays "end".
      await page.getByRole("button", { name: /^select$/ }).click();
      await columns(page).nth(3).click();
      await control(page, action).click();
      await expect(selectionBar(page)).toHaveCount(0);
      await expect(status(page)).toHaveText("adding at the end");
      expect(await activeIndex(page)).toBe(5);
      await expect(page.locator('[data-selected="true"]')).toHaveCount(0);
    });

    test(`${action}, cursor mid-part`, async ({ page }) => {
      await seed(page);
      if (action === "ungroup") {
        await selectColumns(page, 3, 5);
        await groupControl(page).click();
      }
      await columns(page).nth(4).click();
      const x = await caretX(page);
      await page.getByRole("button", { name: /^select$/ }).click();
      await columns(page).nth(3).click();
      await control(page, action).click();
      await expect(selectionBar(page)).toHaveCount(0);
      expect(await activeIndex(page)).toBe(4);
      expect(await caretX(page)).toBe(x);
    });

    test(`${action}, cursor on a barline`, async ({ page }) => {
      await seed(page);
      if (action === "ungroup") {
        await selectColumns(page, 3, 5);
        await groupControl(page).click();
      }
      await columns(page).nth(2).click();
      expect(await activeIndex(page)).toBe(2);
      const x = await caretX(page);
      await page.getByRole("button", { name: /^select$/ }).click();
      await columns(page).nth(5).click();
      await control(page, action).click();
      await expect(selectionBar(page)).toHaveCount(0);
      expect(await activeIndex(page)).toBe(2);
      expect(await caretX(page)).toBe(x);
    });
  }
});

test.describe("INV-015", () => {
  for (const n of [2, 3, 16]) {
    test(`the tuplet control at ${n}`, async ({ page }) => {
      await startCapturing(page);
      await addNotes(page, n);
      await selectColumns(page, 0, n - 1);
      await expect(tupletControl(page)).toHaveAccessibleName(`Make a tuplet of ${n}`);
      await expect(tupletControl(page)).toHaveAttribute(
        "title",
        `Bracket these ${n} columns with their number`,
      );
    });
  }

  test("group, ungroup, and the sheet row", async ({ page }) => {
    await startCapturing(page);
    await addNotes(page, 3);
    await selectColumns(page, 0, 2);
    await groupControl(page).click();
    await selectColumns(page, 0, 2);
    await expect(groupControl(page)).toHaveAttribute("title", "Bracket these columns with no number");
    await expect(ungroupControl(page)).toHaveAttribute("title", "Take these groups apart");
    await selectionBar(page).getByRole("button", { name: "cancel" }).click();
    await page.getByRole("button", { name: "Open column details" }).click();
    await expect(inspector(page).getByRole("button", { name: "ungroup", exact: true })).toHaveCount(1);
  });

  test("no new control carries a word an existing locator matches", async ({ page }) => {
    await startCapturing(page);
    await addNotes(page, 3);
    await selectColumns(page, 0, 1);
    await tupletControl(page).click();
    await selectColumns(page, 0, 2);
    const bad = await selectionBar(page)
      .getByRole("button")
      .evaluateAll((els) =>
        els
          .slice(3, 6)
          .map((b) => `${b.getAttribute("aria-label")} ${b.getAttribute("title")} ${b.textContent}`)
          .filter((t) => /select|copy|cut|delete|cancel|paste|chord|triplet/i.test(t)),
      );
    expect(bad).toEqual([]);
    for (const name of ["copy", "cut", "cancel", "paste"]) {
      await expect(page.getByRole("button", { name })).toHaveCount(1);
    }
    await expect(page.getByRole("button", { name: "select", exact: true })).toHaveCount(1);
    await selectionBar(page).getByRole("button", { name: "cancel" }).click();
    await expect(triplet(page)).toHaveCount(1);
    await expect(page.getByRole("button", { name: /triplet/i })).toHaveCount(1);
  });
});
