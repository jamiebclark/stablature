/**
 * FR-039, SC-008: not a substitute for the person-level pass, which stays owed (T048). This
 * saves what that person will look at, at actual size (device scale 1), so the review can at
 * least see it. It asserts nothing about legibility. PNGs go to the temp dir, not the repo.
 */
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  columns,
  connectors,
  DECORATIONS,
  details,
  fret,
  inspector,
  latch,
  openDialog,
  PHONE,
  startCapturing,
  THEMES,
} from "./probe-helpers";

test.use({ deviceScaleFactor: 1 });

for (const theme of THEMES) {
  test(`staff, chips and toggles at actual size, ${theme}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "one project is enough for a picture");
    await page.setViewportSize(PHONE);
    await page.emulateMedia({ colorScheme: theme });
    await startCapturing(page);
    await fret(page, "A", 5).click();
    for (const [chip, number] of [
      ["hammer-on", 7],
      ["pull-off", 5],
      ["slide up", 7],
      ["slide down", 5],
    ] as const) {
      await latch(page, chip).click();
      await fret(page, "A", number).click();
    }
    await expect(connectors(page)).toHaveCount(4);
    await details(page).click();
    for (const d of DECORATIONS.slice(0, 3)) {
      await inspector(page).getByRole("button", { name: `${d.words} on the A1 string` }).click();
    }
    const dir = path.join(os.tmpdir(), "spec002-screens");
    await page.screenshot({ path: path.join(dir, `sheet-${theme}.png`) });
    await inspector(page).getByRole("button", { name: "close" }).click();
    await expect(openDialog(page)).toHaveCount(0);
    await latch(page, "slide up").click();
    await expect(columns(page)).toHaveCount(5);
    await expect(latch(page, "slide up")).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(300); // past the chip's colour transition
    await page.screenshot({ path: path.join(dir, `capture-${theme}.png`) });
  });
}
