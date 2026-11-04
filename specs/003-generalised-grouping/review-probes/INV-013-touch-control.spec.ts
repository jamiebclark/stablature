/**
 * INV-013, round 2. Separates "this gesture does nothing in this harness" from "the band cannot
 * be moved by a finger". A control scroller of the same size, in the same place, on the same page
 * takes the same swipe. Then the gesture, raw touch events and the wheel go to the band itself.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  addRests,
  brackets,
  columns,
  groupControl,
  selectColumns,
  setChordOn,
  startWith,
  TUNINGS,
} from "./probe-helpers";

const bandOf = (page: Page) =>
  page.evaluate(() => {
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    let s = staff.parentElement as HTMLElement | null;
    while (s && !/(auto|scroll)/.test(getComputedStyle(s).overflowY)) s = s.parentElement;
    s!.setAttribute("data-probe-band", "");
    const r = s!.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, width: r.width, height: r.height };
  });
const scrollTop = (page: Page) =>
  page.evaluate(() => document.querySelector("[data-probe-band]")!.scrollTop);
const reset = (page: Page) =>
  page.evaluate(() => {
    document.querySelector("[data-probe-band]")!.scrollTop = 0;
  });

async function gesture(page: Page, x: number, y: number, yDistance: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.synthesizeScrollGesture", {
    x,
    y,
    yDistance,
    gestureSourceType: "touch",
    speed: 400,
    preventFling: true,
  });
  await page.waitForTimeout(200);
}

test("what can move the band at all", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch gestures need the touch project");
  await startWith(page, TUNINGS[2]);
  await addRests(page, 3);
  await selectColumns(page, 0, 2);
  await groupControl(page).click();
  await expect(brackets(page)).toHaveCount(1);
  await setChordOn(page, 0, "Am");
  await page.reload();
  await expect(brackets(page)).toHaveCount(1);

  const band = await bandOf(page);
  const column = (await columns(page).first().boundingBox())!;
  const x = column.x + column.width / 2;
  const y = band.bottom - 8;

  await page.evaluate((r) => {
    const control = document.createElement("div");
    control.id = "control-scroller";
    control.style.cssText = `position:fixed;z-index:99;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;overflow-y:auto;background:#123`;
    control.innerHTML = '<div style="height:400px"></div>';
    document.body.append(control);
  }, band);
  await gesture(page, x, y, -100);
  const control = await page.evaluate(() => {
    const el = document.getElementById("control-scroller")!;
    const top = el.scrollTop;
    el.remove();
    return top;
  });

  await gesture(page, x, y, -100);
  const onColumn = await scrollTop(page);
  await reset(page);
  await gesture(page, band.left + band.width - 12, y, -100);
  const onGutter = await scrollTop(page);
  await reset(page);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y - i * 6 }],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(250);
  const rawTouch = await scrollTop(page);
  await reset(page);

  await page.mouse.move(x, y);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(250);
  const wheel = await scrollTop(page);

  console.log(JSON.stringify({ band, column, control, onColumn, onGutter, rawTouch, wheel }));
  // `control` reads 0: synthesizeScrollGesture moves nothing here, so it proves nothing either way.
  expect(rawTouch, "a finger can move the band, starting on a column").toBeGreaterThan(0);
});
