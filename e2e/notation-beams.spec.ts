/**
 * INV-002 and INV-006: beams join the right columns, by the hand-written table in contracts/beaming.md, and
 * their rects meet the stems and the column edges. Each bar is seeded raw, then read on every surface.
 */
import { expect, test } from "@playwright/test";
import { cols } from "./rhythm-probe-helpers";
import { cells, open, seeded, SURFACES } from "./notation-helpers";

type Pair = [number, number] | null; // [left, right]; null = no beam attributes (barline)

/** Corp rows 1, 2, 6, 20 and 23 written out by hand; `|` is a barline. */
const BARS: { n: number; list: ReturnType<typeof cols>; want: Pair[] }[] = [
  { n: 1, list: cols(..."8 8 8 8 8 8 8 8".split(" ")), want: [[0, 1], [1, 0], [0, 1], [1, 0], [0, 1], [1, 0], [0, 1], [1, 0]] },
  { n: 2, list: cols(..."16 16 8 16 8 16".split(" ")), want: [[0, 2], [2, 1], [1, 0], [0, 1], [1, 1], [1, 0]] },
  { n: 6, list: cols("8", "|", "8", "8", "|", "8"), want: [[0, 0], null, [0, 1], [1, 0], null, [0, 0]] },
  { n: 20, list: cols("w", "|", "h", "h", "|", "q", "q", "q", "q"), want: [[0, 0], null, [0, 0], [0, 0], null, [0, 0], [0, 0], [0, 0], [0, 0]] },
  { n: 23, list: cols(...Array(8).fill("32")), want: [[0, 3], [3, 3], [3, 3], [3, 3], [3, 3], [3, 3], [3, 3], [3, 0]] },
];

const TOL = 1;

for (const surface of SURFACES) {
  for (const bar of BARS) {
    test(`INV-002 INV-006 Corp ${bar.n} beams, ${surface}`, async ({ page }) => {
      const urls = await seeded(page, bar.list);
      await open(page, surface, urls);
      await expect(page.getByTestId("tab-column")).toHaveCount(bar.list.length);
      const got = await cells(page);
      expect(got.map((c) => (c.left === null || c.right === null ? null : [c.left, c.right]))).toEqual(bar.want);

      for (const [i, c] of got.entries()) {
        if (c.rhythm !== "note") {
          expect(c.parts.filter((p) => p.part === "beam" || p.part === "stub"), `no beam in cell ${i}`).toEqual([]);
          continue;
        }
        // A joined neighbour is on the same line: a wrapped line's last column joins nothing.
        if (c.right) expect(Math.abs(got[i + 1].box.y - c.box.y)).toBeLessThan(2);
        if (c.left) expect(Math.abs(got[i - 1].box.y - c.box.y)).toBeLessThan(2);
        const centre = c.box.x + c.box.width / 2;
        for (const p of c.parts.filter((q) => q.part === "beam" || q.part === "stub")) {
          if (p.side === "left") {
            if (p.part === "beam") expect(Math.abs(p.x - c.box.x)).toBeLessThanOrEqual(TOL);
            expect(Math.abs(p.x + p.width - centre)).toBeLessThanOrEqual(TOL);
          } else if (p.side === "right") {
            expect(Math.abs(p.x - centre)).toBeLessThanOrEqual(TOL);
            if (p.part === "beam") expect(Math.abs(p.x + p.width - (c.box.x + c.box.width))).toBeLessThanOrEqual(TOL);
          }
        }
        // Across a gap the right half and the next left half leave no hole.
        if (c.right && got[i + 1].left) {
          const hole = got[i + 1].box.x - (c.box.x + c.box.width);
          if (hole > TOL) {
            const spacers = await page
              .locator('[data-testid="tab-connector"] [data-part="beam"]:not([data-side])')
              .count();
            expect(spacers, `a gap of ${hole}px with no spacer beam`).toBeGreaterThan(0);
          }
        }
      }
    });
  }
}
