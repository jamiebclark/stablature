/**
 * INV-009: never does dismissing the inspector without editing change any screen state.
 *
 * Enumerated: {Esc, backdrop click, close button} x cursor {at start, on a
 * column, at end} = 9. Compares the caret's box, the status line, the staff
 * text, which column is current, the latch state -- and the part's exported
 * ASCII, taken before and after.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  columns,
  exportText,
  fret,
  inspector,
  mouseHold,
  openDialog,
  screenState,
  startCapturing,
} from "./helpers";

const ROUTES = ["escape", "backdrop", "close"] as const;
const POSITIONS = ["start", "column", "end"] as const;

async function place(page: Page, where: (typeof POSITIONS)[number]) {
  if (where === "start") await page.getByRole("button", { name: /start/ }).click();
  if (where === "column") await columns(page).nth(1).click();
  if (where === "end") await page.getByRole("button", { name: /end/ }).click();
}

async function dismiss(page: Page, route: (typeof ROUTES)[number]) {
  if (route === "escape") await page.keyboard.press("Escape");
  if (route === "close") await inspector(page).getByRole("button", { name: "close" }).click();
  if (route === "backdrop") await page.mouse.click(8, 8); // above a bottom sheet: the ::backdrop
}

test.describe("INV-009 dismissing the inspector changes nothing", () => {
  for (const route of ROUTES) {
    for (const where of POSITIONS) {
      test(`${route} with the cursor ${where === "column" ? "on a column" : `at ${where}`}`, async ({
        page,
      }) => {
        const { songUrl } = await startCapturing(page);
        await fret(page, "E", 7).click();
        await fret(page, "A", 5).click();
        await fret(page, "D", 3).click();
        await expect(columns(page)).toHaveCount(3);
        const exportBefore = await exportText(page, songUrl);

        await place(page, where);
        const before = await screenState(page);

        await mouseHold(page, columns(page).nth(0));
        await expect(openDialog(page)).toHaveCount(1);
        await dismiss(page, route);
        await expect(openDialog(page)).toHaveCount(0);

        expect(await screenState(page)).toEqual(before);
        expect(await exportText(page, songUrl)).toBe(exportBefore);
      });
    }
  }
});
