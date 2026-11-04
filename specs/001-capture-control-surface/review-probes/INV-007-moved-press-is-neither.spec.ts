/**
 * INV-007: never does a press that moved become either a long press or a tap.
 *
 * Enumerated: drag {left, right, vertical} x released {inside, outside} the
 * originating column = 6, with a mouse (both projects) and with real touch via
 * CDP (mobile project). "Inside" drags 30px out and comes back before release.
 * Held for 650ms, past the 500ms threshold, so a long press that ignored the
 * movement would fire. Asserts: no dialog, cursor and status unchanged.
 */
import { expect, test, type Page } from "@playwright/test";
import { centre, columns, fret, openDialog, startCapturing, status } from "./helpers";

async function build(page: Page) {
  await startCapturing(page);
  await fret(page, "E", 7).click();
  await fret(page, "A", 5).click();
  await fret(page, "D", 3).click();
  await expect(columns(page)).toHaveCount(3);
}

async function state(page: Page) {
  return {
    active: await columns(page).evaluateAll((els) =>
      els.findIndex((e) => e.getAttribute("aria-current") === "true"),
    ),
    status: await status(page).first().textContent(),
  };
}

const DRAGS = [
  { name: "left", dx: -30, dy: 0 },
  { name: "right", dx: 30, dy: 0 },
  { name: "vertical", dx: 0, dy: -30 },
] as const;

async function mouseDrag(page: Page, index: number, dx: number, dy: number, back: boolean) {
  const { x, y } = await centre(columns(page).nth(index));
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  if (back) await page.mouse.move(x, y, { steps: 6 });
  await page.waitForTimeout(650);
  await page.mouse.up();
}

async function touchDrag(page: Page, index: number, dx: number, dy: number, back: boolean) {
  const { x, y } = await centre(columns(page).nth(index));
  const cdp = await page.context().newCDPSession(page);
  const at = (px: number, py: number, type: "touchStart" | "touchMove") =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints: [{ x: px, y: py }] });
  await at(x, y, "touchStart");
  for (let i = 1; i <= 6; i++) await at(x + (dx * i) / 6, y + (dy * i) / 6, "touchMove");
  if (back) for (let i = 5; i >= 0; i--) await at(x + (dx * i) / 6, y + (dy * i) / 6, "touchMove");
  await page.waitForTimeout(650);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test.describe("INV-007 a moved press is neither gesture", () => {
  for (const drag of DRAGS) {
    for (const back of [true, false]) {
      const where = back ? "inside" : "outside";
      test(`mouse: drag ${drag.name}, release ${where}`, async ({ page }) => {
        await build(page);
        const before = await state(page);
        await mouseDrag(page, 0, drag.dx, drag.dy, back);
        await expect(openDialog(page)).toHaveCount(0);
        expect(await state(page)).toEqual(before);
      });

      test(`touch: drag ${drag.name}, release ${where}`, async ({ page }, info) => {
        test.skip(info.project.name !== "mobile", "touch needs a touch device");
        await build(page);
        const before = await state(page);
        await touchDrag(page, 0, drag.dx, drag.dy, back);
        await expect(openDialog(page)).toHaveCount(0);
        expect(await state(page)).toEqual(before);
      });
    }
  }
});
