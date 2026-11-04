/**
 * INV-009: one armed chip marks exactly one note. 4 chips x 3 routes x {paced, back-to-back}.
 * The suite's "back-to-back" mid-part and stack members press once, so nothing is back to back
 * in them. Here every member presses twice, with only a task boundary between the presses.
 *
 * INV-010: 12 ordered pairs, 4 self-toggles, stack with each chip in both orders, reading
 * aria-pressed on all five chips after each tap.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  backToBack,
  CHIPS,
  columns,
  expectLit,
  fret,
  latch,
  STACK,
  stackLatch,
  startCapturing,
  storedRows,
} from "./probe-helpers";

const marked = async (page: Page) =>
  (await storedRows(page)).flatMap((r) =>
    Object.entries(r.techniques).map(([string, list]) => ({ fret: r.frets[string], string, list })),
  );

async function press(page: Page, pace: string, presses: [string, number][]) {
  if (pace === "back-to-back") {
    await backToBack(page, presses);
    return;
  }
  for (const [string, number] of presses) {
    await fret(page, string, number).click();
    await page.waitForTimeout(200);
  }
}

for (const chip of CHIPS) {
  for (const pace of ["paced", "back-to-back"] as const) {
    test(`INV-009 ${chip.name}, insert at the end, ${pace}`, async ({ page }) => {
      await startCapturing(page);
      await fret(page, "A", 5).click();
      await expect(columns(page)).toHaveCount(1);
      await latch(page, chip.name).click();
      await press(page, pace, [["A", 7], ["A", 9]]);
      await expect(columns(page)).toHaveCount(3);
      expect(await marked(page)).toEqual([{ fret: 7, string: "2", list: [chip.id] }]);
      await expectLit(page, []);
    });

    test(`INV-009 ${chip.name}, insert mid-part, ${pace}`, async ({ page }) => {
      await startCapturing(page);
      await fret(page, "A", 5).click();
      await fret(page, "A", 9).click();
      await expect(columns(page)).toHaveCount(2);
      await columns(page).first().click();
      await latch(page, chip.name).click();
      await press(page, pace, [["A", 7], ["A", 3]]);
      await expect(columns(page)).toHaveCount(4);
      expect(await marked(page)).toEqual([{ fret: 7, string: "2", list: [chip.id] }]);
      await expectLit(page, []);
    });

    test(`INV-009 ${chip.name}, stack, ${pace}`, async ({ page }) => {
      await startCapturing(page);
      await fret(page, "A", 5).click();
      await fret(page, "E", 3).click();
      await expect(columns(page)).toHaveCount(2);
      await stackLatch(page).click();
      await latch(page, chip.name).click();
      await press(page, pace, [["A", 7], ["D", 2]]);
      await expect
        .poll(async () => (await storedRows(page)).at(-1)?.frets)
        .toEqual({ "3": 3, "2": 7, "1": 2 });
      expect(await marked(page)).toEqual([{ fret: 7, string: "2", list: [chip.id] }]);
      await expectLit(page, [STACK]);
    });
  }
}

test("INV-010 12 ordered pairs and 4 self-toggles", async ({ page }) => {
  await startCapturing(page);
  await fret(page, "A", 5).click();
  await expect(columns(page)).toHaveCount(1);
  for (const a of CHIPS) {
    for (const b of CHIPS) {
      if (a === b) continue;
      await latch(page, a.name).click();
      await expectLit(page, [a.name]);
      await latch(page, b.name).click();
      await expectLit(page, [b.name]);
      await latch(page, b.name).click();
      await expectLit(page, []);
    }
    await latch(page, a.name).click();
    await latch(page, a.name).click();
    await expectLit(page, []);
  }
  expect((await storedRows(page)).length, "self-toggles write nothing").toBe(1);
  expect((await storedRows(page))[0].techniques).toEqual({});
});

test("INV-010 stack with each chip, in both arming orders", async ({ page }) => {
  await startCapturing(page);
  await fret(page, "A", 5).click();
  await expect(columns(page)).toHaveCount(1);
  for (const chip of CHIPS) {
    await stackLatch(page).click();
    await latch(page, chip.name).click();
    await expectLit(page, [STACK, chip.name]);
    await stackLatch(page).click();
    await latch(page, chip.name).click();
    await expectLit(page, []);

    await latch(page, chip.name).click();
    await stackLatch(page).click();
    await expectLit(page, [STACK, chip.name]);
    await latch(page, chip.name).click();
    await stackLatch(page).click();
    await expectLit(page, []);
  }
});
