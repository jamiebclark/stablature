/**
 * FR-054 and INV-037: "the view MUST keep it on screen". A column under the docked cluster is not on screen,
 * and contract click.md section 5 says scroll padding follows the cluster so it never is. The existing spec only
 * reads that following pauses; it never reads where the column ends up, or that following resumes.
 */
import { expect, test, type Page } from "@playwright/test";
import { cols, recorder, seed } from "./rhythm-probe-helpers";

test.setTimeout(150_000);

/** Sixteen bars of four quarters each, drawn three times: tall enough to need following on any phone. */
const LONG = cols(...Array.from({ length: 16 }, (_, i) => ["q", "q", "q", "q", ...(i < 15 ? ["|"] : [])]).flat());

interface Seen {
  key: string | null;
  hidden: number;
  bottom: number;
  top: number;
}

/** Every highlight move is logged with where the column sits against the cluster. */
const watch = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __at: Seen[] };
    w.__at = [];
    let last: Element | null = null;
    const tick = () => {
      const el = document.querySelector(".tab-column-reading");
      if (el && el !== last) {
        last = el;
        // Read two frames later: with reduced motion the jump has landed by then.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const r = el.getBoundingClientRect();
            const c = document.querySelector('[data-testid="click-bar"]')!.getBoundingClientRect();
            w.__at.push({
              key: el.getAttribute("data-column"),
              hidden: Math.max(0, r.bottom - c.top),
              bottom: Math.round(r.bottom),
              top: Math.round(c.top),
            });
          }),
        );
      }
      requestAnimationFrame(tick);
    };
    tick();
  });

for (const size of [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
]) {
  test(`INV-037 the followed column is never under the cluster at ${size.width}x${size.height}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await recorder(page);
    const { playUrl } = await seed(page, LONG, { bpm: 300, passes: 3 });
    await page.setViewportSize(size);
    await page.goto(playUrl);
    await expect(page.getByTestId("tab-staff").first()).toBeVisible();
    await watch(page);
    await page.getByTestId("click-start").click();
    await expect(page.locator(".tab-column-reading")).toHaveCount(1, { timeout: 15_000 });
    await page.waitForTimeout(30_000);
    const log = await page.evaluate(() => (window as unknown as { __at: Seen[] }).__at);
    expect(log.length, "columns seen").toBeGreaterThan(40);
    const under = log.filter((l) => l.hidden > 1);
    expect(
      under.length,
      `${under.length} of ${log.length} columns sat under the cluster, worst ${Math.max(0, ...under.map((u) => u.hidden))}px`,
    ).toBe(0);
    const padding = await page.evaluate(() => document.documentElement.style.scrollPaddingBottom);
    expect(padding, "click.md section 5: scroll padding follows the cluster").not.toBe("");
  });
}

test("INV-037 following resumes after the four-second rest", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await recorder(page);
  const { playUrl } = await seed(page, LONG, { bpm: 300, passes: 3 });
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").click();
  await expect(page.locator(".tab-column-reading")).toHaveCount(1, { timeout: 15_000 });
  await page.mouse.move(180, 300);
  await page.mouse.wheel(0, 1500);
  await page.waitForTimeout(300);
  const away = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(3000);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - away), "left alone for the rest").toBeLessThanOrEqual(2);
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 6000, message: "following resumes" })
    .not.toBe(away);
});

test("INV-037 the highlight scrolls a bar wider than a line", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await recorder(page);
  const { playUrl } = await seed(page, cols(...Array.from({ length: 40 }, () => "q")), { bpm: 300 });
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").click();
  await expect(page.locator(".tab-column-reading")).toHaveCount(1, { timeout: 15_000 });
  await page.waitForTimeout(4000);
  const m = await page.evaluate(() => {
    const el = document.querySelector(".tab-column-reading");
    const run = document.querySelector(".tab-bar-run")!;
    if (!el) return null;
    const a = el.getBoundingClientRect();
    const b = run.getBoundingClientRect();
    return { left: run.scrollLeft, inside: a.left >= b.left - 1 && a.right <= b.right + 1 };
  });
  expect(m, "a column is highlighted").not.toBeNull();
  expect(m!.left, "the run scrolled").toBeGreaterThan(0);
  expect(m!.inside).toBe(true);
});
