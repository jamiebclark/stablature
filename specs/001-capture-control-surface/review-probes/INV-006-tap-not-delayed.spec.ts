/**
 * INV-006: never is a short tap on a column delayed, swallowed, or made
 * conditional on the long press not having fired.
 *
 * Enumerated: {notes, rest, barline} x {mouse, touch} + keyboard Enter = 7.
 * Touch members run only where the device has touch (the `mobile` project).
 * "Not delayed" is measured in-page: the gap between the pointerup/keyup and the
 * column gaining aria-current, read by a MutationObserver -- no waitForTimeout.
 * Plus two "not swallowed" members: a keyboard Enter on a column right after a
 * long press on it (mouse and touch) must still move the cursor.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  columns,
  fret,
  mouseHold,
  openDialog,
  space,
  startCapturing,
  touchHold,
} from "./helpers";

/** Notes, rest, barline, notes -- the last one keeps the cursor off the first three. */
async function build(page: Page) {
  await startCapturing(page);
  await fret(page, "E", 7).click();
  await space(page);
  await page.getByTitle("Barline").click();
  await fret(page, "A", 5).click();
  await expect(columns(page)).toHaveCount(4);
}

/** Install a recorder: ms from the last pointerup/keyup to aria-current landing on column i. */
async function arm(page: Page, index: number) {
  await page.evaluate((i) => {
    const w = window as unknown as { __gap?: number | null; __t?: number };
    w.__gap = null;
    const mark = () => (w.__t = performance.now());
    document.addEventListener("pointerup", mark, { capture: true });
    document.addEventListener("keyup", mark, { capture: true });
    document.addEventListener("keydown", mark, { capture: true });
    const col = document.querySelectorAll('[data-testid="tab-column"]')[i];
    new MutationObserver(() => {
      if (col.getAttribute("aria-current") === "true" && w.__gap === null) {
        w.__gap = performance.now() - (w.__t ?? performance.now());
      }
    }).observe(col, { attributes: true, attributeFilter: ["aria-current"] });
  }, index);
}

async function expectMovedNow(page: Page, col: Locator) {
  // Read once, no retry: the cursor must already be there.
  expect(await col.getAttribute("aria-current")).toBe("true");
  const gap = await page.evaluate(() => (window as unknown as { __gap: number | null }).__gap);
  expect(gap).not.toBeNull();
  expect(gap!).toBeLessThan(100);
  await expect(openDialog(page)).toHaveCount(0);
}

const KINDS = [
  { name: "notes", index: 0 },
  { name: "rest", index: 1 },
  { name: "barline", index: 2 },
] as const;

test.describe("INV-006 a tap is never delayed or swallowed", () => {
  for (const kind of KINDS) {
    test(`mouse tap on a ${kind.name} column`, async ({ page }) => {
      await build(page);
      await arm(page, kind.index);
      await columns(page).nth(kind.index).click();
      await expectMovedNow(page, columns(page).nth(kind.index));
    });

    test(`touch tap on a ${kind.name} column`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "touch needs a touch device");
      await build(page);
      await arm(page, kind.index);
      await columns(page).nth(kind.index).tap();
      await expectMovedNow(page, columns(page).nth(kind.index));
    });
  }

  test("keyboard Enter on a focused column", async ({ page }) => {
    await build(page);
    await arm(page, 0);
    await columns(page).nth(0).focus();
    await page.keyboard.press("Enter");
    await expectMovedNow(page, columns(page).nth(0));
  });

  test("keyboard Enter right after a mouse long press on the same column", async ({ page }) => {
    await build(page);
    await mouseHold(page, columns(page).nth(0));
    await expect(openDialog(page)).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(openDialog(page)).toHaveCount(0);
    await columns(page).nth(0).focus();
    await page.keyboard.press("Enter");
    await expect(columns(page).nth(0)).toHaveAttribute("aria-current", "true", { timeout: 300 });
  });

  test("keyboard Enter right after a touch long press on the same column", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "touch needs a touch device");
    await build(page);
    await touchHold(page, columns(page).nth(0));
    // Whether or not the sheet survived the finger lifting (see the touch trace
    // probe), get it out of the way without a pointer.
    if ((await openDialog(page).count()) > 0) await page.keyboard.press("Escape");
    await expect(openDialog(page)).toHaveCount(0);
    await columns(page).nth(0).focus();
    await page.keyboard.press("Enter");
    await expect(columns(page).nth(0)).toHaveAttribute("aria-current", "true", { timeout: 300 });
  });
});
