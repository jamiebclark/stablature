/**
 * INV-017 / FR-024: never does a refusal message outlive its cause. All 10 routes the plan names
 * (the suite has 6: e2e/grouping.spec.ts:292), then what the suite never tries: coming back to
 * where the refusal happened. `refused` (CaptureScreen.tsx:185) compares `refusedAt` to the
 * current cursor and length, and nothing ever clears `refusedAt`, so equal values make it true
 * again with no tap. Then the chord and stack states at 375x667.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  addNotes,
  addPart,
  addRests,
  columns,
  deleteButton,
  fret,
  measureBand,
  PHONE,
  refusal,
  setChordOn,
  space,
  stackLatch,
  startCapturing,
  startWith,
  status,
  triplet,
  TUNINGS,
} from "./probe-helpers";

const bar = (page: Page) => page.getByRole("button", { name: "Barline" });
const startButton = (page: Page) => page.getByRole("button", { name: /start$/ });
const endButton = (page: Page) => page.getByRole("button", { name: /^end/ });

async function refuseAtEnd(page: Page) {
  await startCapturing(page);
  await addNotes(page, 2);
  await triplet(page).click();
  await expect(refusal(page)).toBeVisible();
}

/** Four notes, cursor on the second: a refusal mid-part, so `end` and `start` both move it. */
async function refuseMidPart(page: Page) {
  await startCapturing(page);
  await addNotes(page, 4);
  await columns(page).nth(1).click();
  await triplet(page).click();
  await expect(refusal(page)).toBeVisible();
}

test.describe("the 10 routes", () => {
  const atEnd: [string, (p: Page) => Promise<unknown>][] = [
    ["tap a column", (p) => columns(p).nth(0).click()],
    ["a fret", (p) => fret(p, "E", 4).click()],
    ["space", (p) => space(p)],
    ["barline", (p) => bar(p).click()],
    ["delete", (p) => deleteButton(p).click()],
    ["start", (p) => startButton(p).click()],
    ["add a part", (p) => p.getByRole("button", { name: "Add a part" }).click()],
  ];
  for (const [name, route] of atEnd) {
    test(name, async ({ page }) => {
      await refuseAtEnd(page);
      await route(page);
      await expect(refusal(page)).toHaveCount(0);
    });
  }

  test("end", async ({ page }) => {
    await refuseMidPart(page);
    await endButton(page).click();
    await expect(refusal(page)).toHaveCount(0);
  });

  test("switch part", async ({ page }) => {
    await refuseAtEnd(page);
    const first = page.url();
    await addPart(page);
    await addNotes(page, 1);
    await page.goBack().catch(() => undefined);
    await page.goto(first);
    await expect(columns(page)).toHaveCount(2);
    await expect(refusal(page)).toHaveCount(0);
  });

  test("switch part by its chip", async ({ page }) => {
    await startCapturing(page);
    await addPart(page);
    await addNotes(page, 2);
    await triplet(page).click();
    await expect(refusal(page)).toBeVisible();
    await page.getByRole("link", { name: "A", exact: true }).click();
    await expect(columns(page)).toHaveCount(0);
    await expect(refusal(page)).toHaveCount(0);
  });

  test("delete from a second tab", async ({ page, context }) => {
    await refuseAtEnd(page);
    const other = await context.newPage();
    await other.goto(page.url());
    await expect(columns(other)).toHaveCount(2);
    await deleteButton(other).click();
    await expect(columns(page)).toHaveCount(1);
    await expect(refusal(page)).toHaveCount(0);
  });
});

test.describe("the message does not come back on its own", () => {
  test("cursor away and back, with no second tap", async ({ page }) => {
    await refuseAtEnd(page);
    await columns(page).nth(0).click();
    await expect(refusal(page)).toHaveCount(0);
    await endButton(page).click();
    await expect(status(page)).toHaveText("adding at the end");
    await expect(refusal(page)).toHaveCount(0);
  });

  test("a fret then delete, the mid-riff slip", async ({ page }) => {
    await refuseAtEnd(page);
    await fret(page, "E", 4).click();
    await expect(columns(page)).toHaveCount(3);
    await expect(refusal(page)).toHaveCount(0);
    await deleteButton(page).click();
    await expect(columns(page)).toHaveCount(2);
    await expect(status(page)).toHaveText("adding at the end");
    await expect(refusal(page)).toHaveCount(0);
  });

  test("a successful triplet elsewhere, then back", async ({ page }) => {
    await refuseMidPart(page);
    await columns(page).nth(3).click();
    await triplet(page).click();
    await expect(page.locator(".tab-bracket-label")).toHaveText("3");
    await columns(page).nth(1).click();
    await expect(refusal(page)).toHaveCount(0);
  });

  test("a part and back by its chip", async ({ page }) => {
    await startCapturing(page);
    await addNotes(page, 2);
    await triplet(page).click();
    await expect(refusal(page)).toBeVisible();
    await addPart(page);
    await page.getByRole("link", { name: "A", exact: true }).click();
    await expect(columns(page)).toHaveCount(2);
    await expect(refusal(page)).toHaveCount(0);
  });
});

test.describe("what a refusal does to the status line", () => {
  test("arming stack still says so", async ({ page }) => {
    await refuseAtEnd(page);
    await stackLatch(page).click();
    await expect(page.getByText("stacking onto the marked column")).toBeVisible();
  });
});

test.describe("chord and stack states at 375x667", () => {
  test.use({ viewport: PHONE });

  for (const tuning of TUNINGS) {
    test(`a chord in force, ${tuning.strings} strings`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
      await startWith(page, tuning);
      await addRests(page, 2);
      await setChordOn(page, 0, "Am");
      await columns(page).nth(1).click();
      const before = await measureBand(page);
      const row = page.getByText("adding after the marked column").locator("xpath=..");
      const restHeight = (await row.boundingBox())!.height;
      await triplet(page).click();
      await expect(refusal(page)).toBeVisible();
      const after = await measureBand(page);
      const height = (await refusal(page).locator("xpath=..").boundingBox())!.height;
      const lines = await refusal(page).evaluate((el) => el.getClientRects().length);
      console.log(JSON.stringify({ strings: tuning.strings, before, after, restHeight, height, lines }));
      expect(after.pageOver).toBeLessThanOrEqual(0);
      expect(after.strings).toBe(tuning.strings);
      expect(after.stringsClipped).toBeLessThanOrEqual(before.stringsClipped);
      expect(height, "the status row keeps its height").toBeLessThanOrEqual(restHeight + 0.5);
    });

    test(`the chord form open, ${tuning.strings} strings`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
      await startWith(page, tuning);
      await addRests(page, 2);
      await page.getByRole("button", { name: "chord symbol" }).click();
      await expect(page.getByLabel("Chord")).toBeVisible();
      const before = await measureBand(page);
      await triplet(page).click();
      await expect(refusal(page)).toBeVisible();
      const after = await measureBand(page);
      console.log(JSON.stringify({ form: true, strings: tuning.strings, before, after }));
      expect(after.pageOver).toBeLessThanOrEqual(0);
      expect(after.stringsClipped).toBeLessThanOrEqual(before.stringsClipped);
    });

    test(`stack armed, ${tuning.strings} strings`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
      await startWith(page, tuning);
      await addRests(page, 2);
      await stackLatch(page).click();
      const before = await measureBand(page);
      await triplet(page).click();
      await expect(refusal(page)).toBeVisible();
      const after = await measureBand(page);
      console.log(JSON.stringify({ stack: true, strings: tuning.strings, before, after }));
      expect(after.pageOver).toBeLessThanOrEqual(0);
      expect(after.stringsClipped).toBeLessThanOrEqual(before.stringsClipped);
    });
  }
});
