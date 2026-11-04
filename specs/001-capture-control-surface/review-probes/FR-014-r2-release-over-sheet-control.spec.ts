/**
 * FR-014 / INV-009 (round 2): the sheet opens while the finger is still down, and the
 * click that ends a touch press is hit-tested where the finger lifts (round 1's trace:
 * `click(touch) on DIALOG`). F2's fix stopped that click dismissing the sheet. It does
 * nothing for a finger that lifts over one of the sheet's CONTROLS, which is where a
 * bottom sheet ends up when the viewport is short or the sheet is tall.
 *
 * Enumerated: 375x667, each of 3 columns. Landscape is not a member: the staff is clipped
 * there on main as well (5 of 5 strings, see INV-012-r2-measure-any-build), so no column
 * can be pressed. The geometry assertion is what a later, taller sheet would trip first.
 */
import { expect, test } from "@playwright/test";
import { columns, fret, inspector, openDialog, startCapturing, touchHold } from "./helpers";

const SHAPES = [
  { name: "portrait 375x667", width: 375, height: 667 },
];

for (const shape of SHAPES) {
  for (const index of [0, 1, 2]) {
    test(`a touch hold edits nothing when the finger lifts - ${shape.name}, column ${index}`, async ({
      page,
    }, info) => {
      test.skip(info.project.name !== "mobile", "touch needs a touch device");
      await page.setViewportSize({ width: 375, height: 667 });
      await startCapturing(page);
      await fret(page, "E", 7).click();
      await fret(page, "A", 5).click();
      await fret(page, "D", 3).click();
      await expect(columns(page)).toHaveCount(3);
      await page.setViewportSize({ width: shape.width, height: shape.height });
      await page.waitForTimeout(100);

      const target = columns(page).nth(index);
      await target.scrollIntoViewIfNeeded();
      const box = (await target.boundingBox())!;

      await touchHold(page, target);
      await page.waitForTimeout(250);

      const open = await openDialog(page).count();
      const left = await columns(page).count();
      const sheet = open ? await openDialog(page).boundingBox() : null;
      console.log(
        `${shape.name} col ${index}: column ${JSON.stringify(box)} open=${open} columns=${left} sheet=${JSON.stringify(sheet)}`,
      );
      expect(left, "the finger lifting must not press a sheet control").toBe(3);
      expect(open, "the sheet is open after the finger lifts").toBe(1);
      expect(sheet!.y, "the sheet must open clear of the pressed column").toBeGreaterThan(box.y + box.height);
      await expect(inspector(page)).toBeVisible();
    });
  }
}
