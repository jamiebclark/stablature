/**
 * INV-012: the inspector's duration buttons are note symbols, in order, named in words, lit by value.
 */
import { expect, test } from "@playwright/test";
import { columns, details, inspector } from "./capture-surface-helpers";
import { seed } from "./rhythm-probe-helpers";

const IDS = ["w", "h", "q", "8", "16", "32"];

for (const stored of [null, ...IDS, "64"]) {
  test(`INV-012 six symbols, one line, lit by value (${stored})`, async ({ page }, info) => {
    const { partUrl } = await seed(page, [{ d: stored }, { d: null }], { arrange: false });
    await page.goto(partUrl);
    await columns(page).first().click();
    await details(page).click();
    await expect(inspector(page)).toBeVisible();
    const rows = await page.getByTestId("duration-row").getByRole("button").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          id: el.getAttribute("data-duration"),
          label: el.getAttribute("aria-label"),
          title: el.getAttribute("title"),
          pressed: el.getAttribute("aria-pressed"),
          text: el.textContent,
          symbol: !!el.querySelector("svg[data-part=note-symbol]"),
          top: r.top,
          w: r.width,
          h: r.height,
        };
      }),
    );
    expect(rows.map((r) => r.id)).toEqual(IDS);
    for (const r of rows) {
      expect(r.text).toBe("");
      expect(r.symbol).toBe(true);
      expect(r.title).toBe(r.label);
      expect(r.label).toMatch(/note$/);
      expect(r.pressed).toBe(r.id === stored ? "true" : "false");
      expect(r.top).toBeCloseTo(rows[0].top, 0);
      expect(r.h).toBeGreaterThanOrEqual(44);
      if (info.project.name === "mobile") expect(r.w).toBeGreaterThanOrEqual(54);
    }
  });
}

test("INV-012 lit and unlit buttons differ in greyscale", async ({ page }) => {
  const { partUrl } = await seed(page, [{ d: "q" }, { d: null }], { arrange: false });
  await page.goto(partUrl);
  await columns(page).first().click();
  await details(page).click();
  await expect(inspector(page)).toBeVisible();
  const grey = (id: string) =>
    page.locator(`[data-testid=duration-row] button[data-duration="${id}"]`).evaluate((el) => {
      const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)!.map(Number);
      return 0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2];
    });
  expect(Math.abs((await grey("q")) - (await grey("8")))).toBeGreaterThan(20);
});
