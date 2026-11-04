/**
 * INV-017, FR-030. The suite's "release over a toggle" tests hold a column and release on that
 * column: on 1 to 5 strings the sheet is nowhere near the finger, so no release lands on a
 * control. Here the finger ends over a control, at every height the plan names (1 to 5 strings
 * on B Standard, 6 on Guitar 6, 7 on Guitar 7), over a toggle, `delete` and `close`, by touch
 * and by mouse. A click log proves whether the release reached the sheet at all.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  chordColumn,
  columns,
  inspector,
  openDialog,
  PHONE,
  playEveryString,
  startCapturing,
  startWith,
  storedRows,
} from "./probe-helpers";

const HEIGHTS = [
  { name: "1 string", played: 1 },
  { name: "2 strings", played: 2 },
  { name: "3 strings", played: 3 },
  { name: "4 strings", played: 4 },
  { name: "5 strings", played: 5 },
  { name: "6 strings, Guitar 6", played: 6, family: "Guitar 6", preset: "E Standard" },
  { name: "7 strings, Guitar 7", played: 7, family: "Guitar 7", preset: "B Standard" },
] as const;

async function build(page: Page, h: (typeof HEIGHTS)[number]) {
  await page.setViewportSize(PHONE);
  if ("family" in h) {
    await startWith(page, h.family, h.preset, h.played);
    await playEveryString(page, h.played);
    return;
  }
  await startCapturing(page);
  await chordColumn(page, ["G", "D", "A", "E", "B"].slice(0, h.played));
}

const logClicks = (page: Page) =>
  page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as { clicks: string[] }).clicks = log;
    window.addEventListener(
      "click",
      (e) => {
        const t = e.target as HTMLElement;
        log.push(`${t.tagName} ${t.getAttribute("aria-label") ?? t.textContent?.slice(0, 20)} d${e.detail}`);
      },
      true,
    );
  });

const clicks = (page: Page) =>
  page.evaluate(() => (window as unknown as { clicks: string[] }).clicks);

const CONTROLS: Record<string, (page: Page) => ReturnType<Page["locator"]>> = {
  toggle: (page) => inspector(page).getByTestId("decoration-group").last().getByRole("button").first(),
  delete: (page) => inspector(page).getByRole("button", { name: "delete column" }),
  close: (page) => inspector(page).getByRole("button", { name: "close" }),
};

for (const h of HEIGHTS) {
  for (const [control, locate] of Object.entries(CONTROLS)) {
    test(`touch, ${h.name}, finger ends over ${control}`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "touch needs a touch device");
      await build(page, h);
      await logClicks(page);
      const before = await storedRows(page);
      const col = (await columns(page).first().boundingBox())!;
      const x = col.x + col.width / 2;
      const y = col.y + col.height / 2;

      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      await expect(openDialog(page)).toHaveCount(1, { timeout: 2000 });
      const over = locate(page);
      await over.scrollIntoViewIfNeeded();
      const b = (await over.boundingBox())!;
      const tx = b.x + b.width / 2;
      const ty = b.y + b.height / 2;
      for (let i = 1; i <= 6; i += 1) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x + ((tx - x) * i) / 6, y: y + ((ty - y) * i) / 6 }],
        });
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
      await page.waitForTimeout(300);

      console.log(`MEASURE touch ${h.name} ${control}: ${JSON.stringify(await clicks(page))}`);
      expect(await storedRows(page)).toEqual(before);
      await expect(openDialog(page)).toHaveCount(1);
    });

    test(`mouse, ${h.name}, pointer ends over ${control}`, async ({ page }) => {
      await build(page, h);
      await logClicks(page);
      const before = await storedRows(page);
      const col = (await columns(page).first().boundingBox())!;
      await page.mouse.move(col.x + col.width / 2, col.y + col.height / 2);
      await page.mouse.down();
      await expect(openDialog(page)).toHaveCount(1, { timeout: 2000 });
      const over = locate(page);
      await over.scrollIntoViewIfNeeded();
      const b = (await over.boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 });
      await page.mouse.up();
      await page.waitForTimeout(300);

      console.log(`MEASURE mouse ${h.name} ${control}: ${JSON.stringify(await clicks(page))}`);
      expect(await storedRows(page)).toEqual(before);
      await expect(openDialog(page)).toHaveCount(1);
    });
  }

  test(`touch, ${h.name}, finger never moves`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "touch needs a touch device");
    await build(page, h);
    await logClicks(page);
    const before = await storedRows(page);
    const col = (await columns(page).first().boundingBox())!;
    const x = col.x + col.width / 2;
    const y = col.y + col.height - 6;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await expect(openDialog(page)).toHaveCount(1, { timeout: 2000 });
    const under = await page.evaluate(
      ([px, py]) => {
        const el = document.elementFromPoint(px, py) as HTMLElement | null;
        return el ? `${el.tagName} ${el.getAttribute("aria-label") ?? el.textContent?.slice(0, 20)}` : null;
      },
      [x, y],
    );
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
    await page.waitForTimeout(300);
    console.log(`MEASURE still ${h.name}: under=${under} ${JSON.stringify(await clicks(page))}`);
    expect(await storedRows(page)).toEqual(before);
    await expect(openDialog(page)).toHaveCount(1);
  });
}

/**
 * The record of a press inside is only cleared by a click. A touch drag that scrolls the sheet
 * ends in pointercancel with no click, and Escape or the system back gesture closes it with no
 * click either, so the record is still set when the next long press opens the sheet.
 */
test("touch: scroll the sheet, close it with no click, then hold and lift", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch needs a touch device");
  await page.setViewportSize(PHONE);
  await startWith(page, "Guitar 7", "B Standard", 7);
  await playEveryString(page, 7);
  await logClicks(page);
  const before = await storedRows(page);
  const col = (await columns(page).first().boundingBox())!;
  const x = col.x + col.width / 2;
  const y = col.y + col.height - 6;
  const cdp = await page.context().newCDPSession(page);
  const hold = async () => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await expect(openDialog(page)).toHaveCount(1, { timeout: 2000 });
  };
  const lift = () => cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  await hold();
  await lift();
  await page.waitForTimeout(250);
  // A vertical drag inside the sheet: the browser takes it as a scroll.
  const sheet = (await openDialog(page).boundingBox())!;
  const sx = sheet.x + sheet.width - 8;
  const sy = sheet.y + sheet.height / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: sx, y: sy }] });
  for (let i = 1; i <= 8; i += 1) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: sx, y: sy - i * 18 }],
    });
  }
  await lift();
  await page.waitForTimeout(250);
  const scrolled = await openDialog(page).evaluate((el) => el.scrollTop);
  await page.keyboard.press("Escape");
  await expect(openDialog(page)).toHaveCount(0);

  await hold();
  const under = await page.evaluate(
    ([px, py]) => {
      const el = document.elementFromPoint(px, py) as HTMLElement | null;
      return el ? `${el.tagName} ${el.getAttribute("aria-label") ?? el.textContent?.slice(0, 20)}` : null;
    },
    [x, y],
  );
  await lift();
  await cdp.detach();
  await page.waitForTimeout(300);
  console.log(`MEASURE stale record: scrolled=${scrolled} under=${under} ${JSON.stringify(await clicks(page))}`);
  expect(await storedRows(page)).toEqual(before);
});
