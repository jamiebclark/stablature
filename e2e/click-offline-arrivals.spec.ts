/**
 * INV-031 / FR-041 / FR-042 / SC-007, and the spec's FU25 warning: Stories 1 and 2 with the network
 * off, arriving by direct open, by in-app link from the song page and by in-app link from the band
 * page, each after a visit online. Zero requests from the click or the sheet.
 */
import { expect, test, type Page } from "@playwright/test";
import { cols, rec, recorder, seed, tapAt } from "./rhythm-probe-helpers";

async function warm(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30_000 });
  await expect
    .poll(
      () =>
        page.evaluate(async (key) => {
          const cache = await caches.open("stablature-pages-v1");
          return Boolean(await cache.match(key, { ignoreVary: true }));
        }, path),
      { timeout: 30_000, message: `${path} never reached the page cache` },
    )
    .toBe(true);
}

async function storyOneAndTwo(page: Page) {
  await expect(page.getByTestId("click-bar")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(600);
  const requests: string[] = [];
  const listen = (r: { url(): string }) => requests.push(r.url());
  page.on("request", listen);
  await page.getByTestId("click-start").click();
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await expect
    .poll(async () => (await rec(page)).starts.length, { timeout: 8000 })
    .toBeGreaterThanOrEqual(6);
  await page.getByTestId("click-stop").click();

  await page.getByTestId("tempo-control").click();
  await tapAt(page, [1000, 1400, 1800]);
  await expect(page.getByTestId("tempo-reading")).toHaveText("150");
  await page.getByTestId("tempo-set").click();
  await expect(page.getByTestId("tempo-control")).toHaveText("150 bpm");
  page.off("request", listen);
  expect(requests.filter((u) => !u.startsWith("data:") && !u.startsWith("blob:"))).toEqual([]);
}

const playLink = (page: Page) => page.getByRole("link", { name: "Play view" });

for (const arrival of ["direct open", "link from the song page", "link from the band page"] as const) {
  test(`INV-031 offline, ${arrival}`, async ({ page, context }) => {
    await recorder(page);
    const { songUrl, playUrl } = await seed(page, cols(null, null), { bpm: 120 });
    const songPath = new URL(songUrl).pathname;
    const playPath = new URL(playUrl).pathname;
    await page.goto("/");
    await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30_000 });
    await warm(page, "/");
    await page.getByRole("link", { name: /Hollow Crown/ }).first().click();
    await expect(page).toHaveURL(/\/bands\//);
    const bandPath = new URL(page.url()).pathname;
    await warm(page, bandPath);
    await warm(page, songPath);
    await warm(page, playPath);
    // Reach the routes in-app once while online too, as a person does.
    await page.goto(bandPath);
    await page.getByRole("link", { name: /Dirge/ }).first().click();
    await expect(page).toHaveURL(songPath);
    await playLink(page).click();
    await expect(page).toHaveURL(playPath);
    await expect(page.getByTestId("click-bar")).toBeVisible();
    await page.waitForTimeout(1500);

    await context.setOffline(true);
    if (arrival === "direct open") {
      await page.goto(playPath);
    } else if (arrival === "link from the song page") {
      await page.goto(songPath);
      await playLink(page).click();
      await expect(page).toHaveURL(playPath, { timeout: 15_000 });
    } else {
      await page.goto(bandPath);
      await page.getByRole("link", { name: /Dirge/ }).first().click();
      await expect(page).toHaveURL(songPath, { timeout: 15_000 });
      await playLink(page).click();
      await expect(page).toHaveURL(playPath, { timeout: 15_000 });
    }
    await storyOneAndTwo(page);
    await context.setOffline(false);
  });
}
