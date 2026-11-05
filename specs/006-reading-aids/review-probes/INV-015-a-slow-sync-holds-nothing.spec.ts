/**
 * The other side of INV-015, round 2. `src/lib/sync/client.ts:4`: "Nothing here is in the read path. Screens render
 * from IndexedDB and never wait on this." `SyncProvider.tsx:7`: "no screen waits on it". T056 asked for "no comparison
 * until a settled read exists", and for a `syncing` left by a killed tab not to hold a page. What landed holds the
 * whole read, so a staff already on the device waits for the network, and for 10 s on every open under a stale status.
 *
 * Signed in, because `SyncProvider` runs sync for nobody else. A fresh load can beat its own session fetch, so the
 * cases are the ones where `syncing` is already true at the first read: an in-app link, a reload, a status left behind.
 */
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { fret, startCapturing } from "../../../e2e/capture-surface-helpers";
import { idb } from "./helpers";

test.skip(!process.env.STABLATURE_DATABASE_URL, "STABLATURE_DATABASE_URL is not set");

const outbox = (page: Page) => idb<number>(page, `return (await all("outbox")).length;`);

/** A signed-in device holding one drained song. */
async function signedInWithASong(page: Page) {
  const id = randomUUID().slice(0, 8);
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(`Probe ${id}`);
  await page.getByLabel("Email").fill(`probe-${id}@example.test`);
  await page.getByLabel("Password").fill("practice-space-5");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  const { songUrl } = await startCapturing(page, `Probe band ${id}`);
  await fret(page, "E", 7).click();
  await expect(page.getByTestId("tab-column")).toHaveCount(1);
  await page.goto(songUrl);
  await page.getByRole("button", { name: "Each part once" }).click();
  await expect(page.getByTestId("roadmap-chip")).toHaveCount(1);
  await expect.poll(() => outbox(page), { timeout: 30_000 }).toBe(0);
  return { songUrl, playUrl: `${songUrl}/play` };
}

/** Hold every pull for `ms`, as a slow connection does. 0 never answers, as a dead one does. */
const slowPull = (page: Page, ms: number) =>
  page.route("**/api/sync/pull**", async (route) => {
    if (ms === 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue().catch(() => {});
  });

const syncState = (page: Page) =>
  idb<string | undefined>(page, `return (await all("meta")).find((m) => m.key === "syncStatus")?.value?.state;`);

/** A staff with a cell in it. A play view waiting for its columns draws an empty one. */
const firstCell = (page: Page) => page.locator('[data-testid="tab-column"] .tab-cell > span').first();

const untilDrawn = async (page: Page, open: () => Promise<unknown>) => {
  const started = Date.now();
  await open();
  await firstCell(page).waitFor({ state: "visible", timeout: 25_000 });
  return Date.now() - started;
};

const LIMIT = 3_000;

test("a reload in the middle of a slow pull draws what is on the device", async ({ page }) => {
  const { songUrl } = await signedInWithASong(page);
  await slowPull(page, 6_000);
  await page.reload();
  await expect.poll(() => syncState(page), { timeout: 10_000 }).toBe("syncing");
  const ms = await untilDrawn(page, () => page.goto(songUrl));
  expect(ms).toBeLessThan(LIMIT);
});

for (const surface of ["song page", "play view"] as const) {
  test(`an in-app link during a pull that never answers: ${surface}`, async ({ page }) => {
    const { songUrl } = await signedInWithASong(page);
    await slowPull(page, 0);
    await page.goto(new URL(songUrl).origin);
    await expect.poll(() => syncState(page), { timeout: 10_000 }).toBe("syncing");
    const band = page.locator('a[href^="/bands/"]').first();
    await band.click();
    await expect(page).toHaveURL(/\/bands\//);
    const ms = await untilDrawn(page, async () => {
      await page.locator(`a[href$="${new URL(songUrl).pathname}"]`).first().click();
      await expect(page).toHaveURL(songUrl);
      if (surface === "play view") {
        await page.getByRole("link", { name: "Play view" }).click();
        await expect(page).toHaveURL(/\/play$/);
      }
    });
    expect(ms).toBeLessThan(LIMIT);
  });
}

test("a `syncing` left by a killed tab holds no page offline, on any open", async ({ page, context }) => {
  const { songUrl, playUrl } = await signedInWithASong(page);
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30_000 });
  for (const url of [playUrl, songUrl]) {
    await page.goto(url);
    await firstCell(page).waitFor();
    const key = new URL(url).pathname;
    await expect
      .poll(
        () =>
          page.evaluate(
            async (k) => Boolean(await (await caches.open("stablature-pages-v1")).match(k, { ignoreVary: true })),
            key,
          ),
        { timeout: 30_000 },
      )
      .toBe(true);
  }
  await idb(
    page,
    `await write("meta", (s) => s.put({ key: "syncStatus", value: { state: "syncing", lastSyncedAt: null, message: null } }));`,
  );
  await context.setOffline(true);
  const first = await untilDrawn(page, () => page.goto(songUrl));
  const second = await untilDrawn(page, () => page.goto(playUrl));
  await context.setOffline(false);
  expect({ first: first < LIMIT, second: second < LIMIT }, `song ${first} ms, play ${second} ms`).toEqual({
    first: true,
    second: true,
  });
});
