/** Drivers for the grouping specs (specs/003-generalised-grouping/contracts/components.md). */
import { expect, type Page } from "@playwright/test";
import { columns, fret } from "./capture-surface-helpers";

export const selectionBar = (page: Page) => page.getByTestId("toolbar-selection");
export const tupletControl = (page: Page) =>
  selectionBar(page).getByRole("button", { name: /^Make a tuplet of \d+$/ });
export const groupControl = (page: Page) =>
  selectionBar(page).getByRole("button", { name: "Group with no number", exact: true });
export const ungroupControl = (page: Page) =>
  selectionBar(page).getByRole("button", { name: "Ungroup", exact: true });
/** One per drawn bracket, not one per column segment. */
export const brackets = (page: Page) =>
  page.locator('[data-testid="tab-bracket"][data-start]');

/** Capture `count` single notes at the end of the part. */
export async function addNotes(page: Page, count: number): Promise<void> {
  for (let i = 0; i < count; i++) await fret(page, "E", (i % 9) + 1).click();
  await expect(columns(page)).toHaveCount(count);
}

/** Select the columns between two zero-based positions, inclusive. */
export async function selectColumns(page: Page, from: number, to: number): Promise<void> {
  await columns(page).nth(from).click();
  await page.getByRole("button", { name: /^select$/ }).click();
  if (to !== from) await columns(page).nth(to).click();
  await expect(selectionBar(page)).toBeVisible();
}
