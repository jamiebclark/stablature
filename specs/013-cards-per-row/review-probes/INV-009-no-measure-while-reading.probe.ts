/**
 * Review probe (round 3), INV-009 / plan "Performance Goals" ("no measuring while the reading position moves"):
 * `useCardTrack` has no dependency list, so it runs its measuring batch after every commit of the list's owner. Since
 * T043, each batch also writes the `style` attribute of every head row (width/flex-wrap) and of every `.no-print` head
 * item, then restores it.
 *
 * Walk the play view with real key presses (one commit at a time) and count `style` mutations on head rows and their
 * descendants. Records mean a measuring batch ran while the position moved. No `li` style may change (INV-009 as
 * worded), and no card may move. Both are asserted. The head-row count is logged, not asserted (a performance goal).
 */
import { expect, test } from "@playwright/test";
import { seedFitSong } from "../../../e2e/wide-helpers";
import { settle } from "./measure";

test.setTimeout(300_000);
type Urls = { songUrl: string; playUrl: string };

test("INV-009 a play-view key walk: what the hook measures while the position moves", async ({ page }, info) => {
  test.skip(info.project.name !== "probe-desktop", "keys, desktop");
  const urls = (await seedFitSong(page)) as unknown as Urls;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(urls.playUrl);
  await expect(page.locator("ol.reading-cards > li [data-column]").first()).toBeAttached();
  await settle(page);
  await page.evaluate(() => {
    const w = window as unknown as { __rec: { head: number; li: number } };
    w.__rec = { head: 0, li: 0 };
    const list = document.querySelector(".reading-cards")!;
    new MutationObserver((rs) => {
      for (const r of rs) {
        const el = r.target as HTMLElement;
        if (el.parentElement === list) w.__rec.li++;
        else if (el.closest(".reading-card > :first-child")) w.__rec.head++;
      }
    }).observe(list, { attributes: true, subtree: true, attributeFilter: ["style"] });
  });
  const rects = () => page.evaluate(() => [...document.querySelectorAll(".reading-cards > li")].map((li) => JSON.stringify(li.getBoundingClientRect())));
  const before = await rects();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(30);
  }
  const rec = await page.evaluate(() => (window as unknown as { __rec: { head: number; li: number } }).__rec);
  const reading = await page.locator(".tab-column-reading").count();
  console.log(`key walk @1280, 40 steps: head-row style records ${rec.head}, li style records ${rec.li}, reading column drawn ${reading}`);
  expect(reading, "the walk moved the position").toBeGreaterThan(0);
  expect(rec.li).toBe(0);
  expect(await rects()).toEqual(before);
  // The probe can see a batch: a resize runs one (the ResizeObserver on each head), which writes head styles.
  await page.setViewportSize({ width: 1180, height: 900 });
  await settle(page);
  const after = await page.evaluate(() => (window as unknown as { __rec: { head: number; li: number } }).__rec);
  console.log(`after a resize: head-row style records ${after.head}`);
  expect(after.head).toBeGreaterThan(rec.head);
});
