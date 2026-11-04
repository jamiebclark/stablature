/**
 * INV-001: never is an action that was reachable on the capture screen before
 * this change unreachable after it.
 *
 * Enumerated: the plan's 17 actions, each driven through the rendered screen at
 * 375x667 and checked by its visible effect on the staff / status / selection.
 */
import { expect, test } from "@playwright/test";
import { columns, fret, space, stackLatch, startCapturing } from "./helpers";

test("INV-001 all 17 actions are reachable and do what they did", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await startCapturing(page);
  const count = page.getByLabel("Repeat count");

  await fret(page, "E", 7).click();
  await expect(columns(page)).toHaveCount(1);

  // 1-3: repeat+, repeat-, x4
  await page.getByRole("button", { name: "Repeat one more time" }).click();
  await expect(count).toHaveText("×2");
  await page.getByRole("button", { name: "Repeat one fewer time" }).click();
  await expect(count).toHaveText("×1");
  await page.getByRole("button", { name: /^×4$/ }).click();
  await expect(count).toHaveText("×4");
  await expect(columns(page)).toHaveCount(4);
  await page.getByRole("button", { name: "Repeat one fewer time" }).click();
  await page.getByRole("button", { name: "Repeat one fewer time" }).click();
  await page.getByRole("button", { name: "Repeat one fewer time" }).click();
  await expect(count).toHaveText("×1");

  // 4-5: arm stack, disarm stack
  await stackLatch(page).click();
  await expect(page.getByText("stacking onto the marked column")).toBeVisible();
  await fret(page, "A", 5).click();
  await expect(columns(page)).toHaveCount(1);
  await stackLatch(page).click();
  await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("adding at the end")).toBeVisible();

  // 6: space
  await space(page);
  await expect(columns(page)).toHaveCount(2);
  // 7: barline
  await page.getByTitle("Barline").click();
  await expect(page.locator('[data-barline="true"]')).toHaveCount(1);

  // 8: triplet
  await fret(page, "E", 5).click();
  await fret(page, "E", 7).click();
  await fret(page, "E", 9).click();
  await page.getByRole("button", { name: "Triplet" }).click();
  await expect(page.getByTestId("tab-staff").getByText("3", { exact: true }).first()).toBeVisible();

  // 9-10: set and clear a chord symbol
  await page.getByRole("button", { name: "chord symbol" }).click();
  await page.getByLabel("Chord", { exact: true }).fill("Am");
  await page.getByRole("button", { name: "Set", exact: true }).click();
  await expect(page.getByTestId("tab-staff").getByText("Am")).toBeVisible();
  await page.getByRole("button", { name: "chord symbol" }).click();
  await page.getByLabel("Chord", { exact: true }).fill("");
  await page.getByRole("button", { name: "Set", exact: true }).click();
  await expect(page.getByTestId("tab-staff").getByText("Am")).toHaveCount(0);

  const n = await columns(page).count(); // 6
  // 11 + 14: select, then selection-copy
  await page.getByRole("button", { name: /select/ }).click();
  await expect(page.getByText(/1 selected/)).toBeVisible();
  await page.getByRole("button", { name: "copy", exact: true }).click();
  await expect(page.getByText(/selected/)).toHaveCount(0);
  // 12: paste
  await page.getByRole("button", { name: /paste/ }).click();
  await expect(columns(page)).toHaveCount(n + 1);
  // 13: delete
  await page.getByRole("button", { name: /^Delete the (last|marked) column$/ }).click();
  await expect(columns(page)).toHaveCount(n);
  // 17: selection-cancel
  await page.getByRole("button", { name: /select/ }).click();
  await page.getByRole("button", { name: "cancel", exact: true }).click();
  await expect(page.getByText(/selected/)).toHaveCount(0);
  await expect(columns(page)).toHaveCount(n);
  // 15: selection-cut
  await page.getByRole("button", { name: /select/ }).click();
  await page.getByRole("button", { name: "cut", exact: true }).click();
  await expect(columns(page)).toHaveCount(n - 1);
  // 16: selection-delete
  await page.getByRole("button", { name: /select/ }).click();
  await page.getByRole("button", { name: "delete", exact: true }).click();
  await expect(columns(page)).toHaveCount(n - 2);
});
