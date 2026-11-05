/**
 * INV-024 / spec edge case "Start tapped twice quickly. It starts one click, not two."
 * Research R17: "Moving the control needs no timing rule at all." The contract's slot table has the
 * beat at the SAME SIZE as start, so stop is clear of everywhere start was. Sweep the whole of start,
 * left to right, with a real double tap at the same point, and ask: is one click running?
 */
import { expect, test, type Page } from "@playwright/test";
import { cols, rec, recorder, seed } from "./helpers";

async function doubleAt(page: Page, x: number, y: number, gap: number, touch: boolean) {
  if (touch) {
    await page.touchscreen.tap(x, y);
    if (gap) await page.waitForTimeout(gap);
    await page.touchscreen.tap(x, y);
  } else {
    await page.mouse.click(x, y);
    if (gap) await page.waitForTimeout(gap);
    await page.mouse.click(x, y);
  }
}

for (const scenario of [
  { name: "no durations", list: cols(null, null) },
  { name: "timed, with the follow choice", list: cols("q", "q") },
]) {
  test(`INV-024 a double tap anywhere on start leaves one click running (${scenario.name})`, async ({
    page,
    hasTouch,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await recorder(page);
    const { playUrl } = await seed(page, scenario.list, { bpm: 120 });
    await page.goto(playUrl);
    const start = page.getByTestId("click-start");
    await expect(start).toBeEnabled();
    const box = (await start.boundingBox())!;
    const failures: string[] = [];
    for (const gap of [0, 50, 120]) {
      for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        await expect(start).toBeVisible();
        const before = (await rec(page)).contexts;
        await doubleAt(page, box.x + box.width * f, box.y + box.height / 2, gap, hasTouch);
        await page.waitForTimeout(120);
        const running = await page.getByTestId("click-stop").count();
        const made = (await rec(page)).contexts - before;
        if (running !== 1 || made !== 1) {
          failures.push(`gap ${gap}ms at ${Math.round(f * 100)}% of start: running=${running} contexts=${made}`);
        }
        if (running === 1) await page.getByTestId("click-stop").click();
      }
    }
    await start.click();
    const stop = (await page.getByTestId("click-stop").boundingBox())!;
    const beat = (await page.getByTestId("click-beat").boundingBox())!;
    const where = `start ${box.x}..${box.x + box.width}, beat ${beat.x}..${beat.x + beat.width}, stop ${stop.x}..${stop.x + stop.width}`;
    expect(failures, where).toEqual([]);
  });
}

test("INV-024 start, start in one tick is one running click", async ({ page }) => {
  await recorder(page);
  const { playUrl } = await seed(page, cols(null), { bpm: 120 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").evaluate((btn) => {
    (btn as HTMLButtonElement).click();
    (btn as HTMLButtonElement).click();
  });
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await page.waitForTimeout(300);
  const r = await rec(page);
  expect(r.contexts).toBe(1);
  expect(new Set(r.starts.map((s) => s.when)).size).toBe(r.starts.length);
});

test("INV-024 SC-012: 50 cycles of start, stop, leave, return", async ({ page }) => {
  test.setTimeout(240_000);
  await recorder(page);
  const { playUrl } = await seed(page, cols(null), { bpm: 240 });
  await page.goto(playUrl);
  for (let i = 0; i < 50; i++) {
    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-stop")).toBeVisible();
    await page.getByTestId("click-stop").click();
    await page.getByRole("link", { name: "Song" }).click();
    await page.getByRole("link", { name: "Play view" }).click();
    await expect(page.getByTestId("click-start")).toBeEnabled();
  }
  const r = await rec(page);
  expect(r.contexts).toBe(50);
  expect(r.closes).toBe(50);
});
