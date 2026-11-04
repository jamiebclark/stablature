/**
 * INV-005: never does a long press open an inspector where the staff is
 * read-only, or while a selection is active.
 *
 * Enumerated: song-page part staff, play-view step staff, capture staff with a
 * selection active = 3, each with a mouse hold (both projects) and a touch hold
 * (mobile). Unlike the suite's probe, this one never skips: the part is put in
 * the arrangement first so the play view really has a staff, and the test
 * fails if any surface has no column to press. Also asserts the read-only
 * columns carry no press machinery at all (not buttons, no select-none) and
 * that the DOM is unchanged by the hold.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, fret, mouseHold, openDialog, startCapturing, touchHold } from "./helpers";

async function holdAndExpectNothing(page: Page, touch: boolean) {
  const col = columns(page).first();
  await expect(col).toBeVisible();
  const before = await page.locator("main").first().innerHTML();
  if (touch) await touchHold(page, col);
  else await mouseHold(page, col);
  await expect(openDialog(page)).toHaveCount(0);
  await expect(page.getByTestId("column-inspector")).toHaveCount(0);
  expect(await page.locator("main").first().innerHTML()).toBe(before);
}

async function setUp(page: Page) {
  const { songUrl, partUrl } = await startCapturing(page);
  await fret(page, "E", 7).click();
  await fret(page, "A", 5).click();
  await expect(columns(page)).toHaveCount(2);
  await page.goto(songUrl);
  await page.getByRole("button", { name: "Add part A to the arrangement" }).click();
  await expect(page.getByTestId("roadmap-chip")).toHaveCount(1);
  return { songUrl, partUrl };
}

for (const touch of [false, true]) {
  const via = touch ? "touch" : "mouse";
  test.describe(`INV-005 (${via})`, () => {
    test.beforeEach(({}, info) => {
      test.skip(touch && info.project.name !== "mobile", "touch needs a touch device");
    });

    test(`song page staff: no inspector, no press machinery (${via})`, async ({ page }) => {
      const { songUrl } = await setUp(page);
      await page.goto(songUrl);
      const col = columns(page).first();
      expect(await col.evaluate((e) => e.tagName)).toBe("DIV");
      expect((await col.getAttribute("class")) ?? "").not.toContain("select-none");
      await holdAndExpectNothing(page, touch);
    });

    test(`play view staff: no inspector, no press machinery (${via})`, async ({ page }) => {
      const { songUrl } = await setUp(page);
      await page.goto(`${songUrl}/play`);
      await expect(page.getByTestId("tab-staff")).toHaveCount(1);
      const col = columns(page).first();
      expect(await col.evaluate((e) => e.tagName)).toBe("DIV");
      await holdAndExpectNothing(page, touch);
    });

    test(`capture staff with a selection active (${via})`, async ({ page }) => {
      const { partUrl } = await setUp(page);
      await page.goto(partUrl);
      await expect(columns(page)).toHaveCount(2);
      await page.getByRole("button", { name: /select/ }).click();
      await expect(page.getByText(/1 selected/)).toBeVisible();
      const col = columns(page).first();
      if (touch) await touchHold(page, col);
      else await mouseHold(page, col);
      await expect(openDialog(page)).toHaveCount(0);
    });

    /** FR-022 (not INV-005): a selection-time long press does nothing -- not even extend. */
    test(`FR-022 a long press during a selection leaves the selection alone (${via})`, async ({
      page,
    }) => {
      const { partUrl } = await setUp(page);
      await page.goto(partUrl);
      await expect(columns(page)).toHaveCount(2);
      await page.getByRole("button", { name: /select/ }).click();
      await expect(page.getByText(/1 selected/)).toBeVisible();
      const col = columns(page).first();
      if (touch) await touchHold(page, col);
      else await mouseHold(page, col);
      await expect(openDialog(page)).toHaveCount(0);
      const after = await page.getByText(/selected · tap another column/).textContent();
      expect(after, "the long press changed the selection").toMatch(/^1 selected/);
    });
  });
}
