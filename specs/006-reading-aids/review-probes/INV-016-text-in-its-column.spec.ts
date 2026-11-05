/**
 * The ink of every cell against its column, not just the cell's box.
 *
 * A `.tab-cell` is as wide as its column whatever it holds, so comparing boxes cannot see text that runs out of
 * one. Column widths come from `.length` in `ch` (research R3), which is only true of a monospaced face, and
 * `.tab-staff` does not get one: `--font-mono` is declared on `:root` and `--font-mono-face` only on `<body>`,
 * so the declaration is invalid at computed time and the staff inherits the system stack. Both faces are run:
 * as shipped, and with the variables moved to `<html>`, which is what the plan and research assumed.
 */
import { expect, test, type Page } from "@playwright/test";
import { bar, choose, n, seedSong, SIZES, VIEWS, type Col } from "./helpers";

const WIDEST = { 2: ["tap", "let_ring", "bend", "vibrato", "palm_mute"] };
const chords = ["Am", "Db", "F#", "Cmaj7#11", "Ebm7b5"];
const columns: Col[] = chords.flatMap((chord) => [
  ...Array.from({ length: 12 }, (_, fret) => n(fret, { chord: fret === 0 ? chord : undefined, techniques: WIDEST })),
  ...Array.from({ length: 12 }, (_, fret) => n(fret + 12, { techniques: { 2: ["palm_mute"] } })),
  bar(),
]);

const family = (page: Page) => page.evaluate(() => getComputedStyle(document.querySelector(".tab-staff")!).fontFamily);

/** The fix the plan assumed had already happened. */
const asMeant = async (page: Page) => {
  await page.evaluate(() => {
    document.documentElement.className = [...document.body.classList].filter((c) => c.endsWith("_variable")).join(" ");
  });
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => family(page)).toContain("JetBrains");
};

const overruns = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    for (const column of document.querySelectorAll('[data-testid="tab-column"]')) {
      const c = column.getBoundingClientRect();
      for (const span of column.querySelectorAll(".tab-cell span")) {
        const range = document.createRange();
        range.selectNodeContents(span);
        const r = range.getBoundingClientRect();
        const over = Math.max(c.left - r.left, r.right - c.right);
        if (over > 1) out.push(`${span.textContent} over by ${over.toFixed(1)}px`);
      }
    }
    return [...new Set(out)];
  });

for (const size of SIZES) {
  for (const face of ["as shipped", "as meant"] as const) {
    test(`INV-016 every cell's text inside its column: ${size.name}, ${face}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await seedSong(page, [{ key: "a", label: "A", columns }], [{ part: "a" }]);
      if (face === "as meant") await asMeant(page);
      const seen: string[] = [];
      for (const density of ["expanded", "compact"] as const) {
        await page.getByRole("button", { name: density, exact: true }).click();
        for (const view of VIEWS) {
          await choose(page, view);
          for (const over of await overruns(page)) seen.push(`${density} ${view}: ${over}`);
        }
      }
      expect(seen).toEqual([]);
    });
  }
}
