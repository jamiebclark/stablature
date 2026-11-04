/**
 * INV-009 / FR-023 (round 2): round 1 and the suite open the inspector for the dismissal
 * members with a mouse. F2 lived only on the touch path, and its fix now gates the
 * backdrop on `pointerdown`, so all three routes are re-run opened by a real touch hold
 * and, where a pointer is involved, dismissed by a real touch tap.
 * Also: reopening works, and a tap straight after dismissal is not swallowed (F3).
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, fret, inspector, openDialog, screenState, startCapturing, touchHold } from "./helpers";

async function build(page: Page) {
  await startCapturing(page);
  await fret(page, "E", 7).click();
  await fret(page, "A", 5).click();
  await fret(page, "D", 3).click();
  await expect(columns(page)).toHaveCount(3);
  await columns(page).nth(1).click();
}

async function dismiss(page: Page, route: string) {
  if (route === "escape") await page.keyboard.press("Escape");
  if (route === "backdrop") await page.touchscreen.tap(20, 20);
  if (route === "close") {
    const b = (await inspector(page).getByRole("button", { name: "close" }).boundingBox())!;
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  }
}

test.describe("INV-009 r2 touch", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "mobile", "touch needs a touch device");
  });

  for (const route of ["escape", "backdrop", "close"]) {
    test(`${route}: opened and dismissed by touch, nothing changes, and it reopens`, async ({ page }) => {
      await build(page);
      const before = await screenState(page);
      for (let round = 0; round < 2; round++) {
        await touchHold(page, columns(page).nth(2));
        await expect(openDialog(page)).toHaveCount(1);
        await page.waitForTimeout(150);
        await expect(openDialog(page), "the sheet survived the finger lifting").toHaveCount(1);
        await dismiss(page, route);
        await expect(openDialog(page)).toHaveCount(0);
        expect(await screenState(page)).toEqual(before);
      }
    });
  }

  test("a touch tap on the held column straight after dismissal moves the cursor", async ({ page }) => {
    await build(page);
    await touchHold(page, columns(page).nth(2));
    await expect(openDialog(page)).toHaveCount(1);
    await dismiss(page, "backdrop");
    await expect(openDialog(page)).toHaveCount(0);
    const b = (await columns(page).nth(2).boundingBox())!;
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await expect(columns(page).nth(2)).toHaveAttribute("aria-current", "true");
  });
});
