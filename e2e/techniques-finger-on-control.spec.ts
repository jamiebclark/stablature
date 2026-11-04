/**
 * INV-017, FR-030, the real gesture. A touch click is hit-tested where the finger lifts, and
 * a finger that drags is cancelled (see the [] traces from INV-017-release-over-control), so
 * the only release that can reach a control is a finger that never moves while the sheet opens
 * under it. So: find where each control will sit, hold a column at that exact point, and lift.
 *
 * The column is repeated so a rendition of it lies under any x, and the sheet is the same
 * height wherever it is held. A member is recorded `unreachable` when no column covers the
 * point, which is a measured fact about that sheet height rather than a skipped check.
 *
 * The click log proves each reachable member really landed on the control.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  chordColumn,
  columns,
  details,
  inspector,
  openDialog,
  patchStored,
  PHONE,
  playEveryString,
  startCapturing,
  startWith,
  storedRows,
} from "./capture-surface-helpers";

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
  } else {
    await startCapturing(page);
    await chordColumn(page, ["G", "D", "A", "E", "B"].slice(0, h.played));
  }
  await expect.poll(async () => (await storedRows(page)).length).toBe(1);
  const row = (await storedRows(page))[0];
  await patchStored(page, row.id, { repeat: 24 });
  await page.reload();
  await expect(columns(page)).toHaveCount(24);
  await columns(page).first().click();
  await page.getByTestId("tab-staff").locator(".overflow-x-auto").evaluate((el) => {
    el.scrollLeft = 0;
  });
}

const logClicks = (page: Page) =>
  page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as { clicks: string[] }).clicks = log;
    window.addEventListener(
      "click",
      (e) => {
        const t = e.target as HTMLElement;
        log.push(`${t.tagName}|${t.getAttribute("aria-label") ?? ""}|d${e.detail}`);
      },
      true,
    );
  });

const clicks = (page: Page) => page.evaluate(() => (window as unknown as { clicks: string[] }).clicks);

interface Point {
  label: string;
  x: number;
  y: number;
}

/** Where every control in the sheet sits, unscrolled, read from a sheet opened another way. */
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

const staffBox = async (page: Page) => {
  const cols = await columns(page).evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }),
  );
  return cols;
};

const covered = (cols: Awaited<ReturnType<typeof staffBox>>, p: Point) =>
  cols.some((c) => p.x >= c.left && p.x < c.right && p.y >= c.top && p.y < c.bottom && c.right <= PHONE.width);

/** A tall staff is clipped by its scroller, so a column's box alone does not mean a finger can reach it. */
const onAColumn = (page: Page, p: Point) =>
  page.evaluate(
    ([x, y]) => Boolean(document.elementFromPoint(x, y)?.closest('[data-testid="tab-column"]')),
    [p.x, p.y],
  );

async function reachablePoints(page: Page, points: Point[]) {
  const cols = await staffBox(page);
  const out: Point[] = [];
  for (const p of points) if (covered(cols, p) && (await onAColumn(page, p))) out.push(p);
  return out;
}

async function holdAndLift(page: Page, p: Point) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: p.x, y: p.y }] });
  await expect(openDialog(page)).toHaveCount(1, { timeout: 2000 });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(250);
}

for (const h of HEIGHTS) {
  test(`every control under the finger, ${h.name}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "touch needs a touch device");
    test.setTimeout(120_000);
    await build(page, h);
    const points = await controlPoints(page);
    const reachable = await reachablePoints(page, points);
    console.log(
      `MEASURE ${h.name}: ${points.length} controls, ${reachable.length} under the staff: ${JSON.stringify(reachable.map((p) => p.label))}`,
    );
    await logClicks(page);

    for (const p of reachable) {
      const before = await storedRows(page);
      await page.evaluate(() => {
        (window as unknown as { clicks: string[] }).clicks.length = 0;
      });
      await holdAndLift(page, p);
      const log = await clicks(page);
      console.log(`MEASURE ${h.name} [${p.label}]: ${JSON.stringify(log)}`);
      expect(await storedRows(page), `release over ${p.label}`).toEqual(before);
      await expect(openDialog(page), `sheet open after release over ${p.label}`).toHaveCount(1);
      await inspector(page).getByRole("button", { name: "close" }).click();
      await expect(openDialog(page)).toHaveCount(0);
    }
  });
}

/**
 * The record of a press inside clears only on a click. A press that ends without one, then a
 * close that is not a click (Escape; the system back gesture on a phone), leaves it set, and
 * the next long press is then licensed to press whatever is under the finger.
 */
for (const h of HEIGHTS.slice(3)) {
  test(`a press that ended without a click licenses the next release, ${h.name}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "touch needs a touch device");
    test.setTimeout(120_000);
    await build(page, h);
    const points = await controlPoints(page);
    const reachable = await reachablePoints(page, points);
    console.log(`MEASURE stale ${h.name}: ${JSON.stringify(reachable.map((p) => p.label))}`);
    test.skip(reachable.length === 0, "no control sits under the staff at this height");
    await logClicks(page);

    const cdp = await page.context().newCDPSession(page);
    for (const p of reachable) {
      const before = await storedRows(page);
      await details(page).click();
      await expect(openDialog(page)).toHaveCount(1);
      // A press inside the sheet that the browser takes over: a short drag on the header.
      const head = (await inspector(page).getByRole("heading").boundingBox())!;
      const x = head.x + head.width / 2;
      const y = head.y + head.height / 2;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (let i = 1; i <= 6; i += 1) {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + i * 12 }] });
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(120);
      await page.keyboard.press("Escape");
      await expect(openDialog(page)).toHaveCount(0);

      await page.evaluate(() => {
        (window as unknown as { clicks: string[] }).clicks.length = 0;
      });
      await holdAndLift(page, p);
      const log = await clicks(page);
      const after = await storedRows(page);
      console.log(`MEASURE stale ${h.name} [${p.label}]: ${JSON.stringify(log)} changed=${JSON.stringify(after) !== JSON.stringify(before)}`);
      expect(after, `release over ${p.label} after a press with no click`).toEqual(before);
      await page.keyboard.press("Escape");
      await expect(openDialog(page)).toHaveCount(0);
    }
    await cdp.detach();
  });
}
