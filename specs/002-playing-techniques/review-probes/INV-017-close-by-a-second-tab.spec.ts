/**
 * INV-017, a close round 1 named but did not drive: the sheet's column deleted elsewhere, after a
 * press inside it ended without a click. Then a long press on another column, held still at the
 * exact point of a control, and lifted. The record must not survive that close either.
 * Heights 4 to 6 are the ones where a repeat stepper lies under the staff (round 1, F1).
 */
import { expect, test, type Page } from "@playwright/test";
import {
  chordColumn,
  columns,
  deleteButton,
  details,
  inspector,
  openDialog,
  patchStored,
  PHONE,
  playEveryString,
  startCapturing,
  startWith,
  storedRows,
} from "./probe-helpers";

const HEIGHTS = [
  { name: "4 strings", played: 4 },
  { name: "5 strings", played: 5 },
  { name: "6 strings, Guitar 6", played: 6, family: "Guitar 6", preset: "E Standard" },
] as const;

async function build(page: Page, h: (typeof HEIGHTS)[number]) {
  await page.setViewportSize(PHONE);
  if ("family" in h) {
    await startWith(page, h.family, h.preset, h.played);
    await playEveryString(page, h.played);
    await playEveryString(page, h.played);
  } else {
    await startCapturing(page);
    const rows = ["G", "D", "A", "E", "B"].slice(0, h.played);
    await chordColumn(page, rows);
    await chordColumn(page, rows);
  }
  await expect.poll(async () => (await storedRows(page)).length).toBe(2);
  await patchStored(page, (await storedRows(page))[0].id, { repeat: 24 });
  await page.reload();
  await expect(columns(page)).toHaveCount(25);
}

const toStart = (page: Page) =>
  page.getByTestId("tab-staff").locator(".overflow-x-auto").evaluate((el) => {
    el.scrollLeft = 0;
  });

interface Point {
  label: string;
  x: number;
  y: number;
}

async function controlPoints(page: Page): Promise<Point[]> {
  await details(page).click();
  await expect(openDialog(page)).toHaveCount(1);
  const points = await inspector(page)
    .locator("button, input")
    .evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return {
          label: e.getAttribute("aria-label") ?? e.textContent ?? "",
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
        };
      }),
    );
  await inspector(page).getByRole("button", { name: "close" }).click();
  await expect(openDialog(page)).toHaveCount(0);
  return points;
}

const onAColumn = (page: Page, p: Point) =>
  page.evaluate(
    ([x, y]) => Boolean(document.elementFromPoint(x, y)?.closest('[data-testid="tab-column"]')),
    [p.x, p.y],
  );

for (const h of HEIGHTS) {
  test(`a column deleted elsewhere closes the sheet, and licenses nothing, ${h.name}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "touch needs a touch device");
    test.setTimeout(120_000);
    await build(page, h);
    await columns(page).last().click();
    const points = await controlPoints(page);

    // The other tab, on the same column, ready to delete it.
    const other = await page.context().newPage();
    await other.goto(page.url());
    await expect(columns(other)).toHaveCount(25);
    await columns(other).last().click();

    // Open the sheet on that column, and start a press inside it that the browser takes over.
    await page.bringToFront();
    await details(page).click();
    await expect(openDialog(page)).toHaveCount(1);
    const cdp = await page.context().newCDPSession(page);
    const head = (await inspector(page).getByRole("heading").boundingBox())!;
    const x = head.x + head.width / 2;
    const y = head.y + head.height / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let i = 1; i <= 6; i += 1) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + i * 12 }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(120);

    await deleteButton(other).click();
    await expect(columns(other)).toHaveCount(24);
    await other.close();
    await page.bringToFront();
    await expect(openDialog(page), "deleting the column closes its sheet").toHaveCount(0);
    await expect(columns(page)).toHaveCount(24);
    await toStart(page);

    const reachable: Point[] = [];
    for (const p of points) if (await onAColumn(page, p)) reachable.push(p);
    console.log(`MEASURE second tab ${h.name}: ${JSON.stringify(reachable.map((p) => p.label))}`);
    expect(reachable.length, "a control lies under the staff at this height").toBeGreaterThan(0);

    for (const p of reachable) {
      const before = await storedRows(page);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y }] });
      await expect(openDialog(page)).toHaveCount(1, { timeout: 2000 });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(250);
      expect(await storedRows(page), `release over ${p.label}`).toEqual(before);
      await expect(openDialog(page), `sheet open after release over ${p.label}`).toHaveCount(1);
      await page.keyboard.press("Escape");
      await expect(openDialog(page)).toHaveCount(0);
    }
    await cdp.detach();
  });
}
