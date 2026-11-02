import { expect, test, type Page } from "@playwright/test";

/**
 * The real flow, in a real browser: make a band, capture a riff, build the
 * form, read it back.
 *
 * The unit tests prove the layout and merge logic; these prove the screens
 * actually work, which is the part no amount of pure-function testing can
 * tell you. Each test runs in its own browser context, so IndexedDB starts
 * empty every time.
 */

const BASS5 = "B Standard";

/** Walk through to an empty capture screen, returning the song's URL. */
async function startCapturing(page: Page, band = "Hollow Crown", song = "Dirge") {
  await page.goto("/");

  await page.getByLabel("Band name").fill(band);
  await page.getByRole("button", { name: "Add band" }).click();
  await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);

  // A brand-new band is seeded with a 5-string tuning so capture works
  // immediately rather than sending you to a settings screen first.
  await expect(page.getByText(BASS5)).toBeVisible();

  await page.getByLabel("Song title").fill(song);
  await page.getByRole("button", { name: "Add song" }).click();
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+$/);
  const songUrl = page.url();

  await page.getByRole("link", { name: "Capture" }).click();
  await expect(page).toHaveURL(/\/capture$/);

  await page.getByRole("button", { name: "Add a part" }).click();
  // Selecting a part is navigation, not component state: the part id belongs
  // in the path so a reload keeps your place and the part is linkable.
  await expect(page).toHaveURL(/\/capture\/[0-9a-f-]+$/);

  return { songUrl };
}

const columns = (page: Page) => page.getByTestId("tab-column");

/**
 * Add a part and wait until the screen is actually on it.
 *
 * Adding a part navigates, and tapping a fret before the new URL settles puts
 * the note in the part you just left.
 */
async function addPart(page: Page) {
  const before = page.url();
  await page.getByRole("button", { name: "Add a part" }).click();
  await expect(page).not.toHaveURL(before);
  await expect(page).toHaveURL(/\/capture\/[0-9a-f-]+$/);
  await expect(columns(page)).toHaveCount(0);
}

/** Tap a fret on the on-screen neck. */
const fret = (page: Page, string: string, number: number) =>
  page.getByRole("button", { name: new RegExp(`^${string} string, fret ${number},`) });

test("captures a riff, repeats it, and persists across a reload", async ({ page }) => {
  await startCapturing(page);

  await fret(page, "E", 7).click();
  await expect(columns(page)).toHaveCount(1);

  // Four of the same note is two taps and one stored row, which is the whole
  // point of storing repeats compressed.
  await page.getByTitle("Four of these").click();
  await expect(columns(page)).toHaveCount(4);
  await expect(page.getByLabel("Repeat count")).toHaveText("×4");

  await page.getByTitle("Barline").click();
  await expect(columns(page)).toHaveCount(5);
  await expect(page.locator('[data-barline="true"]')).toHaveCount(1);

  await fret(page, "A", 5).click();
  await expect(columns(page)).toHaveCount(6);

  // Nothing has touched the network; this all has to survive a reload.
  await page.reload();
  await expect(columns(page)).toHaveCount(6);
});

test("backspace removes the last column", async ({ page }) => {
  await startCapturing(page);

  await fret(page, "E", 7).click();
  await fret(page, "E", 12).click();
  await expect(columns(page)).toHaveCount(2);

  await page.getByRole("button", { name: "Delete the last column" }).click();
  await expect(columns(page)).toHaveCount(1);
});

test("stacks a chord onto one column", async ({ page }) => {
  await startCapturing(page);

  await fret(page, "E", 7).click();
  await page.getByTitle(/build a chord/).click();
  await fret(page, "A", 5).click();

  // Still one column, now with two strings on it.
  await expect(columns(page)).toHaveCount(1);
  await expect(columns(page).first()).toContainText("7");
  await expect(columns(page).first()).toContainText("5");
});

test("builds a three-note chord in one column", async ({ page }) => {
  await startCapturing(page);

  // A9 / E8 / B7 all hitting together: arm stack once, then tap the strings.
  await fret(page, "A", 9).click();
  await page.getByTitle(/build a chord/).click();
  await expect(page.getByText("stacking onto the marked column")).toBeVisible();

  await fret(page, "E", 8).click();
  await fret(page, "B", 7).click();

  // One column, three strings -- not three columns.
  await expect(columns(page)).toHaveCount(1);
  const column = columns(page).first();
  await expect(column).toContainText("9");
  await expect(column).toContainText("8");
  await expect(column).toContainText("7");
});

test("re-tapping a string in a chord replaces that note", async ({ page }) => {
  await startCapturing(page);

  await fret(page, "A", 9).click();
  await page.getByTitle(/build a chord/).click();
  await fret(page, "E", 8).click();
  // Same string again: a column can only hold one note per string.
  await fret(page, "E", 10).click();

  await expect(columns(page)).toHaveCount(1);
  await expect(columns(page).first()).toContainText("10");
  await expect(columns(page).first()).not.toContainText("8");
});

test("stacking stops when you move the cursor", async ({ page }) => {
  await startCapturing(page);

  await fret(page, "A", 9).click();
  await page.getByTitle(/build a chord/).click();
  await fret(page, "E", 8).click();

  // Selecting a column means you have moved on; the next tap is a new column,
  // not a fourth note in the old chord.
  await columns(page).first().click();
  await expect(page.getByText("stacking onto the marked column")).toHaveCount(0);

  await fret(page, "G", 5).click();
  await expect(columns(page)).toHaveCount(2);
});

test("adds a space for a pause or a hold", async ({ page }) => {
  await startCapturing(page);

  await fret(page, "E", 7).click();
  await page.getByTitle(/a pause, or a note left ringing/).click();
  await fret(page, "E", 5).click();

  // Three columns, with the middle one empty.
  await expect(columns(page)).toHaveCount(3);
  await expect(columns(page).nth(0)).toContainText("7");
  await expect(columns(page).nth(1)).toHaveText("");
  await expect(columns(page).nth(2)).toContainText("5");
});

test("stretches a hold with the repeat rather than more taps", async ({ page }) => {
  await startCapturing(page);

  await fret(page, "E", 7).click();
  await page.getByTitle(/a pause, or a note left ringing/).click();
  await page.getByTitle("Four of these").click();

  await expect(page.getByLabel("Repeat count")).toHaveText("×4");
  // The note plus four columns of space.
  await expect(columns(page)).toHaveCount(5);
});

test("shows a caret where the next note will land", async ({ page }) => {
  await startCapturing(page);

  await fret(page, "E", 7).click();
  await fret(page, "E", 5).click();
  await expect(page.getByTestId("tab-caret")).toHaveCount(1);

  // Move the cursor; the caret has to follow it, not stay at the end.
  await columns(page).first().click();
  await expect(page.getByText("adding after the marked column")).toBeVisible();
  await expect(page.getByTestId("tab-caret")).toHaveCount(1);

  await page.getByRole("button", { name: /start/ }).click();
  await expect(page.getByTestId("tab-caret")).toHaveCount(1);
});

test("lights the current column on the fretboard", async ({ page }) => {
  await startCapturing(page);

  await fret(page, "A", 9).click();
  await page.getByTitle(/build a chord/).click();
  await fret(page, "E", 8).click();
  await fret(page, "B", 7).click();

  // Building a chord means remembering what is already in it; the neck shows
  // you instead.
  const lit = page.locator('button[aria-pressed="true"]');
  await expect(lit).toHaveCount(3);
  await expect(page.getByRole("button", { name: /A string, fret 9,.*in this column/ })).toBeVisible();
});

test("groups three columns into a triplet", async ({ page }) => {
  await startCapturing(page);

  for (let i = 0; i < 3; i += 1) await fret(page, "A", 5).click();
  await page.getByTitle(/triplet/).click();

  // The bracket label is drawn above the staff.
  await expect(page.getByTestId("tab-staff").getByText("3", { exact: true })).toBeVisible();
});

test("records a chord above a column", async ({ page }) => {
  await startCapturing(page);

  await fret(page, "E", 7).click();
  await page.getByRole("button", { name: "chord" }).click();
  await page.getByLabel("Chord").fill("Am");
  await page.getByRole("button", { name: "Set" }).click();

  await expect(page.getByTestId("tab-staff").getByText("Am")).toBeVisible();
});

test("inserts a note between two existing columns", async ({ page }) => {
  await startCapturing(page);

  // The real workflow: lay down the root notes, then go back and fill in.
  await fret(page, "E", 7).click();
  await fret(page, "E", 5).click();
  await expect(columns(page)).toHaveCount(2);
  await expect(page.getByText("adding at the end")).toBeVisible();

  // Tap the first column to put the cursor after it.
  await columns(page).first().click();
  await expect(page.getByText("adding after the marked column")).toBeVisible();

  await fret(page, "A", 3).click();
  await expect(columns(page)).toHaveCount(3);

  // The new note landed in the middle, not at the end.
  await expect(columns(page).nth(1)).toContainText("3");
  await expect(columns(page).nth(2)).toContainText("5");
});

test("can insert before the very first column", async ({ page }) => {
  await startCapturing(page);

  await fret(page, "E", 7).click();
  await expect(columns(page)).toHaveCount(1);

  // "after a column" alone cannot reach position zero, which is why the
  // cursor has an explicit start.
  await page.getByRole("button", { name: /start/ }).click();
  await fret(page, "A", 3).click();

  await expect(columns(page).first()).toContainText("3");
  await expect(columns(page).nth(1)).toContainText("7");
});

test("sets a chord on a chosen column, not just the last", async ({ page }) => {
  await startCapturing(page);

  await fret(page, "E", 7).click();
  await fret(page, "E", 5).click();

  await columns(page).first().click();
  await page.getByRole("button", { name: "chord" }).click();
  await page.getByLabel("Chord").fill("Am");
  await page.getByRole("button", { name: "Set" }).click();

  await expect(page.getByTestId("tab-staff").getByText("Am")).toBeVisible();
});

test("switching parts changes the URL and keeps each part separate", async ({ page }) => {
  await startCapturing(page);

  await fret(page, "E", 7).click();
  const partAUrl = page.url();

  await addPart(page);
  await expect(page).not.toHaveURL(partAUrl);

  await fret(page, "A", 3).click();
  await expect(columns(page)).toHaveCount(1);

  // Back to A by its own link.
  await page.getByRole("link", { name: "A", exact: true }).click();
  await expect(columns(page)).toHaveCount(1);
  await expect(columns(page).first()).toContainText("7");
});

test("builds the brief's arrangement and reads it back in order", async ({ page }) => {
  const { songUrl } = await startCapturing(page);

  // Part A: a repeated note.
  await fret(page, "E", 7).click();
  await page.getByTitle("Four of these").click();
  await expect(page.getByLabel("Repeat count")).toHaveText("×4");

  // Part B.
  await addPart(page);
  await fret(page, "A", 5).click();
  await expect(columns(page)).toHaveCount(1);

  await page.goto(songUrl);

  // A x4, then B.
  await page.getByRole("button", { name: "Add part A to the arrangement" }).click();
  await page.getByRole("button", { name: "Add part B to the arrangement" }).click();
  await expect(page.getByTestId("roadmap-chip")).toHaveCount(2);

  // Make the first entry play four times.
  await page.getByTestId("roadmap-chip").first().click();
  for (let i = 0; i < 3; i += 1) {
    await page.getByRole("button", { name: "One more repeat" }).click();
  }
  await expect(page.getByTestId("roadmap-chip").first()).toContainText("A×4");

  // The play view unrolls it: four passes of A, then one of B.
  await page.getByRole("link", { name: "Play view" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByTestId("tab-staff")).toHaveCount(5);
  await expect(page.getByText("pass 1 of 4")).toBeVisible();
  await expect(page.getByText("pass 4 of 4")).toBeVisible();
});

test("plays a variant on the final pass only", async ({ page }) => {
  const { songUrl } = await startCapturing(page);

  await fret(page, "E", 7).click();
  await expect(columns(page)).toHaveCount(1);
  await page.goto(songUrl);

  // A variant copies the part so it can diverge -- "A, but with a flourish".
  await page.getByRole("button", { name: "+ variant" }).click();
  await expect(page.getByText("variant of")).toBeVisible();

  await page.getByRole("button", { name: "Add part A to the arrangement" }).click();
  await page.getByTestId("roadmap-chip").first().click();
  await page.getByRole("button", { name: "One more repeat" }).click();

  await page.getByLabel("Last pass").selectOption({ label: "A'" });
  await expect(page.getByTestId("roadmap-chip").first()).toContainText("last: A'");

  await page.getByRole("link", { name: "Play view" }).click();
  // Two passes: the first is A, the second the variant.
  await expect(page.getByTestId("tab-staff")).toHaveCount(2);
});

test("collapses repeats in compact density", async ({ page }) => {
  const { songUrl } = await startCapturing(page);

  await fret(page, "E", 7).click();
  await page.getByTitle("Four of these").click();
  // Wait for the write to be observable before hard-navigating: page.goto
  // tears the page down and would abort an IndexedDB transaction still in
  // flight. A real user navigates after seeing the count change, which is
  // exactly what this asserts.
  await expect(page.getByLabel("Repeat count")).toHaveText("×4");
  await page.goto(songUrl);

  // Expanded: four columns for the one stored row.
  await expect(columns(page)).toHaveCount(4);

  await page.getByRole("button", { name: "compact" }).click();
  // Compact: one column, labelled.
  await expect(columns(page)).toHaveCount(1);
  await expect(columns(page).first()).toContainText("7x4");
});
