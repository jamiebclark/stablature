/**
 * INV-013 / FR-020 / SC-009 as amended on 2026-11-04, round 4: at most one string of a six-string
 * part out of view, at rest AND while selecting, none of four or five.
 *
 * INV-013-band.spec.ts measures after Playwright's `click`, and a click scrolls its target into
 * view, which moves this band. No finger does that. T074 asked for a measurement with "no
 * Playwright auto-scroll" and got one at rest only (INV-013-reachable.spec.ts), so the state the
 * amended sentence names second, "while selecting", had never been measured through real input.
 * Here the band is never touched: fresh load, then `touchscreen.tap` at a point already on screen.
 *
 * Enumerates the plan's set: 2 themes x 3 string counts x {bracket, bracket and chord row} x
 * numeral {3, 16}, at three moments: rest, selecting with all seven controls, and after the action.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  addRests,
  brackets,
  columns,
  selectColumns,
  selectionBar,
  setChordOn,
  startWith,
  THEMES,
  TUNINGS,
  tupletControl,
} from "./probe-helpers";

/** Every row of the staff against the scroller's edges. Same rules as measureBand's `stringsClipped`. */
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
    const round = (n: number) => Math.round(n * 10) / 10;
    return {
      band: round(band.height),
      scrollTop: round(scroller!.scrollTop),
      /** The same test measureBand applies, so the two probes can be compared cell by cell. */
      stringsClipped: cells.filter((r) => r.top < band.top - 1 || r.bottom > band.bottom + 1).length,
      /** A string's line runs through the middle of its cell. */
      linesGone: cells.filter(
        (r) => (r.top + r.bottom) / 2 > band.bottom || (r.top + r.bottom) / 2 < band.top,
      ).length,
      pageOver: document.scrollingElement!.scrollHeight - document.scrollingElement!.clientHeight,
    };
  });

/** A finger on column `index`, at a point inside the band. Nothing here scrolls the band. */
async function tapColumn(page: Page, index: number) {
  const at = await page.evaluate((i) => {
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    const col = staff.querySelectorAll('[data-testid="tab-column"]')[i] as HTMLElement;
    let across = col.parentElement as HTMLElement | null;
    while (across && !/(auto|scroll)/.test(getComputedStyle(across).overflowX)) {
      across = across.parentElement;
    }
    // A sideways swipe, which a capturer does to reach a column: horizontal only.
    if (across) {
      const a = across.getBoundingClientRect();
      const c = col.getBoundingClientRect();
      if (c.left < a.left || c.right > a.right) across.scrollLeft += c.left - a.left - 16;
    }
    let down = staff.parentElement as HTMLElement | null;
    while (down && !/(auto|scroll)/.test(getComputedStyle(down).overflowY)) {
      down = down.parentElement;
    }
    const band = down!.getBoundingClientRect();
    const r = col.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: Math.min(r.bottom, band.bottom) - 14 };
  }, index);
  await page.touchscreen.tap(at.x, at.y);
}

async function parked(page: Page, tuning: (typeof TUNINGS)[number], chord: boolean, n: number) {
  await startWith(page, tuning);
  await addRests(page, n);
  await selectColumns(page, 0, 1);
  await tupletControl(page).click();
  await expect(brackets(page)).toHaveCount(1);
  if (chord) await setChordOn(page, 0, "Am");
  // Wipes every scroll Playwright's clicks caused, as opening the screen does.
  await page.reload();
  await expect(columns(page)).toHaveCount(n);
  await expect(brackets(page)).toHaveCount(1);
}

for (const theme of THEMES) {
  for (const tuning of TUNINGS) {
    for (const chord of [false, true]) {
      for (const n of [3, 16]) {
        const name = `${theme}, ${tuning.strings} strings, ${chord ? "bracket and chord row" : "bracket"}, numeral ${n}`;
        test(name, async ({ page }, info) => {
          test.skip(info.project.name !== "mobile", "touch input needs the touch project");
          await page.emulateMedia({ colorScheme: theme });
          await parked(page, tuning, chord, n);
          const limit = tuning.strings >= 6 ? 1 : 0;

          const rest = await geometry(page);

          await tapColumn(page, 0);
          await page.getByRole("button", { name: /^select$/ }).tap();
          await expect(selectionBar(page)).toBeVisible();
          await tapColumn(page, n - 1);
          await expect(tupletControl(page)).toHaveAccessibleName(`Make a tuplet of ${n}`);
          const names = await selectionBar(page)
            .getByRole("button")
            .evaluateAll((els) =>
              els.map((e) => e.getAttribute("aria-label") ?? e.textContent?.trim() ?? ""),
            );
          expect(names, "all seven controls").toHaveLength(7);
          const selecting = await geometry(page);

          await tupletControl(page).tap();
          await expect(selectionBar(page)).toHaveCount(0);
          await expect(brackets(page)).toHaveCount(1);
          const after = await geometry(page);

          console.log(JSON.stringify({ name, rest, selecting, after }));
          for (const [moment, at] of Object.entries({ rest, selecting, after })) {
            expect(at.stringsClipped, `strings clipped, ${moment}`).toBeLessThanOrEqual(limit);
            expect(at.linesGone, `string lines gone, ${moment}`).toBeLessThanOrEqual(limit);
            expect(at.pageOver, `page scroll, ${moment}`).toBeLessThanOrEqual(0);
            expect(at.scrollTop, `a tap moved the band, ${moment}`).toBe(0);
          }
          expect(selecting.band, "the band does not shrink").toBeGreaterThanOrEqual(rest.band);
        });
      }
    }
  }
}

/**
 * Why INV-013-band.spec.ts and e2e/grouping-band.spec.ts see 2 in the chord-row cells: the same
 * screen, the same state, and the only difference is a Playwright click on a column.
 */
test("the second string is Playwright's click and not the layout", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch input needs the touch project");
  await parked(page, TUNINGS[2], true, 3);
  const finger = await geometry(page);
  await tapColumn(page, 0);
  const tapped = await geometry(page);
  await columns(page).nth(0).click();
  const clicked = await geometry(page);
  console.log(JSON.stringify({ finger, tapped, clicked }));
  expect(finger.stringsClipped).toBe(1);
  expect(tapped.stringsClipped).toBe(1);
  expect(tapped.scrollTop).toBe(0);
  expect(clicked.scrollTop, "the click moved the band").not.toBe(0);
});

/**
 * The red cells of the first version of INV-013-band.spec.ts, step for step: every column reached
 * with `click`, no reload. If the "2" is the layout it survives putting the band back at rest. If
 * it is the click it does not.
 */
test("the band probe's flow, with the band put back", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch input needs the touch project");
  await startWith(page, TUNINGS[2]);
  await addRests(page, 3);
  await selectColumns(page, 0, 1);
  await tupletControl(page).click();
  await setChordOn(page, 0, "Am");
  const clickedRest = await geometry(page);
  await selectColumns(page, 0, 2);
  const clickedSelecting = await geometry(page);
  await page.evaluate(() => {
    let el = document.querySelector('[data-testid="tab-staff"]')!.parentElement as HTMLElement | null;
    while (el && !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) el = el.parentElement;
    el!.scrollTop = 0;
  });
  const putBack = await geometry(page);
  console.log(JSON.stringify({ clickedRest, clickedSelecting, putBack }));
  expect(clickedSelecting.scrollTop, "the clicks moved the band").not.toBe(0);
  expect(putBack.stringsClipped).toBe(1);
  expect(putBack.linesGone).toBe(1);
});

/** FR-020's "reachable with a swipe" names no state, so it holds while selecting too. */
for (const chord of [false, true]) {
  test(`a swipe while selecting reaches the bracket and keeps the selection, 6 strings${chord ? " and a chord row" : ""}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "touch input needs the touch project");
    await parked(page, TUNINGS[2], chord, 3);
    await tapColumn(page, 0);
    await page.getByRole("button", { name: /^select$/ }).tap();
    await tapColumn(page, 2);
    await expect(tupletControl(page)).toHaveAccessibleName("Make a tuplet of 3");
    const selected = () => page.locator('[data-testid="tab-column"][data-selected="true"]').count();
    const before = await selected();

    const box = await page.evaluate(() => {
      const staff = document.querySelector('[data-testid="tab-staff"]')!;
      let s = staff.parentElement as HTMLElement | null;
      while (s && !/(auto|scroll)/.test(getComputedStyle(s).overflowY)) s = s.parentElement;
      const band = s!.getBoundingClientRect();
      const col = staff.querySelector('[data-testid="tab-column"]')!.getBoundingClientRect();
      return { x: col.left + col.width / 2, top: band.top };
    });
    const cdp = await page.context().newCDPSession(page);
    const from = box.top + 8;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x, y: from }] });
    for (let i = 1; i <= 15; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: box.x, y: from + 8 * i }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(300);

    const seen = await page.evaluate(() => {
      const staff = document.querySelector('[data-testid="tab-staff"]')!;
      let s = staff.parentElement as HTMLElement | null;
      while (s && !/(auto|scroll)/.test(getComputedStyle(s).overflowY)) s = s.parentElement;
      const band = s!.getBoundingClientRect();
      const line = document.querySelector('[data-testid="tab-bracket"]')!.getBoundingClientRect();
      return { scrollTop: s!.scrollTop, bracketAbove: band.top - line.top };
    });
    console.log(JSON.stringify({ chord, before, seen }));
    expect(seen.scrollTop, "the swipe moved the band").toBeLessThan(0);
    expect(seen.bracketAbove, "the bracket can be scrolled in").toBeLessThanOrEqual(0);
    expect(await selected(), "a swipe is not a tap").toBe(before);
    await expect(selectionBar(page)).toBeVisible();
  });
}
