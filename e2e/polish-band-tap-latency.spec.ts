/**
 * Adopted from the round-1 review probe, spec 008 INV-008 at the plan's own bound: median fret pointerup → new column painted, over 40 taps,
 * wrapped (412×915) ≤ one-line (375×667) × 1.1 + 2ms, at the end AND mid-part. The implementation's spec adds a
 * further 25ms of slack and measures at the end only. Runs each side twice, alternating, and reports every median.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns } from "./probe-helpers";
import { longPart } from "./polish-review-helpers";

test.setTimeout(400_000);

const median = (page: Page) =>
  page.evaluate(async () => {
    const button = [...document.querySelectorAll<HTMLElement>("button")].find((b) => / string, fret 3,/.test(b.getAttribute("aria-label") ?? ""))!;
    const times: number[] = [];
    for (let i = 0; i < 40; i++) {
      const before = document.querySelectorAll('[data-testid="tab-column"]').length;
      const start = performance.now();
      button.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      button.click();
      await new Promise<void>((done) => {
        const tick = () => (document.querySelectorAll('[data-testid="tab-column"]').length > before ? requestAnimationFrame(() => done()) : requestAnimationFrame(tick));
        tick();
      });
      times.push(performance.now() - start);
    }
    return times.sort((a, b) => a - b)[20];
  });

for (const where of ["end", "mid"] as const) {
  test(`INV-008 wrapped taps paint no slower than one-line, cursor at the ${where}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "touch");
    await longPart(page, { chord: false, bracket: false, bars: 16, size: { width: 412, height: 915 } });
    const runs: string[] = [];
    const bad: string[] = [];
    for (let round = 0; round < 2; round++) {
      for (const size of [{ width: 412, height: 915 }, { width: 375, height: 667 }]) {
        await page.setViewportSize(size);
        await page.waitForTimeout(600);
        if (where === "mid") await columns(page).nth(20).click();
        else await page.getByTestId("status-row").getByRole("button", { name: "end ⇥" }).click();
        await page.waitForTimeout(600);
        const wrapped = (await page.locator(".tab-staff-wrapped").count()) === 1;
        const m = await median(page);
        runs.push(`${size.width}x${size.height} wrapped=${wrapped} median ${m.toFixed(1)}ms`);
      }
    }
    for (const r of runs) console.log(`  ${where}: ${r}`);
    const med = (w: string) => runs.filter((r) => r.startsWith(w)).map((r) => Number(/median ([\d.]+)/.exec(r)![1]));
    const wrapped = Math.min(...med("412"));
    const one = Math.min(...med("375"));
    if (!runs.filter((r) => r.startsWith("412")).every((r) => r.includes("wrapped=true"))) bad.push("412x915 did not wrap");
    if (wrapped > one * 1.1 + 2) bad.push(`wrapped ${wrapped.toFixed(1)}ms > one-line ${one.toFixed(1)}ms × 1.1 + 2`);
    expect(bad).toEqual([]);
  });
}
