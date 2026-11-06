/**
 * INV-017, round 3. Round 2 read the song page's compact density in frets only and listed the rest as not checked. Compact
 * and the view control sit in the same panel, so **V** reaches compact through the screen. Each row's item against its own
 * column, by rects, at both sizes. A `×N` column is what compact exists for, so the staff holds one.
 */
import { expect, test, type Page } from "@playwright/test";
import { bar, n, seedSong, type Col } from "../../../e2e/reading-helpers";
import { openTools } from "../../../e2e/usability-helpers";

test.setTimeout(120_000);

const q = (fret: number, over: Col = {}) => n(fret, { d: "q", ...over });
const STAFF: Col[] = [q(3, { chord: "Am" }), q(12), q(3, { repeat: 4 }), bar(), q(5, { chord: "Cmaj7" }), q(7), bar(), q(12, { repeat: 3 }), q(3)];

const measure = (page: Page) =>
  page.evaluate(() => {
    const bad: string[] = [];
    let rows = 0;
    for (const col of document.querySelectorAll('[data-testid="tab-column"]')) {
      const c = col.getBoundingClientRect();
      for (const item of col.querySelectorAll('[data-testid="tab-bar-number"], [data-testid="tab-bracket"], .tab-cell')) {
        rows += 1;
        const r = item.getBoundingClientRect();
        if (r.left < c.left - 1 || r.left > c.right + 1) bad.push(`${item.className || item.getAttribute("data-testid")} off its column by ${Math.round(r.left - c.left)}`);
      }
      const chord = col.querySelector(":scope > div.text-accent");
      if (chord?.textContent) {
        const range = document.createRange();
        range.selectNodeContents(chord);
        const r = range.getBoundingClientRect();
        if (Math.abs(r.left - c.left) > 1) bad.push(`chord off its column by ${Math.round(r.left - c.left)}`);
      }
    }
    return { rows, bad: [...new Set(bad)] };
  });

for (const view of ["notes", "intervals"] as const) {
  for (const size of [{ width: 375, height: 667 }, { width: 1280, height: 800 }]) {
    test(`INV-017 song page compact in ${view} at ${size.width}`, async ({ page }) => {
      const { songUrl } = await seedSong(page, [{ key: "a", label: "A", columns: STAFF }], [{ part: "a" }]);
      await page.setViewportSize(size);
      await page.goto(songUrl);
      await openTools(page);
      await page.getByRole("button", { name: /compact/i }).first().click();
      await page.getByTestId(`staff-view-${view}`).first().click();
      await page.waitForTimeout(250);
      const seen = await measure(page);
      console.log(`compact ${view} @${size.width}: ${seen.rows} rows, ${JSON.stringify(seen.bad)}`);
      expect(seen.rows, "the staff is drawn").toBeGreaterThan(10);
      expect(seen.bad).toEqual([]);
    });
  }
}
