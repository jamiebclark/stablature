import { expect, test } from "@playwright/test";
import { cols, patchSong, recorder, seed } from "./rhythm-probe-helpers";

test.setTimeout(120_000);

const PART = cols("q", "q", "q", "q", "|", "q", "q", "q", "q");

/** A log of every change of the highlight, installed before the click starts. */
const watch = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __hl: { t: number; key: string | null }[] };
    w.__hl = [];
    const read = () => document.querySelector(".tab-column-reading")?.getAttribute("data-column") ?? null;
    let last = read();
    new MutationObserver(() => {
      const now = read();
      if (now !== last) w.__hl.push({ t: performance.now(), key: (last = now) });
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"], childList: true });
  });

test("INV-035 the highlight appears only while following, and leaves at the stop", async ({ page }) => {
  await recorder(page);
  const { playUrl } = await seed(page, PART, { bpm: 300 });
  await page.goto(playUrl);
  await expect(page.getByTestId("tab-staff").first()).toBeVisible();
  await expect(page.locator(".tab-column-reading")).toHaveCount(0);
  await watch(page);
  await page.getByTestId("click-start").click();
  await expect(page.locator(".tab-column-reading")).toHaveCount(1);
  await page.getByTestId("click-stop").click();
  await expect(page.locator(".tab-column-reading")).toHaveCount(0);
  const log = await page.evaluate(() => (window as unknown as { __hl: unknown[] }).__hl);
  expect(log.length).toBeGreaterThan(1);
});

test("INV-037 the highlight is a full outline, not the selection's look, and not printed", async ({ page }) => {
  await recorder(page);
  const { playUrl } = await seed(page, PART, { bpm: 60 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").click();
  const hl = page.locator(".tab-column-reading");
  await expect(hl).toHaveCount(1);
  await expect.poll(() => hl.evaluate((el) => getComputedStyle(el).outlineStyle).catch(() => "gone")).toBe("solid");
  await page.emulateMedia({ media: "print" });
  await expect.poll(() => hl.evaluate((el) => getComputedStyle(el).outlineStyle).catch(() => "none")).toBe("none");
});

test("INV-037 reading away pauses following, and it resumes after a rest", async ({ page }) => {
  await recorder(page);
  const { playUrl } = await seed(page, PART, { bpm: 40 });
  await page.setViewportSize({ width: 375, height: 500 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").click();
  await expect(page.locator(".tab-column-reading")).toHaveCount(1, { timeout: 15_000 });
  await page.mouse.wheel(0, 40);
  await page.waitForTimeout(300);
  const y = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(1500);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - y)).toBeLessThanOrEqual(2);
});

test("INV-037 a scroll key pauses following like the wheel does", async ({ page }) => {
  await recorder(page);
  const { playUrl } = await seed(page, PART, { bpm: 40 });
  await page.setViewportSize({ width: 375, height: 500 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").click();
  await expect(page.locator(".tab-column-reading")).toHaveCount(1, { timeout: 15_000 });
  await page.locator("body").press("PageDown");
  await page.waitForTimeout(300);
  const y = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(1500);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - y)).toBeLessThanOrEqual(2);
});

test("INV-037 reduced motion still shows the highlight", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await recorder(page);
  const { playUrl } = await seed(page, PART, { bpm: 300 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").click();
  await expect(page.locator(".tab-column-reading")).toHaveCount(1);
});

test("INV-037 a touch swipe pauses following like the wheel does", async ({ page }) => {
  await recorder(page);
  const { playUrl } = await seed(page, PART, { bpm: 40 });
  await page.setViewportSize({ width: 375, height: 500 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").click();
  await expect(page.locator(".tab-column-reading")).toHaveCount(1, { timeout: 15_000 });
  await page.evaluate(() => {
    document.dispatchEvent(new Event("touchmove", { bubbles: true }));
    window.scrollBy(0, 40);
  });
  await page.waitForTimeout(300);
  const y = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(1500);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - y)).toBeLessThanOrEqual(2);
});

const WIDE = cols(...Array.from({ length: 24 }, () => "q"));

/** The bar's own scroller, pushed far enough that it has somewhere to go. */
const wideRun = async (page: import("@playwright/test").Page) => {
  const run = page.locator(".tab-bar-run").first();
  await expect.poll(() => run.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  return run;
};

for (const how of ["wheel", "touch swipe", "scroll key"] as const) {
  test(`INV-037 a ${how} on a wide bar's own scroller pauses following`, async ({ page }) => {
    await recorder(page);
    const { playUrl } = await seed(page, WIDE, { bpm: 40 });
    await page.setViewportSize({ width: 375, height: 500 });
    await page.goto(playUrl);
    const run = await wideRun(page);
    await page.getByTestId("click-start").click();
    await expect(page.locator(".tab-column-reading")).toHaveCount(1, { timeout: 15_000 });
    const box = (await run.boundingBox())!;
    if (how === "wheel") {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(60, 0);
    } else if (how === "touch swipe") {
      await run.evaluate((el) => {
        el.dispatchEvent(new Event("touchmove", { bubbles: true }));
        el.scrollLeft += 60;
      });
    } else {
      await run.evaluate((el) => el.focus?.());
      await page.keyboard.press("PageDown");
    }
    await page.waitForTimeout(300);
    const at = await run.evaluate((el) => el.scrollLeft);
    const y = await page.evaluate(() => window.scrollY);
    await page.waitForTimeout(1500);
    expect(Math.abs((await run.evaluate((el) => el.scrollLeft)) - at)).toBeLessThanOrEqual(2);
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - y)).toBeLessThanOrEqual(2);
  });
}

test("INV-037 a column removed mid-run leaves one highlight and the run going", async ({ page }) => {
  await recorder(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const { playUrl } = await seed(page, PART, { bpm: 120 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").click();
  await expect(page.locator(".tab-column-reading")).toHaveCount(1);
  await page.locator(".tab-column-reading").evaluate((el) => el.remove());
  await watch(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __hl: unknown[] }).__hl.length)).toBeGreaterThan(0);
  await expect(page.locator(".tab-column-reading")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("INV-037 a sync write mid-run keeps the highlight", async ({ page }) => {
  await recorder(page);
  const { playUrl } = await seed(page, PART, { bpm: 60 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").click();
  await expect(page.locator(".tab-column-reading")).toHaveCount(1);
  await watch(page);
  await patchSong(page, { title: "Changed elsewhere" });
  await page.waitForTimeout(1500);
  await expect(page.locator(".tab-column-reading")).toHaveCount(1);
  const log = await page.evaluate(() => (window as unknown as { __hl: { key: string | null }[] }).__hl);
  expect(log.filter((l) => l.key === null)).toEqual([]);
});
