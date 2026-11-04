/**
 * INV-016: never does the selection toolbar's behaviour change.
 *
 * The six behavioural members (copy, cut, delete, cancel, the selected-count
 * message, tap-to-extend) are probed by e2e/capture.spec.ts, which this branch
 * leaves unmodified -- re-run as part of `npm run test:e2e`. This probe adds
 * FR-003's "still reads correctly once the toolbar is contextual" at 375x667:
 * the count message and all four controls visible and inside the viewport, the
 * contextual row absent, the strip inert, and the screen still free of
 * page-level scrolling with a selection up.
 */
import { expect, test } from "@playwright/test";
import { columns, fret, startCapturing } from "./helpers";

test("INV-016 / FR-003 the selection row reads correctly at 375x667", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await startCapturing(page);
  await fret(page, "E", 7).click();
  await fret(page, "A", 5).click();
  await fret(page, "D", 3).click();
  await columns(page).nth(0).click();
  await page.getByRole("button", { name: /select/ }).click();
  await columns(page).nth(2).click(); // tap-to-extend
  await expect(page.getByText("3 selected · tap another column to extend")).toBeVisible();

  for (const name of ["copy", "cut", "delete", "cancel"]) {
    const b = page.getByRole("button", { name, exact: true });
    await expect(b).toBeVisible();
    const box = (await b.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375.5);
    expect(box.y + box.height).toBeLessThanOrEqual(667.5);
  }
  await expect(page.getByTestId("toolbar-contextual")).toHaveCount(0);
  for (const chip of await page.getByTestId("latch-strip").getByRole("button").all()) {
    await expect(chip).toBeDisabled();
  }
  const over = await page.evaluate(
    () => document.scrollingElement!.scrollHeight - document.scrollingElement!.clientHeight,
  );
  expect(over).toBeLessThanOrEqual(0);
});
