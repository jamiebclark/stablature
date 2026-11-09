/**
 * INV-009: one armed chip marks exactly one note. 3 routes x {paced, back-to-back}.
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
} from "./capture-surface-helpers";

const marked = async (page: Page) =>
  (await storedRows(page)).flatMap((r) =>
    Object.entries(r.techniques).map(([string, list]) => ({ fret: r.frets[string], string, list })),
  );

type Chip = (typeof CHIPS)[number];
type Pace = "paced" | "back-to-back";

async function press(page: Page, pace: Pace, presses: [string, number][]) {
  if (pace === "back-to-back") {
    await backToBack(page, presses);
    return;
  }
  for (const [string, number] of presses) {
    await fret(page, string, number).click();
    await page.waitForTimeout(200);
  }
}

const ROUTES: Record<string, (page: Page, chip: Chip, pace: Pace) => Promise<void>> = {
  "insert at the end": async (page, chip, pace) => {
    await startCapturing(page);
    await fret(page, "A", 5).click();
    await expect(columns(page)).toHaveCount(1);
    await latch(page, chip.name).click();
    await press(page, pace, [["A", 7], ["A", 9]]);
    await expect(columns(page)).toHaveCount(3);
    expect(await marked(page)).toEqual([{ fret: 7, string: "2", list: [chip.id] }]);
    await expectLit(page, []);
  },
  "insert mid-part": async (page, chip, pace) => {
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
  },
  stack: async (page, chip, pace) => {
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
  },
};

// The chips share one arm-and-clear path, so each route runs back to back (the worst case)
// with a different chip, plus one paced member as the typical case.
const CASES: [route: string, chip: string, pace: Pace][] = [
  ["insert at the end", "hammer-on", "paced"], // the typical case
  ["insert at the end", "pull-off", "back-to-back"], // the second press races the clear
  ["insert mid-part", "slide up", "back-to-back"], // the cursor moves into the part, not to the end
  ["stack", "slide down", "back-to-back"], // the chip clears while stack stays armed
];

for (const [route, chipName, pace] of CASES) {
  const chip = CHIPS.find((c) => c.name === chipName)!;
  test(`INV-009 ${chip.name}, ${route}, ${pace}`, async ({ page }) => {
    await ROUTES[route](page, chip, pace);
  });
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
