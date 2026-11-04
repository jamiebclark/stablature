/**
 * INV-013 / FR-018 / FR-020 / SC-009, over what the plan enumerates: 2 themes x 3 string counts
 * x {bracket, bracket and chord row} x numeral {3, 16}, with all seven controls truly present.
 *
 * The suite's tests of the same name do not reach this: e2e/grouping-layout.spec.ts:254 never
 * sets a tuning (its 4, 5 and 6 all run on the default five-string), its "seven controls" case
 * has no group in the selection so it shows six, and its band check compares cells to
 * `tab-staff`, the content, which cannot clip itself. This measures the scroller that does.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  addRests,
  brackets,
  cancelSelection,
  groupControl,
  measureBand,
  selectColumns,
  selectionBar,
  setChordOn,
  stable,
  startWith,
  THEMES,
  TUNINGS,
  tupletControl,
} from "./probe-helpers";

test.describe.configure({ mode: "parallel" });

/**
 * Undoes Playwright's `click`, which scrolls this band as no finger does: it left the chord-row
 * cells at scrollTop -52 and read 2 strings where a capturer sees 1. T074 asked for this and it
 * was missed, so round 4 added it. INV-013-real-taps.spec.ts measures the same states with no
 * click at all, and the two agree.
 */
const putBandBack = (page: Page) =>
  page.evaluate(() => {
    let el = document.querySelector('[data-testid="tab-staff"]')!.parentElement as HTMLElement | null;
    while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) el = el.parentElement;
    el!.scrollTop = 0;
  });

for (const theme of THEMES) {
  for (const tuning of TUNINGS) {
    for (const chord of [false, true]) {
      for (const n of [3, 16]) {
        const name = `${theme}, ${tuning.strings} strings, ${chord ? "bracket and chord row" : "bracket"}, numeral ${n}`;
        test(name, async ({ page }, info) => {
          test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
          await page.emulateMedia({ colorScheme: theme });
          await startWith(page, tuning);
          await addRests(page, n);
          await selectColumns(page, 0, 1);
          await tupletControl(page).click();
          if (chord) await setChordOn(page, 0, "Am");

          await putBandBack(page);
          const rest = await measureBand(page);
          const stableTop = (await stable(page).boundingBox())!.y;

          await selectColumns(page, 0, n - 1);
          const bar = selectionBar(page);
          const names = await bar
            .getByRole("button")
            .evaluateAll((els) =>
              els.map((e) => e.getAttribute("aria-label") ?? e.textContent?.trim() ?? ""),
            );
          expect(names).toEqual([
            "copy",
            "cut",
            "delete",
            `Make a tuplet of ${n}`,
            "Group with no number",
            "Ungroup",
            "cancel",
          ]);

          const fits = await bar.evaluate((el) => ({
            row: el.scrollWidth <= el.clientWidth,
            kids: [...el.children].every((c) => c.scrollWidth <= c.clientWidth),
            lines: new Set([...el.children].map((c) => Math.round(c.getBoundingClientRect().top))).size,
            tallest: Math.max(...[...el.children].map((c) => c.getBoundingClientRect().height)),
            right: Math.max(...[...el.children].map((c) => c.getBoundingClientRect().right)),
            edge: el.getBoundingClientRect().right,
          }));
          await putBandBack(page);
          const selecting = await measureBand(page);
          console.log(JSON.stringify({ name, rest, selecting, fits }));

          expect(fits.row).toBe(true);
          expect(fits.kids).toBe(true);
          expect(fits.lines).toBe(1);
          expect(fits.tallest).toBeLessThanOrEqual(36.5);
          expect(fits.right).toBeLessThanOrEqual(fits.edge);
          expect((await stable(page).boundingBox())!.y).toBe(stableTop);
          expect(selecting.band).toBeGreaterThanOrEqual(rest.band);
          expect(selecting.strings).toBe(tuning.strings);
          expect(selecting.pageOver).toBeLessThanOrEqual(0);
          // The plan's "each string inside the band", at both rest and selection.
          // FR-020 as amended: six strings may leave one out of view (a swipe reaches it).
          const hidden = tuning.strings >= 6 ? 1 : 0;
          expect(rest.stringsClipped, "strings clipped at rest").toBeLessThanOrEqual(hidden);
          expect(selecting.stringsClipped, "strings clipped while selecting").toBeLessThanOrEqual(hidden);
          await cancelSelection(page);
        });
      }
    }
  }
}

test("six and four control states keep the order", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
  await startWith(page, TUNINGS[1]);
  await addRests(page, 4);
  const order = () =>
    selectionBar(page)
      .getByRole("button")
      .evaluateAll((els) =>
        els.map((e) => e.getAttribute("aria-label") ?? e.textContent?.trim() ?? ""),
      );
  await selectColumns(page, 0, 3);
  expect(await order()).toEqual([
    "copy",
    "cut",
    "delete",
    "Make a tuplet of 4",
    "Group with no number",
    "cancel",
  ]);
  await cancelSelection(page);
  await selectColumns(page, 0, 0);
  expect(await order()).toEqual(["copy", "cut", "delete", "cancel"]);
});

/**
 * The strings are not the only thing the band has to hold. The bracket is what the three new
 * controls produce, so a bracket above the band is a tap with no visible result. `justify-end`
 * on an `overflow-y-auto` flex column puts its overflow past the scroll origin, where no
 * scrolling reaches: scrollHeight equals clientHeight, so this is measured, not assumed.
 */
for (const tuning of TUNINGS) {
  for (const chord of [false, true]) {
    test(`the bracket shows, ${tuning.strings} strings${chord ? " and a chord row" : ""}`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
      await startWith(page, tuning);
      await addRests(page, 3);
      await selectColumns(page, 0, 2);
      await groupControl(page).click();
      await expect(brackets(page)).toHaveCount(1);
      if (chord) await setChordOn(page, 0, "Am");
      const seen = await page.evaluate(() => {
        const line = document.querySelector('[data-testid="tab-bracket"][data-start]')!;
        const staff = document.querySelector('[data-testid="tab-staff"]')!;
        let scroller = staff.parentElement as HTMLElement | null;
        while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
          scroller = scroller.parentElement;
        }
        const band = scroller!.getBoundingClientRect();
        const r = line.getBoundingClientRect();
        return {
          band: band.height,
          scrollable: scroller!.scrollHeight - scroller!.clientHeight,
          aboveBandBy: Math.round((band.top - r.top) * 10) / 10,
          under: document
            .elementFromPoint(r.left + r.width / 2, r.top + 1)
            ?.closest('[data-testid="tab-staff"]') !== null,
        };
      });
      console.log(JSON.stringify({ strings: tuning.strings, chord, ...seen }));
      // Six strings reach the bracket by a swipe (INV-013-reachable.spec.ts), not at rest.
      if (tuning.strings < 6) {
        expect(seen.aboveBandBy, "the bracket is inside the band").toBeLessThanOrEqual(0);
      }
    });
  }
}
