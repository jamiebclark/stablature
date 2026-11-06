/**
 * INV-003 and FR-005, round 2. T134 gives the neck's place to the chord form on a short screen. The form shows on
 * `chordDraft !== null && editable`, and the neck hides on `chordDraft !== null` alone, so each route that takes
 * `editable` away with the form open is enumerated here: the screen must never be left with neither. The second half
 * reads the band between the two heights the plan names, since the rule switches at one number.
 */
import { expect, test, type Page } from "@playwright/test";
import { addChord, columns, fret } from "../../../e2e/capture-surface-helpers";
import { addRests, startWith } from "../../../e2e/probe-helpers";
import { bar, n, seedSong } from "../../../e2e/reading-helpers";

test.setTimeout(120_000);
test.skip(({ isMobile }) => !isMobile, "the height budget is the touch column");

const open = async (page: Page, list = [n(3, { d: "q" }), bar(), n(5, { d: "q" }), n(7, { d: "q" })]) => {
  const { songUrl, parts } = await seedSong(page, [{ key: "a", label: "A", columns: list }], [{ part: "a" }]);
  await page.setViewportSize({ width: 375, height: 553 });
  await page.goto(`${songUrl}/capture/${parts.a}`);
  await expect(columns(page).first()).toBeAttached();
};

const form = (page: Page) => page.getByPlaceholder("Harmony, e.g. Am");

/** The form or the neck: a person needs one of them to carry on. */
const carryOn = async (page: Page) => {
  await page.waitForTimeout(250);
  return { form: await form(page).isVisible(), neck: await fret(page, "G", 3).isVisible() };
};

test("INV-003 the chord form takes the neck's place at 553, and Cancel gives it back", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "chord symbol" }).click();
  expect(await carryOn(page)).toEqual({ form: true, neck: false });
  await page.getByRole("button", { name: "Cancel" }).click();
  expect(await carryOn(page)).toEqual({ form: false, neck: true });
});

test("INV-003 moving the cursor to a barline with the form open leaves the form or the neck", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "chord symbol" }).click();
  await columns(page).nth(1).click();
  const seen = await carryOn(page);
  expect(seen.form || seen.neck, JSON.stringify(seen)).toBe(true);
});

test("INV-003 the start button with the form open leaves the form or the neck", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "chord symbol" }).click();
  await page.getByRole("button", { name: /start$/ }).click();
  const seen = await carryOn(page);
  expect(seen.form || seen.neck, JSON.stringify(seen)).toBe(true);
});

test("INV-003 deleting the only column with the form open leaves the form or the neck", async ({ page }) => {
  await open(page, [n(3, { d: "q" })]);
  await page.getByRole("button", { name: "chord symbol" }).click();
  await page.getByRole("button", { name: "Delete the last column" }).click();
  await expect(columns(page)).toHaveCount(0);
  const seen = await carryOn(page);
  expect(seen.form || seen.neck, JSON.stringify(seen)).toBe(true);
});

for (const tuning of [
  { family: "Guitar 6", preset: "E Standard", strings: 6 },
  { family: "Guitar 7", preset: "B Standard", strings: 7 },
] as const) {
  test(`INV-003 ${tuning.family}: the band with the chord form open, height by height`, async ({ page }) => {
    await startWith(page, tuning);
    await addRests(page, 3);
    await addChord(page, 0, "Am");
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await expect(columns(page).first()).toBeAttached();
    await columns(page).first().click();
    await page.getByRole("button", { name: "chord symbol" }).click();
    await expect(form(page)).toBeVisible();
    const seen: Record<number, number> = {};
    for (const height of [553, 600, 601, 610, 620, 630, 640, 667]) {
      await page.setViewportSize({ width: 375, height });
      await page.waitForTimeout(120);
      seen[height] = Math.round((await page.getByTestId("tab-band").boundingBox())!.height);
    }
    console.log(`${tuning.family} band by height: ${JSON.stringify(seen)}`);
    // Round 1's own measure of a usable band was 43px, the least it found at 667 and on four and five strings.
    for (const [height, band] of Object.entries(seen)) expect.soft(band, `band at ${height}`).toBeGreaterThanOrEqual(43);
  });
}
