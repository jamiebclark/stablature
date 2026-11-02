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
  await page.getByRole("button", { name: "stack" }).click();
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
  await page.getByRole("button", { name: "stack" }).click();
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
  await page.getByRole("button", { name: "stack" }).click();
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
  await page.getByRole("button", { name: "stack" }).click();
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
  await page.getByRole("button", { name: "stack" }).click();
  await fret(page, "E", 8).click();
  await fret(page, "B", 7).click();

  // Building a chord means remembering what is already in it; the neck shows
  // you instead.
  const lit = page.locator('button[aria-pressed="true"]');
  await expect(lit).toHaveCount(3);
  await expect(page.getByRole("button", { name: /A string, fret 9,.*in this column/ })).toBeVisible();
});

/** Lay down four distinguishable notes on the E string. */
async function riff(page: Page) {
  for (const number of [7, 5, 3, 1]) await fret(page, "E", number).click();
  await expect(columns(page)).toHaveCount(4);
}

test("selects a run by tapping both ends", async ({ page }) => {
  await startCapturing(page);
  await riff(page);

  await columns(page).first().click();
  await page.getByTitle(/Select a run of columns/).click();
  await expect(page.getByText("1 selected")).toBeVisible();

  // Tap-to-extend rather than drag: the staff scrolls horizontally, so a
  // drag would be ambiguous.
  await columns(page).nth(2).click();
  await expect(page.getByText("3 selected")).toBeVisible();
  await expect(page.locator('[data-selected="true"]')).toHaveCount(3);

  await page.getByRole("button", { name: "cancel" }).click();
  await expect(page.locator('[data-selected="true"]')).toHaveCount(0);
});

test("copies a run and pastes it at the cursor", async ({ page }) => {
  await startCapturing(page);
  await riff(page);

  await columns(page).first().click();
  await page.getByTitle(/Select a run of columns/).click();
  await columns(page).nth(1).click();
  await expect(page.getByText("2 selected")).toBeVisible();

  await page.getByRole("button", { name: "copy" }).click();
  await page.getByRole("button", { name: /end/ }).click();
  await page.getByRole("button", { name: "paste" }).click();

  await expect(columns(page)).toHaveCount(6);
  await expect(columns(page).nth(4)).toContainText("7");
  await expect(columns(page).nth(5)).toContainText("5");
});

test("cuts a run and pastes it somewhere else", async ({ page }) => {
  await startCapturing(page);
  await riff(page);

  await columns(page).first().click();
  await page.getByTitle(/Select a run of columns/).click();
  await columns(page).nth(1).click();
  await page.getByRole("button", { name: "cut" }).click();

  // Gone from where it was ...
  await expect(columns(page)).toHaveCount(2);
  await expect(columns(page).first()).toContainText("3");

  // ... and it comes back where you put it.
  await page.getByRole("button", { name: "paste" }).click();
  await expect(columns(page)).toHaveCount(4);
  await expect(columns(page).nth(2)).toContainText("7");
});

test("deletes a selected run in one go", async ({ page }) => {
  await startCapturing(page);
  await riff(page);

  await columns(page).first().click();
  await page.getByTitle(/Select a run of columns/).click();
  await columns(page).nth(2).click();
  await page.getByRole("button", { name: "delete", exact: true }).click();

  await expect(columns(page)).toHaveCount(1);
  await expect(columns(page).first()).toContainText("1");
});

test("the clipboard survives moving to another part", async ({ page }) => {
  await startCapturing(page);
  await riff(page);

  await columns(page).first().click();
  await page.getByTitle(/Select a run of columns/).click();
  await columns(page).nth(1).click();
  await page.getByRole("button", { name: "copy" }).click();

  // Copying a bar out of one part and into another is the main reason this
  // exists, and that is a navigation.
  await addPart(page);
  await page.getByRole("button", { name: "paste" }).click();

  await expect(columns(page)).toHaveCount(2);
  await expect(columns(page).first()).toContainText("7");
});

test("paste is unavailable until something has been copied", async ({ page }) => {
  await startCapturing(page);
  await fret(page, "E", 7).click();
  await expect(page.getByRole("button", { name: "paste" })).toBeDisabled();
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
  await page.getByRole("button", { name: "chord symbol" }).click();
  await page.getByLabel("Chord").fill("Am");
  await page.getByRole("button", { name: "Set" }).click();

  await expect(page.getByTestId("tab-staff").getByText("Am")).toBeVisible();
});

/*
 * The point of naming a chord, for a bass player: the neck shows where that
 * chord's notes are, so you can see the options for a run through them. The
 * tuning here is B Standard, so string A fret 0 is an A, fret 3 is a C, and
 * string E fret 0 is an E -- the whole of Am.
 */
test("lights the chord's notes on the neck", async ({ page }) => {
  await startCapturing(page);

  // B on the E string, which is deliberately not a note of Am -- it keeps the
  // in-column highlight and the chord highlight from overlapping.
  await fret(page, "E", 7).click();
  await expect(page.locator("[data-chord-role]")).toHaveCount(0);

  await page.getByRole("button", { name: "chord symbol" }).click();
  await page.getByLabel("Chord").fill("Am");
  await page.getByRole("button", { name: "Set" }).click();

  await expect(
    page.getByRole("button", { name: /A string, fret 0,.*the root of this chord/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /A string, fret 3,.*the third of this chord/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /E string, fret 0,.*the fifth of this chord/ }),
  ).toBeVisible();

  // Notes outside the chord stay plain: a D is not in Am.
  await expect(
    page.getByRole("button", { name: /^D string, fret 0, D2$/ }),
  ).toBeVisible();

  // And the status line says which notes those lit frets are.
  await expect(page.getByText("A C E")).toBeVisible();
});

test("chord tones are not a pressed state, so only the column's notes are", async ({ page }) => {
  await startCapturing(page);

  await fret(page, "E", 7).click();
  await page.getByRole("button", { name: "chord symbol" }).click();
  await page.getByLabel("Chord").fill("Am");
  await page.getByRole("button", { name: "Set" }).click();

  // The chord lights many frets, but exactly one note is in the column.
  await expect(page.locator("[data-chord-role]").first()).toBeVisible();
  await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(1);
});

/*
 * Asserting what the cell actually renders, not just that a role was computed.
 *
 * This is the gap that let a real bug through: the roles, the aria-labels and
 * the data attributes were all correct while the colour was being overridden
 * away, so every other test here passed against a neck that showed nothing.
 * Weight is the honest thing to assert -- it carries "in the chord or not" in
 * both themes, where colour alone does not in the light one.
 */
test("a chord tone is drawn more heavily than a note outside the chord", async ({ page }) => {
  await startCapturing(page);

  await fret(page, "E", 7).click();
  await page.getByRole("button", { name: "chord symbol" }).click();
  await page.getByLabel("Chord").fill("Am");
  await page.getByRole("button", { name: "Set" }).click();

  const weightOf = (locator: ReturnType<typeof fret>) =>
    locator.evaluate((el) => Number(getComputedStyle(el).fontWeight));

  /*
   * Wait for the chord to reach the neck before measuring anything. Setting a
   * chord symbol is a local write that travels Dexie -> liveQuery -> render,
   * and reading computed style does not wait for that: the first cell read
   * came back at the pre-chord weight while a cell read a moment later came
   * back correct, which looks exactly like a broken root style.
   */
  await expect(fret(page, "A", 0)).toHaveAttribute("data-chord-role", "root");

  // A string: fret 0 is the root, fret 3 is the third, fret 1 is in no chord.
  const root = await weightOf(fret(page, "A", 0));
  const third = await weightOf(fret(page, "A", 3));
  const outside = await weightOf(fret(page, "A", 1));

  expect(third).toBeGreaterThan(outside);
  expect(root).toBeGreaterThan(third);
});

test("a chord stays in force over the columns after it", async ({ page }) => {
  await startCapturing(page);

  await fret(page, "E", 7).click();
  await page.getByRole("button", { name: "chord symbol" }).click();
  await page.getByLabel("Chord").fill("Am");
  await page.getByRole("button", { name: "Set" }).click();

  // A chord symbol means "from here until the next one", so adding columns
  // after it -- including a barline and a held space -- keeps it showing.
  await fret(page, "A", 5).click();
  await page.getByTitle("Barline").click();
  await page.getByTitle(/a pause, or a note left ringing/).click();

  await expect(
    page.getByRole("button", { name: /A string, fret 0,.*the root of this chord/ }),
  ).toBeVisible();
});

test("an unreadable chord symbol says so instead of lighting the neck", async ({ page }) => {
  await startCapturing(page);

  await fret(page, "E", 7).click();
  await page.getByRole("button", { name: "chord symbol" }).click();
  await page.getByLabel("Chord").fill("N.C.");
  await page.getByRole("button", { name: "Set" }).click();

  // Still recorded above the staff -- the text is the user's, not ours to
  // reject -- but nothing is claimed about the neck.
  await expect(page.getByTestId("tab-staff").getByText("N.C.")).toBeVisible();
  await expect(page.getByText("not a chord I know")).toBeVisible();
  await expect(page.locator("[data-chord-role]")).toHaveCount(0);
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
  await page.getByRole("button", { name: "chord symbol" }).click();
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
