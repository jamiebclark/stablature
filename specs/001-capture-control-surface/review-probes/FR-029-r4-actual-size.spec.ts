/**
 * FR-029 / INV-014 (round 4): Phase 9 shrank the chip's text and padding and tightened three
 * rows after T037's browser pass, and round 3 asked for one look at the result in both themes.
 * Renders at 375x667 with a device pixel ratio of 1, so a pixel in the file is a CSS pixel:
 * actual size, not a magnified crop. Screenshots go to the temp dir, for a human eye.
 *
 * This is headless Chromium, so it narrows FR-029 and does not discharge it: T037 is a person
 * looking at Chrome. The assertion only proves the surfaces rendered.
 */
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { columns, fret, inspector, mouseHold, openDialog, stackLatch, startCapturing } from "./helpers";

test.use({ deviceScaleFactor: 1 });

const shot = (name: string) => ({ path: path.join(os.tmpdir(), `spec001-r4-${name}.png`) });

for (const theme of ["light", "dark"] as const) {
  test(`actual size - ${theme}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "one project is enough for a render");
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 375, height: 667 });
    await startCapturing(page);
    await fret(page, "A", 5).click();
    await fret(page, "A", 7).click();
    await fret(page, "A", 9).click();
    await expect(columns(page)).toHaveCount(3);
    await page.getByTitle(/triplet/).click();
    await page.getByRole("button", { name: "chord symbol" }).click();
    await page.getByLabel("Chord", { exact: true }).fill("Am");
    await page.getByRole("button", { name: "Set", exact: true }).click();
    await expect(page.getByLabel("Chord", { exact: true })).toHaveCount(0);
    await columns(page).last().click();
    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    await page.screenshot(shot(`${theme}-armed`));

    await stackLatch(page).click();
    await page.getByTestId("latch-strip").evaluate((el) => {
      const chip = el.querySelector("button")!;
      for (const label of ["hammer-on", "pull-off", "slide-up", "slide-down"]) {
        const clone = chip.cloneNode(true) as HTMLButtonElement;
        clone.textContent = label;
        el.append(clone);
      }
    });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);
    await page.screenshot(shot(`${theme}-five`));

    await mouseHold(page, columns(page).nth(1));
    await expect(openDialog(page)).toHaveCount(1);
    await expect(inspector(page)).toBeVisible();
    await page.waitForTimeout(200);
    await page.screenshot(shot(`${theme}-sheet`));
  });
}
