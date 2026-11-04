/**
 * INV-019 against a real build of main, the comparison round 1 could not make. Measures the
 * strip, the neck, the five stable controls and page scroll at 375x667 in both themes on any
 * build. BASELINE_OUT writes them; BASELINE_IN compares this build against that file, whole.
 * Outside a baseline run it skips itself. See playwright.baseline.config.ts.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { columns, fret, PHONE, startCapturing, THEMES } from "./probe-helpers";

const OUT = process.env.BASELINE_OUT;
const IN = process.env.BASELINE_IN;

const measure = (page: Page) =>
  page.evaluate(() => {
    const rect = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    const strip = document.querySelector('[data-testid="latch-strip"]')!;
    const stable = document.querySelector('[data-testid="toolbar-stable"]')!;
    return {
      strip: rect(strip),
      firstChipHeight: rect(strip.querySelector("button")!).h,
      neck: rect(document.querySelector('[data-testid="fret-grid"]')!),
      row1: rect(stable),
      stable: [...stable.querySelectorAll("button")].map(rect),
      row2: rect(document.querySelector('[data-testid="toolbar-contextual"]')!),
      overY: document.scrollingElement!.scrollHeight - document.scrollingElement!.clientHeight,
      overX: document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth,
    };
  });

for (const theme of THEMES) {
  test(`INV-019 layout against a main build, ${theme}`, async ({ page }) => {
    test.skip(!OUT && !IN, "only in a baseline run");
    await page.setViewportSize(PHONE);
    await page.emulateMedia({ colorScheme: theme });
    await startCapturing(page);
    await fret(page, "A", 5).click();
    await fret(page, "A", 7).click();
    await expect(columns(page)).toHaveCount(2);
    const m = await measure(page);
    console.log(`MEASURE ${theme} ${JSON.stringify(m)}`);
    const file = `${OUT ?? IN}.${theme}.json`;
    if (OUT) writeFileSync(file, JSON.stringify(m));
    else expect(m).toEqual(JSON.parse(readFileSync(file, "utf8")));
  });
}
