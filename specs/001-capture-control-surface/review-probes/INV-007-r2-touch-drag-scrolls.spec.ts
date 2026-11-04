/**
 * INV-007 / story 3 scenario 6 (round 2): the press-that-moves case exists because the
 * capturer is scrolling the staff. Round 1 proved neither gesture fires; nothing proved
 * the drag still SCROLLS now that every column takes pointer capture on pointerdown.
 */
import { expect, test } from "@playwright/test";
import { columns, fret, openDialog, startCapturing } from "./helpers";

test("a touch drag across the columns scrolls the staff and fires neither gesture", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "touch needs a touch device");
  await page.setViewportSize({ width: 375, height: 667 });
  await startCapturing(page);
  for (let i = 0; i < 30; i++) {
    await fret(page, "E", 7 + (i % 5)).click();
    await expect(columns(page)).toHaveCount(i + 1);
  }

  const scroller = page.getByRole("group", { name: "Tablature" });
  const before = await scroller.evaluate((el) => el.scrollLeft);
  expect(before).toBeGreaterThan(100);
  const activeIndex = () =>
    columns(page).evaluateAll((els) =>
      els.findIndex((e) => e.getAttribute("aria-current") === "true"),
    );
  const activeBefore = await activeIndex();

  const box = (await scroller.boundingBox())!;
  const x = box.x + 60;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 15; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + i * 12, y }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(700);

  const after = await scroller.evaluate((el) => el.scrollLeft);
  console.log(`scrollLeft ${before} -> ${after}`);
  expect(after, "the staff scrolled under the drag").toBeLessThan(before - 50);
  await expect(openDialog(page)).toHaveCount(0);
  expect(await activeIndex()).toBe(activeBefore);
});
