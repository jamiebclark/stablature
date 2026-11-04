/**
 * INV-013, round 2. Round 1 named `mt-auto` as a fix without trying it, and it was wrong: an
 * auto margin stops anchoring once the content overflows. This measures the design round 2 hands
 * over before naming it. On a six-string part only, it swaps the band to `column-reverse` in the
 * live DOM, which starts at the bottom and keeps the overflow on the side a scroller can reach.
 *
 * Parts of five strings or fewer keep what main ships, so e2e/capture-surface.spec.ts is
 * untouched. Delete this probe once the band is decided: it tests a DOM edit, not the product.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  addRests,
  brackets,
  columns,
  groupControl,
  selectColumns,
  setChordOn,
  startWith,
  TUNINGS,
} from "./probe-helpers";

const flip = (page: Page) =>
  page.evaluate(() => {
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    let s = staff.parentElement as HTMLElement | null;
    while (s && !/(auto|scroll)/.test(getComputedStyle(s).overflowY)) s = s.parentElement;
    s!.setAttribute("data-probe-band", "");
    s!.style.flexDirection = "column-reverse";
    (staff.parentElement as HTMLElement).style.marginTop = "0";
    s!.scrollTop = 0;
  });

const geometry = (page: Page) =>
  page.evaluate(() => {
    const band = document.querySelector("[data-probe-band]")!;
    const box = band.getBoundingClientRect();
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    const cells = [...staff.querySelector('[data-testid="tab-column"]')!.querySelectorAll(".tab-cell")].map(
      (c) => c.getBoundingClientRect(),
    );
    const line = document.querySelector('[data-testid="tab-bracket"]')?.getBoundingClientRect();
    const round = (n: number) => Math.round(n * 10) / 10;
    return {
      scrollTop: round(band.scrollTop),
      scrollable: band.scrollHeight - band.clientHeight,
      firstCellAbove: round(box.top - cells[0].top),
      lastCellBelow: round(cells.at(-1)!.bottom - box.bottom),
      linesGone: cells.filter(
        (r) => (r.top + r.bottom) / 2 > box.bottom || (r.top + r.bottom) / 2 < box.top,
      ).length,
      bracketAbove: line ? round(box.top - line.top) : null,
    };
  });

/** A finger moving down the band, which scrolls towards its top. */
async function swipeDown(page: Page) {
  const box = await page.evaluate(() => {
    const r = document.querySelector("[data-probe-band]")!.getBoundingClientRect();
    return { top: r.top };
  });
  const column = (await columns(page).first().boundingBox())!;
  const x = column.x + column.width / 2;
  const from = box.top + 8;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: from }] });
  for (let i = 1; i <= 15; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: from + 8 * i }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(300);
}

for (const state of ["bare", "bracket", "bracket and chord"] as const) {
  test(`six strings, ${state}: bottom-anchored and reachable`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "touch gestures need the touch project");
    await startWith(page, TUNINGS[2]);
    await addRests(page, 3);
    if (state !== "bare") {
      await selectColumns(page, 0, 2);
      await groupControl(page).click();
      await expect(brackets(page)).toHaveCount(1);
    }
    if (state === "bracket and chord") await setChordOn(page, 0, "Am");
    await page.reload();
    await expect(columns(page)).toHaveCount(3);
    await flip(page);

    const rest = await geometry(page);
    await swipeDown(page);
    const up = await geometry(page);
    console.log(JSON.stringify({ state, rest, up }));

    expect(rest.lastCellBelow, "the low string sits at the bottom of the band").toBeLessThanOrEqual(0);
    expect(rest.linesGone, "as main: only the top string goes").toBeLessThanOrEqual(1);
    expect(up.firstCellAbove, "the top string can be scrolled in").toBeLessThanOrEqual(0);
    if (state !== "bare") expect(up.bracketAbove, "the bracket can be scrolled in").toBeLessThanOrEqual(0);
  });
}
