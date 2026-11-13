/**
 * Adopted from the round-1 review probe, spec 008 INV-007 member "followTail on the wide bar": with the cursor at the end of a part whose last
 * bar is wider than the band, each fret tap keeps the new column and the caret in view inside that bar's run, on a
 * wrapped band (412×915), as it does on the one-line staff (375×667). The implementation's unit test for this
 * (TabStaff.wrapped-capture.test.tsx "follows the tail") asserts nothing.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns } from "./probe-helpers";
import { longPart, seedBars, SIX } from "./polish-review-helpers";

test.setTimeout(300_000);

const fretButton = (page: Page) => page.locator('button[aria-label*=" string, fret 3,"]').first();

/** The caret and the last column, against the visible rect of the element that scrolls them sideways. */
const tailSeen = (page: Page) =>
  page.evaluate(() => {
    const caret = document.querySelector('[data-testid="tab-caret"]');
    const cols = document.querySelectorAll('[data-testid="tab-column"]');
    const last = cols[cols.length - 1];
    const box = (caret?.closest(".tab-bar-run") ?? document.querySelector('[data-testid="tab-staff"]')!.parentElement!).getBoundingClientRect();
    const inside = (el: Element | null) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.left >= box.left - 2 && r.right <= box.right + 2;
    };
    return { caret: inside(caret), last: inside(last) };
  });

for (const size of [{ width: 412, height: 915 }, { width: 375, height: 667 }]) {
  test(`INV-007 followTail keeps the tail in view on a wide last bar, ${size.width}x${size.height}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "touch");
    await longPart(page, { chord: true, bracket: true, bars: 2, perBar: 3, size });
    const partId = page.url().split("/").pop()!;
    await seedBars(page, partId, SIX.strings, 1, 60);
    await page.reload();
    await page.waitForTimeout(700);
    const wrapped = (await page.locator(".tab-staff-wrapped").count()) === 1;
    expect(wrapped, "wrapped only at 412x915").toBe(size.width === 412);
    await page.getByTestId("status-row").getByRole("button", { name: "end ⇥" }).click();
    await page.waitForTimeout(400);
    const bad: string[] = [];
    const before = await columns(page).count();
    for (let i = 0; i < 6; i++) {
      await fretButton(page).click();
      await page.waitForTimeout(250);
      const seen = await tailSeen(page);
      if (!seen.caret) bad.push(`tap ${i + 1}: caret out of view`);
      if (!seen.last) bad.push(`tap ${i + 1}: the new column out of view`);
    }
    await expect(columns(page)).toHaveCount(before + 6);
    expect(bad).toEqual([]);
  });
}
