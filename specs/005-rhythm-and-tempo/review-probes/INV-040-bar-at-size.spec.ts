/**
 * INV-040 / FR-026: every control of the bar reachable and >=44px at the top, middle and end of a
 * 40-pass song, not covering the last staff at rest, not printed, no horizontal page scroll, on
 * 375x667 and desktop, with the follow choice and a three-digit tempo, idle and running, and with
 * the longest status line.
 */
import { expect, test, type Page } from "@playwright/test";
import { cols, recorder, seed } from "./helpers";

async function reachable(page: Page, id: string, where: string) {
  const loc = page.getByTestId(id);
  const box = (await loc.boundingBox())!;
  expect(box.height, `${id} height ${where}`).toBeGreaterThanOrEqual(44);
  expect(box.x, `${id} left ${where}`).toBeGreaterThanOrEqual(0);
  const width = await page.evaluate(() => innerWidth);
  expect(box.x + box.width, `${id} right edge ${where}`).toBeLessThanOrEqual(width);
  const hit = await page.evaluate(
    ([x, y, t]) => {
      const el = document.elementFromPoint(x as number, y as number);
      return el !== null && el.closest(`[data-testid=${t}]`) !== null;
    },
    [box.x + box.width / 2, box.y + box.height / 2, id] as const,
  );
  expect(hit, `${id} under the point ${where}`).toBe(true);
}

const noSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

const scrollAt = (page: Page, f: number) =>
  page.evaluate((x) => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * x), f);

for (const size of [
  { name: "375x667", viewport: { width: 375, height: 667 } },
  { name: "desktop", viewport: { width: 1280, height: 720 } },
]) {
  for (const theme of ["light", "dark"] as const) {
    test(`INV-040 ${size.name} ${theme}: timed song, three-digit tempo, 40 passes`, async ({ page }) => {
      await page.setViewportSize(size.viewport);
      await page.emulateMedia({ colorScheme: theme });
      await recorder(page);
      const { playUrl } = await seed(page, cols("q", "q", "|", "q", "q"), { bpm: 120, passes: 40 });
      await page.goto(playUrl);
      await expect(page.getByTestId("click-follow")).toBeVisible();
      for (const f of [0, 0.5, 1]) {
        await scrollAt(page, f);
        for (const id of ["click-start", "click-follow", "tempo-control"]) {
          await reachable(page, id, `idle ${f}`);
        }
        expect(await noSideways(page), `sideways idle ${f}`).toBe(true);
      }
      await page.getByTestId("click-start").click();
      await expect(page.getByTestId("click-stop")).toBeVisible();
      for (const f of [0, 0.5, 1]) {
        await scrollAt(page, f);
        for (const id of ["click-stop", "tempo-control"]) await reachable(page, id, `running ${f}`);
        expect(await noSideways(page), `sideways running ${f}`).toBe(true);
      }
      await scrollAt(page, 1);
      const last = (await page.locator("ol > li").last().boundingBox())!;
      const bar = (await page.getByTestId("click-bar").boundingBox())!;
      expect(last.y + last.height, "last staff clear of the bar").toBeLessThanOrEqual(bar.y + 1);

      // The longest status line, on the stopped bar.
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect(page.getByTestId("click-state")).toContainText("Stopped because");
      await reachable(page, "click-start", "with a long message");
      expect(await noSideways(page)).toBe(true);
    });
  }
}

test("INV-040 no arrangement: the bar is there and reachable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await recorder(page);
  const { playUrl } = await seed(page, cols(null), { bpm: 120, arrange: false });
  await page.goto(playUrl);
  await reachable(page, "click-start", "no arrangement");
  await reachable(page, "tempo-control", "no arrangement");
});

test("INV-040 the bar does not print, and the rhythm row does", async ({ page }) => {
  await recorder(page);
  const { playUrl } = await seed(page, cols("q", "q"), { bpm: 120 });
  await page.goto(playUrl);
  await expect(page.getByTestId("tab-rhythm").first()).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByTestId("click-bar")).toBeHidden();
  await expect(page.getByTestId("tab-rhythm").first()).toBeVisible();
});
