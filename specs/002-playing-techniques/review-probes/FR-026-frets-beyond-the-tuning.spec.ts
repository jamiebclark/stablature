/**
 * FR-026, driving what round 1's F6 only read: a column whose every fret lies beyond the tuning
 * (a song moved to a tuning with fewer strings). Nothing is drawn for those strings, so there is
 * no played string to decorate. Measures what the sheet then offers.
 */
import { expect, test } from "@playwright/test";
import {
  columns,
  details,
  fret,
  inspector,
  openDialog,
  patchStored,
  startCapturing,
  storedRows,
} from "./probe-helpers";

test("a column with every fret beyond the tuning offers a techniques row with no toggles", async ({ page }) => {
  await startCapturing(page);
  await fret(page, "A", 5).click();
  await expect.poll(async () => (await storedRows(page)).length).toBe(1);
  await patchStored(page, (await storedRows(page))[0].id, { frets: { "9": 5 } });
  await page.reload();
  await expect(columns(page)).toHaveCount(1);
  await columns(page).first().click();
  await details(page).click();
  await expect(openDialog(page)).toHaveCount(1);
  const rows = await inspector(page).locator("[data-property-row] > span").allTextContents();
  const groups = await inspector(page).getByTestId("decoration-group").count();
  console.log(`MEASURE rows ${JSON.stringify(rows)} groups ${groups}`);
  expect(groups).toBe(0);
  expect(rows).toContain("techniques");
});
