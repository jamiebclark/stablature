/**
 * Spec 010 quickstart §1.2. Run on the UNEDITED build, once, to write e2e/fixtures/narrow-before.json: the narrow markup
 * and rects that wide-narrow-unchanged.spec.ts later holds the new code to (INV-001). Records only.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { seedSong, type EntrySpec, type PartSpec } from "./reading-helpers";
import { cols, seed } from "./rhythm-probe-helpers";
import { plainBars as bars, FIT_PARTS } from "./wide-helpers";

test.setTimeout(600_000);

/** Linux gets its own file: it rounds glyph positions, so the same build draws differently there (spec 007 T183). */
const OUT = `e2e/fixtures/narrow-before${process.platform === "linux" ? ".linux" : ""}.json`;

interface Size {
  name: string;
  width: number;
  height: number;
  touch: boolean;
}
const SIZES: Size[] = [
  { name: "375x667-touch", width: 375, height: 667, touch: true },
  { name: "412x915-touch", width: 412, height: 915, touch: true },
  { name: "767x1024-mouse", width: 767, height: 1024, touch: false },
];

/** The four songs: none has a repeated entry. */
const SONGS: Record<string, { parts: PartSpec[]; entries: EntrySpec[] }> = {
  one: { parts: [{ key: "a", label: "A", columns: bars(3) }], entries: [{ part: "a" }] },
  "fit-once": {
    parts: FIT_PARTS,
    entries: [{ part: "a" }, { part: "a2" }, { part: "b" }, { part: "c" }],
  },
  variant: {
    parts: [
      { key: "a", label: "A", columns: bars(3) },
      { key: "a2", label: "A'", variantOf: "a", columns: bars(3, 4) },
    ],
    entries: [{ part: "a" }, { part: "a2" }],
  },
  sliced: { parts: [{ key: "a", label: "A", columns: bars(4) }], entries: [{ part: "a", fromBar: 2, toBar: 3 }] },
};

const context = (browser: Browser, baseURL: string, s: { width: number; height: number; touch: boolean }) =>
  browser.newContext({ baseURL, viewport: { width: s.width, height: s.height }, hasTouch: s.touch, isMobile: s.touch });

/** `main`'s markup with every per-run identifier removed, so two seeds of one song compare equal. */
const markup = (page: Page) =>
  page.evaluate(() => {
    const html = document.querySelector("main")!.outerHTML;
    return html
      .replace(/\s(?:id|for|aria-controls|aria-labelledby|aria-describedby)="[^"]*"/g, "")
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "UUID");
  });

const rects = (page: Page) =>
  page.evaluate(() => {
    const r = (x: number) => Math.round(x * 10) / 10;
    const out: Record<string, number[][]> = {};
    const groups: Record<string, string> = {
      card: "main ol.grid > li, main ul.grid > li",
      staff: ".tab-staff",
      column: '[data-testid="tab-column"]',
      run: ".tab-bar-run",
    };
    for (const [name, sel] of Object.entries(groups)) {
      out[name] = [...document.querySelectorAll(sel)].map((el) => {
        const b = el.getBoundingClientRect();
        return [r(b.left + scrollX), r(b.top + scrollY), r(b.width), r(b.height)];
      });
    }
    return out;
  });

test("record the narrow layout", async ({ browser, baseURL }) => {
  const record: Record<string, unknown> = {};
  for (const size of SIZES) {
    for (const [song, spec] of Object.entries(SONGS)) {
      const ctx = await context(browser, baseURL!, size);
      const page = await ctx.newPage();
      const { songUrl, playUrl } = await seedSong(page, spec.parts, spec.entries);
      for (const [pageName, url] of [["song", songUrl], ["play", playUrl]] as const) {
        await page.goto(url);
        await expect(page.getByTestId("tab-staff").first()).toBeVisible();
        await page.waitForTimeout(300);
        record[`${song} | ${size.name} | ${pageName}`] = { html: await markup(page), rects: await rects(page) };
      }
      await ctx.close();
    }
  }

  // The bar, idle and running, on a timed one-pass song.
  const heights: Record<string, { idle: number; running: number }> = {};
  for (const width of [375, 412, 768, 1024, 1280, 1440]) {
    const ctx = await context(browser, baseURL!, { width, height: 900, touch: width <= 412 });
    const page = await ctx.newPage();
    const { playUrl } = await seed(page, cols("q", "q", "|", "q", "q"), { bpm: 120 });
    await page.goto(playUrl);
    const bar = page.getByTestId("click-bar");
    await expect(bar).toBeVisible();
    await page.waitForTimeout(300);
    const idle = (await bar.boundingBox())!.height;
    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-stop")).toBeVisible();
    await page.waitForTimeout(300);
    heights[String(width)] = { idle, running: (await bar.boundingBox())!.height };
    await ctx.close();
  }
  record.bar = heights;

  mkdirSync("e2e/fixtures", { recursive: true });
  writeFileSync(OUT, JSON.stringify(record, null, 1) + "\n");
  console.log(JSON.stringify(heights));
});
