import { expect, test, type Page } from "@playwright/test";
import { addChord, addRests, columns, space, startWith, TUNINGS } from "./probe-helpers";

/**
 * Spec 008 US1: the capture band wraps when two whole lines fit, and puts the cursor's line at the bottom.
 * Production build only (the band's geometry is measured).
 */
test.setTimeout(240_000);

const SIX = TUNINGS[2];
const SIZES = [
  { width: 412, height: 915 },
  { width: 1280, height: 800 },
];

async function sixStringPart(page: Page, size: { width: number; height: number }, bars: number, chord = true) {
  await startWith(page, SIX);
  if (chord) {
    await space(page);
    await addChord(page, 0, "Am");
  }
  await page.setViewportSize(size);
  const barline = page.getByTestId("toolbar-stable").getByRole("button", { name: "Barline" });
  for (let bar = 0; bar < bars; bar++) {
    for (let i = 0; i < (bar === 0 && chord ? 2 : 3); i++) await space(page);
    await barline.click();
  }
  await expect(columns(page).last()).toBeVisible();
  await page.waitForTimeout(300);
}

/** Geometry read from the DOM: the band's content box, each run's rect, the caret's run. */
const read = (page: Page) =>
  page.evaluate(() => {
    const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
    const style = getComputedStyle(band);
    const box = band.getBoundingClientRect();
    const top = box.top + parseFloat(style.paddingTop);
    const bottom = box.bottom - parseFloat(style.paddingBottom);
    const runs = [...band.querySelectorAll<HTMLElement>(".tab-bar-run")].map((r) => r.getBoundingClientRect());
    const caretRun = document.querySelector('[data-testid="tab-caret"]')?.closest(".tab-bar-run")?.getBoundingClientRect() ?? null;
    const column = band.querySelector('[data-testid="tab-column"]')?.getBoundingClientRect();
    const inView = runs.filter((r) => r.bottom > top + 1 && r.top < bottom - 1);
    return {
      wrapped: !!band.querySelector(".tab-staff-wrapped"),
      top,
      bottom,
      line: column?.height ?? 0,
      gap: parseFloat(style.rowGap) || 0,
      caretBottom: caretRun?.bottom ?? null,
      blank: inView.length ? Math.min(...inView.map((r) => r.top)) - top : bottom - top,
      lineTopsInView: new Set(inView.map((r) => Math.round(r.top))).size,
      runTops: runs.map((r) => Math.round(r.top)),
    };
  });

for (const size of SIZES) {
  test(`INV-003 the cursor's line is the bottom line at ${size.width}x${size.height}`, async ({ page, isMobile }) => {
    test.skip(isMobile && size.width > 1000, "the touch rows leave one line at this height; desktop covers it");
    await sixStringPart(page, size, size.width > 1000 ? 48 : 16);
    const end = await read(page);
    expect(end.wrapped).toBe(true);
    expect(Math.abs(end.caretBottom! - end.bottom)).toBeLessThanOrEqual(1);
    expect(end.blank).toBeLessThan(end.line);

    // A write brings the line back to the bottom.
    await space(page);
    await page.waitForTimeout(400);
    const after = await read(page);
    expect(Math.abs(after.caretBottom! - after.bottom)).toBeLessThanOrEqual(1);

    // At the start: line 1 at the bottom, with only runway above it.
    await page.getByRole("button", { name: /start/ }).click();
    await page.waitForTimeout(400);
    const start = await read(page);
    expect(Math.abs(start.caretBottom! - start.bottom)).toBeLessThanOrEqual(1);
    expect(start.runTops.filter((t) => t > start.top).length).toBeGreaterThan(0);
  });

  test(`INV-002 wraps exactly when two lines fit at ${size.width}x${size.height}`, async ({ page }) => {
    await sixStringPart(page, size, 16);
    const m = await read(page);
    const content = m.bottom - m.top;
    expect(m.wrapped).toBe(content >= 2 * m.line + m.gap);
    if (m.wrapped) expect(m.lineTopsInView).toBeGreaterThanOrEqual(Math.min(2, new Set(m.runTops).size));
  });
}

test("INV-002 the mode does not flip back and forth over a height sweep", async ({ page }) => {
  await sixStringPart(page, SIZES[0], 6);
  const modes: boolean[] = [];
  for (let height = 600; height <= 1000; height += 40) {
    await page.setViewportSize({ width: 412, height });
    await page.waitForTimeout(150);
    const m = await read(page);
    expect(m.wrapped).toBe(m.bottom - m.top >= 2 * m.line + m.gap);
    modes.push(m.wrapped);
  }
  const flips = modes.filter((mode, i) => i > 0 && mode !== modes[i - 1]).length;
  expect(flips).toBeLessThanOrEqual(1);
});

test("INV-005 no line break moves when the cursor, a selection or a press moves", async ({ page }) => {
  await sixStringPart(page, SIZES[0], 16);
  const map = () =>
    page.evaluate(() => Object.fromEntries([...document.querySelectorAll<HTMLElement>("[data-column]")].map((c) => [c.dataset.column, Math.round(c.closest(".tab-bar-run")!.getBoundingClientRect().top - document.querySelector(".tab-lines")!.getBoundingClientRect().top)])));
  const base = await map();
  expect(Object.keys(base).length).toBeGreaterThan(40);
  const cols = columns(page);
  for (const i of [0, 7, 20, 40]) {
    await cols.nth(i).click();
    expect(await map()).toEqual(base);
  }
  await page.getByRole("button", { name: "select" }).click();
  await cols.nth(30).click();
  expect(await map()).toEqual(base);
  await page.getByRole("button", { name: "cancel" }).click();
  await page.getByRole("button", { name: /start/ }).click();
  expect(await map()).toEqual(base);
});

test("INV-008 a fret tap paints as fast wrapped as on one line", async ({ page }) => {
  await sixStringPart(page, SIZES[0], 16, false);
  const median = () =>
    page.evaluate(async () => {
      const button = [...document.querySelectorAll<HTMLElement>("button")].find((b) => /^.* string, fret 3,/.test(b.getAttribute("aria-label") ?? ""))!;
      const times: number[] = [];
      for (let i = 0; i < 40; i++) {
        const before = document.querySelectorAll('[data-testid="tab-column"]').length;
        const start = performance.now();
        button.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
        button.click();
        await new Promise<void>((done) => {
          const tick = () =>
            document.querySelectorAll('[data-testid="tab-column"]').length > before ? done() : requestAnimationFrame(tick);
          tick();
        });
        times.push(performance.now() - start);
      }
      return times.sort((a, b) => a - b)[20];
    });
  const wrapped = await median();
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(400);
  const one = await median();
  expect(wrapped).toBeLessThanOrEqual(one * 1.1 + 2 + 25);
});
void addRests;
