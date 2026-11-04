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
  columns,
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
          // FR-020: a string that cannot fit above the fretboard must at least be reachable by scrolling.
          // Four and five strings sit inside the band as the screen opens; six are reached by a
          // swipe (the last test in this file), because they cannot all fit above the fretboard.
          if (tuning.strings <= 5) {
            expect(rest.stringsClipped, "every string inside the band at rest").toBe(0);
            expect(selecting.stringsClipped, "every string inside the band while selecting").toBe(0);
          } else {
            // FR-020 as amended: six strings may leave one out of view, the rest reached by a swipe.
            // A chord row on top still costs a second string (review-probes/INV-013-band.spec.ts is
            // pinned to the amended limit of one and stays red for it): hold that line here so it
            // cannot get worse, and tighten it to one when the band is fixed.
            const hidden = chord ? 2 : 1;
            expect(rest.stringsClipped, "strings out of view at rest").toBeLessThanOrEqual(hidden);
            expect(selecting.stringsClipped, "strings out of view while selecting").toBeLessThanOrEqual(hidden);
          }
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

/** A finger on the band, as raw touch events: synthesizeScrollGesture moves nothing here. */
async function swipe(page: Page, y: number) {
  const band = await page.evaluate(() => {
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    let scroller = staff.parentElement as HTMLElement | null;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    const r = scroller!.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
  });
  const column = (await columns(page).first().boundingBox())!;
  const x = column.x + column.width / 2;
  const from = y < 0 ? band.bottom - 8 : band.top + 8;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: from }] });
  for (let i = 1; i <= 15; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: from + (y / 15) * i }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(300);
}

const reach = (page: Page) =>
  page.evaluate(() => {
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    let scroller = staff.parentElement as HTMLElement | null;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    const band = scroller!.getBoundingClientRect();
    const cells = [...staff.querySelector('[data-testid="tab-column"]')!.querySelectorAll(".tab-cell")].map((c) =>
      c.getBoundingClientRect(),
    );
    const line = document.querySelector('[data-testid="tab-bracket"]')?.getBoundingClientRect();
    return {
      firstCellAbove: band.top - cells[0].top,
      lastCellBelow: cells.at(-1)!.bottom - band.bottom,
      bracketAbove: line ? band.top - line.top : null,
    };
  });

/**
 * The strings are not the only thing the band has to hold. The bracket is what the three new
 * controls produce, so a bracket above the band is a tap with no visible result. Four and five
 * strings fit at rest. Six cannot, so a swipe has to reach every string and the bracket.
 */
for (const tuning of TUNINGS) {
  for (const chord of [false, true]) {
    const name = `${tuning.strings} strings${chord ? " and a chord row" : ""}`;
    test(
      tuning.strings <= 5 ? `the bracket shows, ${name}` : `a swipe reaches every string and the bracket, ${name}`,
      async ({ page }, info) => {
        test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
        await startWith(page, tuning);
        await addRests(page, 3);
        await selectColumns(page, 0, 2);
        await groupControl(page).click();
        await expect(brackets(page)).toHaveCount(1);
        if (chord) await setChordOn(page, 0, "Am");
        // A click scrolls the band: measure after a reload and touch nothing.
        await page.reload();
        await expect(columns(page)).toHaveCount(3);
        await expect(brackets(page)).toHaveCount(1);
        if (tuning.strings <= 5) {
          const seen = await reach(page);
          expect(seen.bracketAbove, "the bracket is inside the band").toBeLessThanOrEqual(0);
          expect(seen.firstCellAbove, "the top string is inside the band").toBeLessThanOrEqual(1);
          expect(seen.lastCellBelow, "the bottom string is inside the band").toBeLessThanOrEqual(1);
          return;
        }
        await swipe(page, -120);
        expect((await reach(page)).lastCellBelow, "the bottom string can be scrolled in").toBeLessThanOrEqual(1);
        await swipe(page, 120);
        const up = await reach(page);
        expect(up.firstCellAbove, "the top string can be scrolled in").toBeLessThanOrEqual(1);
        expect(up.bracketAbove, "the bracket can be scrolled in").toBeLessThanOrEqual(0);
      },
    );
  }
}

/** Whether a scrolled band holds still under the taps that follow it. */
test("the band stays where a capturer put it across a barline tap", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch gestures need the touch project");
  await startWith(page, TUNINGS[2]);
  await addRests(page, 3);
  await selectColumns(page, 0, 2);
  await groupControl(page).click();
  await expect(brackets(page)).toHaveCount(1);
  await page.reload();
  await expect(columns(page)).toHaveCount(3);
  await expect(brackets(page)).toHaveCount(1);
  const scrollTop = () =>
    page.evaluate(() => {
      let el = document.querySelector('[data-testid="tab-staff"]')!.parentElement as HTMLElement | null;
      while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) el = el.parentElement;
      return Math.round(el!.scrollTop * 10) / 10;
    });
  // Away from wherever the band rests, so this holds for a top or a bottom anchor.
  await swipe(page, -120);
  if ((await scrollTop()) === 0) await swipe(page, 120);
  const before = await scrollTop();
  expect(Math.abs(before), "the swipe moved the band").toBeGreaterThan(0);
  await page.getByRole("button", { name: "Barline" }).click();
  await expect(columns(page)).toHaveCount(3);
  expect(await scrollTop()).toBe(before);
});
