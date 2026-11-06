/**
 * INV-038, FR-055, round 3. T167 prints a fixed count of spare gutter blocks, `min(columns, 40)`. Round 2 asked for the
 * count to have an upper bound from the part's width, and its own probe stopped at 160 columns, so nothing has measured
 * a bar that needs more lines than the spare blocks. This also crosses the print with each optional row, so a gutter
 * block's height is compared with a printed line that carries a chord, bracket, rhythm or diff row.
 * Lines come from column rects, which share nothing with the gutter's arithmetic.
 */
import { expect, test, type Page } from "@playwright/test";
import { bar, n, seedSong, type Col } from "../../../e2e/reading-helpers";

test.setTimeout(240_000);
test.skip(({ isMobile }) => isMobile, "paper has no pointer");

const q = (fret: number, over: Col = {}) => n(fret, { d: "q", ...over });
const run = (length: number, over: (i: number) => Col = () => ({})) =>
  Array.from({ length }, (_, i) => q(i % 2 ? 12 : 3, over(i)));

const SHAPES: { name: string; columns: Col[] }[] = [
  { name: "400 columns, no barline", columns: run(400) },
  { name: "900 columns, no barline", columns: run(900) },
  { name: "1400 columns, no barline", columns: run(1400) },
  { name: "a chord every eighth column", columns: run(160, (i) => (i % 8 === 0 ? { chord: "Am7" } : {})) },
  { name: "wide, then barlines", columns: [...run(120), bar(), q(3), bar(), q(5), bar(), ...run(120)] },
];

const printed = (page: Page) =>
  page.evaluate(() => {
    const out: { lines: number; labelled: number; firstBad: number | null; columns: number; blocks: number }[] = [];
    for (const staff of document.querySelectorAll(".tab-staff-wrapped")) {
      const cols = [...staff.querySelectorAll('[data-testid="tab-column"]')];
      const tops = [...new Set(cols.map((c) => Math.round(c.querySelector(".tab-cell")!.getBoundingClientRect().top)))].sort(
        (a, b) => a - b,
      );
      const gutter = staff.querySelector(".tab-gutter")!.getBoundingClientRect();
      const labels = [...staff.querySelectorAll(".tab-gutter-block")]
        .map((b) => b.querySelector(".tab-cell")!.getBoundingClientRect())
        .filter((r) => r.bottom <= gutter.bottom + 1)
        .map((r) => Math.round(r.top));
      const labelled = tops.filter((t) => labels.some((l) => Math.abs(l - t) <= 1));
      out.push({
        lines: tops.length,
        labelled: labelled.length,
        firstBad: tops.findIndex((t) => !labelled.includes(t)),
        columns: cols.length,
        blocks: staff.querySelectorAll(".tab-gutter-block").length,
      });
    }
    return out;
  });

for (const shape of SHAPES) {
  for (const width of [600, 794]) {
    test(`INV-038 print at ${width}: ${shape.name}: every line has its labels`, async ({ page }) => {
      const { playUrl } = await seedSong(page, [{ key: "a", label: "A", columns: shape.columns }], [{ part: "a" }]);
      await page.setViewportSize({ width, height: 1100 });
      await page.goto(playUrl);
      await expect(page.getByTestId("tab-staff").first()).toBeVisible();
      await page.emulateMedia({ media: "print" });
      await page.waitForTimeout(200);
      const seen = await printed(page);
      console.log(`PRINT ${shape.name} @${width}: ${JSON.stringify(seen)}`);
      for (const staff of seen) expect(staff.labelled, `${staff.lines} printed lines, ${staff.labelled} labelled`).toBe(staff.lines);
    });
  }
}
