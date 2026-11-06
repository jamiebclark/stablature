/**
 * Tries the brief's height recovery in the browser before the spec promises it, with a style tag and
 * no source change, and takes the figures the audit table could not: where the reading views start,
 * how much width they use, and what the seven-control selection row has to spare.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { addChord, columns } from "../../../e2e/capture-surface-helpers";
import { addRests, measureBand, selectColumns, selectionBar, startWith } from "../../../e2e/probe-helpers";
import { bar, g, n, seedSong, type Col } from "../../../e2e/reading-helpers";

const OUT = path.join(__dirname, "results");
const write = (name: string, data: unknown) => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data, null, 1));
};

/** The brief's recovery: one title-and-parts row, 46px toolbar rows, a 26px status row, 4px of band padding. */
const RECOVERED = `
  .h-dvh > header { height: 45px; padding-top: 0; padding-bottom: 0; }
  .h-dvh > header + div { display: none !important; }
  [data-testid="toolbar-stable"] { height: 46px; padding-top: 0; padding-bottom: 0; }
  [data-testid="toolbar-contextual"], [data-testid="toolbar-selection"], .h-dvh > .h-14 { height: 46px !important; padding-top: 0; padding-bottom: 0; }
  .h-dvh > div.overflow-hidden.whitespace-nowrap, .h-dvh > div.flex-wrap.border-t { height: 26px; padding-top: 0; padding-bottom: 0; }
  .h-dvh > div.overflow-y-auto { padding-top: 4px; padding-bottom: 0; }
`;

const CASES = [
  { family: "Bass 4", preset: "E Standard", strings: 4 },
  { family: "Bass 5", preset: "Drop A", strings: 5 },
  { family: "Guitar 6", preset: "E Standard", strings: 6 },
  { family: "Guitar 7", preset: "B Standard", strings: 7 },
] as const;

const fits = (page: Page) =>
  page.evaluate(() => {
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    const band = staff.parentElement!.parentElement!;
    const a = band.getBoundingClientRect();
    const s = staff.getBoundingClientRect();
    return {
      band: Math.round(a.height * 10) / 10,
      staff: Math.round(s.height * 10) / 10,
      overflow: band.scrollHeight - band.clientHeight,
      spare: Math.round((a.height - s.height) * 10) / 10,
      neckTop: Math.round(document.querySelector('[data-testid="latch-strip"]')!.getBoundingClientRect().top),
    };
  });

for (const tuning of CASES) {
  for (const height of [667, 553]) {
    test(`recovered ${tuning.strings} strings at ${height}`, async ({ page }) => {
      await startWith(page, tuning);
      await page.setViewportSize({ width: 375, height: 667 });
      await addRests(page, 6);
      await selectColumns(page, 1, 3);
      await selectionBar(page).getByRole("button", { name: "Group with no number" }).click();
      await page.waitForTimeout(150);
      await addChord(page, 2, "Cmaj7");
      await page.goto(page.url());
      await expect(columns(page).first()).toBeVisible();
      await page.setViewportSize({ width: 375, height });
      await page.waitForTimeout(150);
      const before = await fits(page);
      await page.addStyleTag({ content: RECOVERED });
      await page.waitForTimeout(150);
      const after = await fits(page);
      const band = await measureBand(page);
      write(`candidate-${tuning.strings}-${height}`, { before, after, band });
    });
  }
}

test("recovered while selecting, six strings", async ({ page }) => {
  await startWith(page, CASES[2]);
  await page.setViewportSize({ width: 375, height: 667 });
  await addRests(page, 8);
  await selectColumns(page, 1, 3);
  await selectionBar(page).getByRole("button", { name: "Group with no number" }).click();
  await page.waitForTimeout(150);
  await addChord(page, 2, "Cmaj7");
  await page.addStyleTag({ content: RECOVERED });
  await selectColumns(page, 1, 3);
  await page.waitForTimeout(150);
  const row = await selectionBar(page).evaluate((el) => ({
    client: el.clientWidth,
    scroll: el.scrollWidth,
    kids: [...el.children].map((c) => ({ n: c.getAttribute("aria-label") ?? c.textContent, w: Math.round(c.getBoundingClientRect().width * 10) / 10, right: Math.round(c.getBoundingClientRect().right) })),
  }));
  write("candidate-selecting", { fit: await fits(page), row });
});

const long = (): Col[] =>
  Array.from({ length: 16 }, (_, i) => [n(3 + (i % 5), { d: "8", chord: i % 4 === 0 ? "Am7" : undefined }), n(5, { d: "8" }), n(7, { d: "8" }), n(5, { d: "8" }), n(3, { d: "8" }), n(5, { d: "8" }), n(7, { d: "8" }), n(8, { d: "8" }), bar()]).flat().slice(0, -1);

const reading = (page: Page) =>
  page.evaluate(() => {
    const staff = document.querySelector('[data-testid="tab-staff"]');
    const scroller = document.querySelector('[aria-label="Tablature"]');
    const click = document.querySelector('[data-testid="click-bar"]');
    const column = document.querySelector('[data-testid="tab-column"]');
    return {
      vw: innerWidth,
      vh: innerHeight,
      staffTop: staff ? Math.round(staff.getBoundingClientRect().top + scrollY) : null,
      staffHeight: staff ? Math.round(staff.getBoundingClientRect().height) : null,
      strip: scroller ? { client: scroller.clientWidth, scroll: scroller.scrollWidth } : null,
      clickBar: click ? Math.round(click.getBoundingClientRect().height) : null,
      columnWidth: column ? Math.round(column.getBoundingClientRect().width * 10) / 10 : null,
      coarse: matchMedia("(pointer: coarse)").matches,
    };
  });

const MOUSE = { hasTouch: false, isMobile: false, deviceScaleFactor: 1 };

test("reading views, phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const { songUrl, playUrl } = await seedSong(page, [{ key: "a", label: "A", columns: long() }, { key: "b", label: "B", columns: [g("t", 3), g("t", 5), g("t", 7)] }], [{ part: "a", repeat: 2 }, { part: "b" }]);
  await page.goto(songUrl);
  await expect(page.getByTestId("tab-column").first()).toBeVisible();
  const song = await reading(page);
  await page.goto(playUrl);
  await expect(page.getByTestId("tab-column").first()).toBeVisible();
  const play = await reading(page);
  await page.addStyleTag({ content: ".tab-staff { font-family: var(--font-mono-face), monospace; }" });
  await page.waitForTimeout(300);
  write("reading-phone", { song, play, jetbrains: await reading(page) });
});

test.describe("mouse", () => {
  test.use({ ...MOUSE, viewport: { width: 1280, height: 800 } });
  test("reading views and capture, desktop", async ({ page }) => {
    const { playUrl, songId } = await seedSong(page, [{ key: "a", label: "A", columns: long() }], [{ part: "a" }]);
    await page.goto(playUrl);
    await expect(page.getByTestId("tab-column").first()).toBeVisible();
    const play = await reading(page);
    await page.goto(`/songs/${songId}/capture`);
    await expect(page.getByTestId("fret-grid")).toBeVisible();
    const capture = await page.evaluate(() => ({
      fine: matchMedia("(pointer: fine)").matches,
      neck: Math.round(document.querySelector('[data-testid="fret-grid"]')!.getBoundingClientRect().height),
      band: Math.round(document.querySelector('[data-testid="tab-staff"]')!.parentElement!.parentElement!.getBoundingClientRect().height),
      strip: { client: document.querySelector('[aria-label="Tablature"]')!.clientWidth, scroll: document.querySelector('[aria-label="Tablature"]')!.scrollWidth },
    }));
    await page.setViewportSize({ width: 500, height: 800 });
    await page.waitForTimeout(150);
    const narrow = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="fret-grid"]')!;
      return { fine: matchMedia("(pointer: fine)").matches, client: grid.clientWidth, scroll: grid.scrollWidth };
    });
    write("reading-desktop", { play, capture, narrow });
  });
});
