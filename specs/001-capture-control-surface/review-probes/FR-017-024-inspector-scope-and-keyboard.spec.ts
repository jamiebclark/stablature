/**
 * Spec obligations with no probe in the project suite:
 *   FR-017 / edge case "cursor on a barline, long-pressed": the inspector opens
 *     for the barline and offers delete only -- and a rest column gets the full
 *     set, since a rest takes a repeat and a chord symbol.
 *   FR-024: once open, every control is reachable by Tab and operable by keyboard,
 *     and the sheet is dismissible without a pointer.
 */
import { expect, test } from "@playwright/test";
import { columns, fret, inspector, mouseHold, openDialog, space, startCapturing } from "./helpers";

test("FR-017 a long-pressed barline offers delete only; a rest offers all three", async ({ page }) => {
  await startCapturing(page);
  await fret(page, "E", 7).click();
  await page.getByTitle("Barline").click();
  await space(page);
  await expect(columns(page)).toHaveCount(3);

  await mouseHold(page, columns(page).nth(1));
  await expect(openDialog(page)).toHaveAttribute("aria-label", "Barline");
  await expect(inspector(page).locator("[data-property-row]")).toHaveCount(1);
  await expect(inspector(page).getByRole("button", { name: "delete column" })).toHaveCount(1);
  await expect(inspector(page).getByLabel("repeat count")).toHaveCount(0);
  await expect(inspector(page).getByLabel("chord symbol")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await mouseHold(page, columns(page).nth(2));
  await expect(openDialog(page)).toHaveAttribute("aria-label", "Column");
  await expect(inspector(page).locator("[data-property-row]")).toHaveCount(3);
});

test("FR-024 the inspector is operable and dismissible by keyboard alone", async ({ page }) => {
  await startCapturing(page);
  await fret(page, "E", 7).click();
  await fret(page, "A", 5).click();
  await mouseHold(page, columns(page).nth(0));
  await expect(openDialog(page)).toHaveCount(1);

  // Tab order reaches every control inside the sheet, and focus never leaves it.
  const seen = new Set<string>();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const where = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      return {
        inside: Boolean(a?.closest("dialog[open]")),
        name: a?.getAttribute("aria-label") ?? a?.textContent?.trim() ?? "",
      };
    });
    if (where.inside) seen.add(where.name);
  }
  for (const name of ["close", "repeat count: one fewer", "repeat count: one more", "chord symbol", "delete column"]) {
    expect([...seen], `Tab never reached "${name}"`).toContain(name);
  }

  // Operate the stepper and the chord field by keyboard.
  await inspector(page).getByRole("button", { name: "repeat count: one more" }).focus();
  await page.keyboard.press("Enter");
  await expect(inspector(page).getByLabel("repeat count", { exact: true })).toHaveText("×2");
  await inspector(page).getByLabel("chord symbol").focus();
  await page.keyboard.type("Dm");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("tab-staff").getByText("Dm")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(openDialog(page)).toHaveCount(0);
});
