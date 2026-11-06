import { expect, test } from "@playwright/test";
import { installRecorder, seedPlayable } from "./click-helpers";

test("the bar is reachable at the start and the end of a long song, with 44px targets", async ({ page, isMobile }) => {
  await installRecorder(page);
  await seedPlayable(page, { passes: 12 });
  const bar = page.getByTestId("click-bar");
  for (const where of [0, 0.5, 1]) {
    await page.evaluate((f) => window.scrollTo(0, (document.body.scrollHeight - innerHeight) * f), where);
    for (const id of ["click-start", "tempo-control"]) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(isMobile ? 44 : 32);
      const hit = await page.evaluate(
        ([x, y, testid]) =>
          document.elementFromPoint(x as number, y as number)?.closest(`[data-testid=${testid}]`) !== null,
        [box.x + box.width / 2, box.y + box.height / 2, id],
      );
      expect(hit).toBe(true);
    }
  }
  const lastItem = (await page.locator("ol > li").last().boundingBox())!;
  const barBox = (await bar.boundingBox())!;
  expect(lastItem.y + lastItem.height).toBeLessThanOrEqual(barBox.y + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("the bar is hidden when printing", async ({ page }) => {
  await installRecorder(page);
  await seedPlayable(page);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByTestId("click-bar")).toBeHidden();
});
