/**
 * INV-013 / FR-020 / SC-009, round 2. T060 answered F1 with "reachable" (`mt-auto` in place of
 * `justify-end`), and e2e/grouping-band.spec.ts now asserts only that the band can scroll at all.
 * These measure what a capturer actually gets, with nothing having touched the scroller.
 *
 * Playwright's `click` scrolls its target into view, so a column click moves this band. Every
 * resting measurement here therefore follows a reload, and no column is clicked after it.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  addRests,
  brackets,
  columns,
  groupControl,
  openDialog,
  selectColumns,
  setChordOn,
  startWith,
  status,
  TUNINGS,
} from "./probe-helpers";

/** Every row of the staff against the scroller's edges, in px. Negative `below` is inside. */
const geometry = (page: Page) =>
  page.evaluate(() => {
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    let scroller = staff.parentElement as HTMLElement | null;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    const band = scroller!.getBoundingClientRect();
    const column = staff.querySelector('[data-testid="tab-column"]')!;
    const cells = [...column.querySelectorAll(".tab-cell")].map((c) => c.getBoundingClientRect());
    const line = document.querySelector('[data-testid="tab-bracket"]')?.getBoundingClientRect();
    const round = (n: number) => Math.round(n * 10) / 10;
    return {
      band: round(band.height),
      scrollTop: round(scroller!.scrollTop),
      scrollable: round(scroller!.scrollHeight - scroller!.clientHeight),
      staff: round(staff.getBoundingClientRect().height),
      cell: round(cells[0].height),
      firstCellAbove: round(band.top - cells[0].top),
      lastCellBelow: round(cells.at(-1)!.bottom - band.bottom),
      outside: cells.filter((r) => r.top < band.top - 1 || r.bottom > band.bottom + 1).length,
      /** A string's line runs through the middle of its cell: past that, the string is gone. */
      linesGone: cells.filter(
        (r) => (r.top + r.bottom) / 2 > band.bottom || (r.top + r.bottom) / 2 < band.top,
      ).length,
      bracketAbove: line ? round(band.top - line.top) : null,
    };
  });

async function parked(page: Page, tuning: (typeof TUNINGS)[number], chord: boolean) {
  await startWith(page, tuning);
  await addRests(page, 3);
  await selectColumns(page, 0, 2);
  await groupControl(page).click();
  // Wait for the write: a reload straight after the tap can lose it, and the row with it.
  await expect(brackets(page)).toHaveCount(1);
  if (chord) await setChordOn(page, 0, "Am");
  await page.reload();
  await expect(columns(page)).toHaveCount(3);
  await expect(brackets(page)).toHaveCount(1);
}

/**
 * A real finger, as raw touch events from a column near the band's edge. `synthesizeScrollGesture`
 * moves nothing in this harness, not even a control scroller (INV-013-touch-control.spec.ts).
 * Negative `y` scrolls down.
 */
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

for (const tuning of TUNINGS) {
  for (const chord of [false, true]) {
    const name = `${tuning.strings} strings${chord ? " and a chord row" : ""}`;

    test(`every string is inside the band at rest, ${name}`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
      await parked(page, tuning, chord);
      const at = await geometry(page);
      console.log(JSON.stringify({ name, at }));
      // FR-020 as amended: at most one string out of view at rest for six, none for four and five.
      expect(at.outside, "strings outside the band as the screen opens").toBeLessThanOrEqual(
        tuning.strings >= 6 ? 1 : 0,
      );
      expect(at.linesGone, "strings gone from the band as the screen opens").toBeLessThanOrEqual(
        tuning.strings >= 6 ? 1 : 0,
      );
    });

    test(`a swipe reaches every string and the bracket, ${name}`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "touch gestures need the touch project");
      await parked(page, tuning, chord);
      const start = await geometry(page);
      test.skip(start.scrollable === 0, "nothing to reach");
      const statusBefore = await status(page).textContent();
      await swipe(page, -120);
      const down = await geometry(page);
      await expect(openDialog(page), "a swipe is not a long press").toHaveCount(0);
      expect(await status(page).textContent(), "a swipe is not a tap").toBe(statusBefore);
      await swipe(page, 120);
      const up = await geometry(page);
      console.log(JSON.stringify({ name, start, down, up }));
      expect(down.lastCellBelow, "the bottom string can be scrolled in").toBeLessThanOrEqual(1);
      expect(up.bracketAbove, "the bracket can be scrolled in").toBeLessThanOrEqual(0);
    });
  }
}

/** Whether a scrolled band holds still under the taps that follow it. */
test("the band stays where a capturer put it across a barline tap", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch gestures need the touch project");
  await parked(page, TUNINGS[2], false);
  // Away from wherever the band rests, so this holds for a top or a bottom anchor.
  await swipe(page, -120);
  if ((await geometry(page)).scrollTop === 0) await swipe(page, 120);
  const before = await geometry(page);
  expect(Math.abs(before.scrollTop), "the swipe moved the band").toBeGreaterThan(0);
  await page.getByRole("button", { name: "Barline" }).click();
  await expect(columns(page)).toHaveCount(3);
  const after = await geometry(page);
  console.log(JSON.stringify({ before, after }));
  expect(after.scrollTop).toBe(before.scrollTop);
});

