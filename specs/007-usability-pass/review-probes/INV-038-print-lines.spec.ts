/**
 * INV-038, FR-055, round 2: T136 wraps a bar wider than the page in print. The earlier probe asks only that no run
 * overflows, and reads the labels on screen. FR-055 says labels repeat on each line and INV-038 that no label leaves its
 * line, so this reads each printed line's first string against a gutter label, under print emulation, at page widths.
 * Lines are found from column rects, which share nothing with the gutter's own arithmetic.
 */
import { expect, test, type Page } from "@playwright/test";
import { bar, n, seedSong, type Col } from "../../../e2e/reading-helpers";

test.setTimeout(120_000);

const q = (fret: number, over: Col = {}) => n(fret, { d: "q", ...over });

const SHAPES: { name: string; columns: Col[] }[] = [
  { name: "one bar wider than a line", columns: Array.from({ length: 160 }, (_, i) => q(i % 2 ? 12 : 3)) },
  {
    name: "a wide bar between two short ones",
    columns: [q(3), q(5), bar(), ...Array.from({ length: 120 }, (_, i) => q(i % 2 ? 12 : 3)), bar(), q(3), q(5)],
  },
];

const printed = (page: Page) =>
  page.evaluate(() => {
    const out: { lines: number; labelled: number; firstBad: string | null; columns: number; shown: number }[] = [];
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
      const right = staff.getBoundingClientRect().right;
      out.push({
        lines: tops.length,
        labelled: labelled.length,
        firstBad: tops.find((t) => !labelled.includes(t))?.toString() ?? null,
        columns: cols.length,
        shown: cols.filter((c) => c.getBoundingClientRect().right <= right + 1).length,
      });
    }
    return out;
  });

for (const shape of SHAPES) {
  for (const width of [600, 794]) {
    test(`INV-038 print at ${width}: ${shape.name}: every line has its labels`, async ({ page, isMobile }) => {
      test.skip(isMobile, "paper has no pointer");
      const { playUrl } = await seedSong(page, [{ key: "a", label: "A", columns: shape.columns }], [{ part: "a" }]);
      await page.setViewportSize({ width, height: 1100 });
      await page.goto(playUrl);
      await expect(page.getByTestId("tab-staff").first()).toBeVisible();
      await page.emulateMedia({ media: "print" });
      // CANDIDATE=1: every printed line on the gutter's grid, and enough gutter blocks to cover them, the surplus clipped.
      if (process.env.CANDIDATE) {
        await page.addStyleTag({ content: "@media print { .tab-bar-run { row-gap: var(--line-gap); } }" });
        await page.evaluate(() => {
          for (const gutter of document.querySelectorAll(".tab-gutter")) {
            const block = gutter.querySelector(".tab-gutter-block")!;
            for (let i = 0; i < 12; i++) gutter.append(block.cloneNode(true));
          }
        });
      }
      await page.waitForTimeout(150);
      const seen = await printed(page);
      console.log(`${shape.name} @${width}: ${JSON.stringify(seen)}`);
      for (const staff of seen) {
        expect(staff.shown, "every column inside the page").toBe(staff.columns);
        expect(staff.labelled, `${staff.lines} printed lines, ${staff.labelled} with their labels`).toBe(staff.lines);
      }
    });
  }
}
