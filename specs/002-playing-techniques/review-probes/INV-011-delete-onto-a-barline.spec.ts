/**
 * INV-011, a member round 1 did not drive: the toolbar delete moves the cursor back onto a
 * barline. Stack cannot apply there, a chip can. So the one action leaves stack dark and the
 * chip lit, and this pins what the capturer then gets: what the strip says is what is stored.
 */
import { expect, test } from "@playwright/test";
import {
  CHIPS,
  columns,
  deleteButton,
  expectLit,
  exportRow,
  exportText,
  fret,
  latch,
  stackLatch,
  STACK,
  startCapturing,
} from "./probe-helpers";

for (const c of CHIPS) {
  test(`${c.name}: delete back onto a barline leaves stack dark, the chip lit and truthful`, async ({ page }) => {
    const { songUrl } = await startCapturing(page);
    await fret(page, "A", 5).click();
    await page.getByTitle("Barline").click();
    await fret(page, "A", 7).click();
    await expect(columns(page)).toHaveCount(3);
    await stackLatch(page).click();
    await latch(page, c.name).click();
    await expectLit(page, [STACK, c.name]);

    await deleteButton(page).click();
    await expect(columns(page)).toHaveCount(2);
    await expectLit(page, [c.name]);

    await fret(page, "A", 9).click();
    await expect(columns(page)).toHaveCount(3);
    await expectLit(page, []);
    const text = await exportText(page, songUrl);
    expect(exportRow(text, "A")).toContain(`5-|${c.glyph}9`);
  });
}
