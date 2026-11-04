/**
 * FR-037, round 2. Pins the cause of the 18 red tests in e2e/capture-surface.spec.ts (:770 and
 * :2184), which assert `scrollerOver <= 0` and passed in round 1. Each case measures the band as
 * built, then flips only the two CSS properties T060 changed back to what main ships, in the live
 * DOM, and measures again. Nothing else differs between the two readings.
 *
 * "reachable" and `scrollerOver <= 0` cannot both hold: an overflow a finger can reach is exactly
 * `scrollHeight > clientHeight`. The first test states the regression, the second the conflict.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  addNotes,
  columns,
  groupControl,
  PHONE,
  selectColumns,
  setChordOn,
  startCapturing,
  tupletControl,
} from "./probe-helpers";

const read = (page: Page, flip: boolean) =>
  page.evaluate((flipped) => {
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    let scroller = staff.parentElement as HTMLElement | null;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    if (flipped) {
      scroller!.style.justifyContent = "flex-end";
      (staff.parentElement as HTMLElement).style.marginTop = "0";
    }
    const box = scroller!.getBoundingClientRect();
    const rows = [...staff.querySelectorAll(".tab-cell")].map((c) => c.getBoundingClientRect());
    return {
      scrollerOver: scroller!.scrollHeight - scroller!.clientHeight,
      rowsOutside: rows.filter((r) => r.top < box.top - 1 || r.bottom > box.bottom + 1).length,
    };
  }, flip);

async function bracketAndChord(page: Page) {
  await startCapturing(page);
  await addNotes(page, 3);
  await selectColumns(page, 0, 2);
  await tupletControl(page).click();
  await setChordOn(page, 0, "Am");
}

async function chordFormOpen(page: Page) {
  await startCapturing(page);
  await addNotes(page, 3);
  await page.getByRole("button", { name: "chord symbol" }).click();
  await expect(page.getByRole("textbox", { name: "Chord" })).toBeVisible();
}

test.describe("the default five-string part at 375x667", () => {
  test.use({ viewport: PHONE });

  for (const [name, setUp] of [
    ["a bracket and a chord row", bracketAndChord],
    ["the chord form open", chordFormOpen],
  ] as const) {
    test(`${name}: the existing assertion holds`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
      await setUp(page);
      const built = await read(page, false);
      const flipped = await read(page, true);
      console.log(JSON.stringify({ name, built, flipped }));
      expect(flipped.scrollerOver, "main's CSS, on this build").toBeLessThanOrEqual(0);
      expect(built.scrollerOver, "as built").toBeLessThanOrEqual(0);
    });
  }

  test("a group needs nothing the band cannot hold", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
    await startCapturing(page);
    await addNotes(page, 3);
    await expect(columns(page)).toHaveCount(3);
    await selectColumns(page, 0, 2);
    await groupControl(page).click();
    const built = await read(page, false);
    console.log(JSON.stringify({ name: "bracket alone", built }));
    expect(built.scrollerOver).toBeLessThanOrEqual(0);
  });
});
