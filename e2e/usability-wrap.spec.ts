import { expect, test, type Page } from "@playwright/test";
import { cols, seed } from "./rhythm-probe-helpers";

test.setTimeout(120_000);

/** Sixteen bars of four quarters each. */
const SIXTEEN = cols(
  ...Array.from({ length: 16 }, (_, i) => ["q", "q", "q", "q", ...(i < 15 ? ["|"] : [])]).flat(),
);

const numbers = (page: Page) =>
  page.locator("ol > li").evaluateAll((items) =>
    items.map((li) =>
      [...li.querySelectorAll("[data-testid=tab-bar-number]")].map((n) => Number(n.textContent)),
    ),
  );

/**
 * INV-032, INV-033, INV-034, INV-038: the wrapped play view. Bars run on across passes, the heading
 * says the part's own facts, and a line never scrolls sideways at any width.
 */
test("INV-032 bar numbers run on across passes, from 1", async ({ page }) => {
  const { playUrl } = await seed(page, SIXTEEN, { bpm: 120, passes: 2 });
  await page.goto(playUrl);
  await expect(page.locator("ol > li")).toHaveCount(2);
  const [first, second] = await numbers(page);
  expect(first).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  expect(second).toEqual(Array.from({ length: 16 }, (_, i) => i + 17));
  await page.reload();
  await expect(page.locator("ol > li")).toHaveCount(2);
  const again = await numbers(page);
  expect(again[1][0]).toBe(17);
});

test("INV-032 capture has no bar numbers", async ({ page }) => {
  const { partUrl } = await seed(page, SIXTEEN, { bpm: 120 });
  await page.goto(partUrl);
  await expect(page.getByTestId("tab-column").first()).toBeVisible();
  await expect(page.getByTestId("tab-bar-number")).toHaveCount(0);
});

test("INV-033/034 the heading names the pass and counts beats, never a fraction", async ({ page }) => {
  const { playUrl } = await seed(page, SIXTEEN, { bpm: 120, passes: 2 });
  await page.goto(playUrl);
  const items = page.locator("ol > li");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("pass 1 of 2");
  await expect(items.nth(1)).toContainText("pass 2 of 2");
  await expect(items.nth(0)).toContainText("120 bpm · 4 beats a bar");
  await expect(items.nth(1)).not.toContainText("beats a bar");
  const head = await items.nth(0).innerText();
  expect(head).not.toMatch(/\d\s*\/\s*\d/);
});

for (const width of [375, 820, 1280]) {
  test(`INV-038 no sideways scroll, lines align with the gutter at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const { playUrl } = await seed(page, SIXTEEN, { bpm: 120 });
    await page.goto(playUrl);
    await expect(page.getByTestId("tab-staff").first()).toBeVisible();
    const m = await page.evaluate(() => {
      const lines = document.querySelector(".tab-lines")!;
      const runs = [...lines.querySelectorAll(".tab-bar-run")];
      const tops = [...new Set(runs.map((r) => Math.round(r.getBoundingClientRect().top * 10) / 10))].sort((a, b) => a - b);
      const blocks = [...document.querySelectorAll(".tab-gutter-block")].map((b) => b.getBoundingClientRect().top);
      return {
        scroll: lines.scrollWidth,
        width: lines.clientWidth,
        doc: document.documentElement.scrollWidth,
        win: window.innerWidth,
        tops,
        blocks,
        staff: lines.getBoundingClientRect().width,
      };
    });
    expect(m.scroll).toBeLessThanOrEqual(m.width);
    expect(m.doc).toBeLessThanOrEqual(m.win);
    m.tops.forEach((top, i) => expect(Math.abs(top - m.blocks[i])).toBeLessThanOrEqual(1));
    if (width === 1280) expect(m.staff / 1280).toBeGreaterThanOrEqual(0.9);
  });
}
