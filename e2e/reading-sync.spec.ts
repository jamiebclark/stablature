import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { fret, startCapturing } from "./capture-surface-helpers";
import { idb, seedReadable, view } from "./reading-helpers";

/** INV-003: the view belongs to the device. A second device is unaffected and the first queued no write. */

test.skip(!process.env.STABLATURE_DATABASE_URL, "STABLATURE_DATABASE_URL is not set");

const outboxCount = (page: Page) =>
  page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    let total = 0;
    for (const info of dbs) {
      if (!info.name) continue;
      const db = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open(info.name!);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      if (Array.from(db.objectStoreNames).includes("outbox")) {
        total += await new Promise<number>((res, rej) => {
          const r = db.transaction("outbox").objectStore("outbox").count();
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      }
      db.close();
    }
    return total;
  });

test("choosing notes on one device leaves another signed-in device on frets and queues nothing", async ({ browser }) => {
  const id = randomUUID().slice(0, 8);
  const first = await browser.newPage();
  await first.goto("/sign-up");
  await first.getByLabel("Name").fill(`Tester ${id}`);
  await first.getByLabel("Email").fill(`tester-${id}@example.test`);
  await first.getByLabel("Password").fill("practice-space-5");
  await first.getByRole("button", { name: "Create account" }).click();
  await expect(first).toHaveURL(/\/$/);
  const { songUrl } = await seedReadable(first);
  // Let the seeding drain to the server, so the second device has a song to open.
  const drained = await expect
    .poll(() => outboxCount(first), { timeout: 15_000 })
    .toBe(0)
    .then(() => true, () => false);
  // A skip is not a pass: with no reachable sync server the second device can never see the song.
  test.skip(!drained, "the outbox never drained, so sync is not reaching a database from here");
  const before = await outboxCount(first);

  await view(first, "notes").click();
  await first.waitForTimeout(500);
  expect(await outboxCount(first)).toBe(before);

  const second = await browser.newPage();
  await second.goto("/sign-in");
  await second.getByLabel("Email").fill(`tester-${id}@example.test`);
  await second.getByLabel("Password").fill("practice-space-5");
  await second.getByRole("button", { name: "Sign in" }).click();
  await second.goto(songUrl);
  await expect(second.getByTestId("staff-view")).toBeVisible({ timeout: 30_000 });
  await expect(view(second, "frets")).toHaveAttribute("aria-pressed", "true");
});

// --- two devices through a real server (review F1) ---
const outbox = (page: Page) => idb<number>(page, `return (await all("outbox")).length;`);

const signUp = async (browser: Browser, id: string) => {
  const page = await browser.newPage();
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(`Probe ${id}`);
  await page.getByLabel("Email").fill(`probe-${id}@example.test`);
  await page.getByLabel("Password").fill("practice-space-5");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  return page;
};
const signIn = async (browser: Browser, id: string) => {
  const page = await browser.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(`probe-${id}@example.test`);
  await page.getByLabel("Password").fill("practice-space-5");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  return page;
};

/** A song on one device, drained, and open on a second. */
async function twoDevices(browser: Browser) {
  const id = randomUUID().slice(0, 8);
  const first = await signUp(browser, id);
  const { songUrl, partUrl } = await startCapturing(first, `Probe band ${id}`);
  await fret(first, "E", 7).click();
  await fret(first, "A", 5).click();
  await fret(first, "D", 3).click();
  await expect(first.getByTestId("tab-column")).toHaveCount(3);
  await first.goto(songUrl);
  await first.getByRole("button", { name: "Each part once" }).click();
  await expect(first.getByTestId("roadmap-chip")).toHaveCount(1);
  await expect.poll(() => outbox(first), { timeout: 30_000 }).toBe(0);
  const second = await signIn(browser, id);
  await second.goto(songUrl);
  await expect(second.getByTestId("tab-column").first()).toBeVisible({ timeout: 30_000 });
  await expect(second.getByTestId("tab-column")).toHaveCount(3, { timeout: 30_000 });
  return { first, second, songUrl, partUrl };
}

/** Every line and mark a device ever shows, from now on. */
const record = (page: Page) =>
  page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __seen: string[] }).__seen = seen;
    const read = () => {
      for (const el of document.querySelectorAll('[data-testid="variant-line"], [data-testid="tab-removal"], [data-diff]')) {
        seen.push(el.getAttribute("data-testid") === "variant-line" ? (el.textContent ?? "") : `mark: ${el.textContent}`);
      }
    };
    new MutationObserver(read).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
const recorded = (page: Page) => page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);

test("INV-003 (two devices) the view stays on its device, and queues nothing", async ({ browser }) => {
  const { first, second } = await twoDevices(browser);
  const before = await outbox(first);
  const writes: string[] = [];
  first.on("request", (r) => {
    if (r.method() !== "GET") writes.push(`${r.method()} ${r.url()}`);
  });
  const views = ["frets", "intervals", "notes"];
  for (let i = 0; i < 100; i += 1) await first.getByTestId(`staff-view-${views[i % 3]}`).click();
  await expect(first.getByTestId("staff-view-notes")).toHaveAttribute("aria-pressed", "false");
  await first.getByTestId("staff-view-notes").click();
  await first.waitForTimeout(800);
  expect(await outbox(first)).toBe(before);
  expect(writes).toEqual([]);
  await second.reload();
  await expect(second.getByTestId("staff-view-frets")).toHaveAttribute("aria-pressed", "true");
  await first.reload();
  await expect(first.getByTestId("staff-view-notes")).toHaveAttribute("aria-pressed", "true");
});

test("INV-015 a variant arriving from another device shows only Same as A", async ({ browser }) => {
  const { first, second } = await twoDevices(browser);
  await record(first);
  for (let made = 1; made <= 4; made += 1) {
    await second.getByRole("button", { name: "+ variant" }).first().click();
    await expect(second.getByTestId("variant-line")).toHaveCount(made);
    await expect.poll(() => outbox(second), { timeout: 30_000 }).toBe(0);
    await expect(first.getByTestId("variant-line")).toHaveCount(made, { timeout: 30_000 });
  }
  const lines = await first.getByTestId("variant-line").allTextContents();
  expect(new Set(lines)).toEqual(new Set(["Same as A"]));
  expect([...new Set(await recorded(first))].filter((t) => t !== "Same as A")).toEqual([]);
});

test("INV-031 a pull reaches the marks with the page open", async ({ browser }) => {
  const { first, second } = await twoDevices(browser);
  await second.getByRole("button", { name: "+ variant" }).first().click();
  await expect(first.getByTestId("variant-line")).toHaveText("Same as A", { timeout: 30_000 });
  await second.getByRole("link", { name: "Edit" }).nth(1).click();
  await expect(second).toHaveURL(/\/capture\/[0-9a-f-]+$/);
  await expect(second.getByTestId("tab-column")).toHaveCount(3);
  await fret(second, "E", 3).click();
  await expect(second.getByTestId("tab-column")).toHaveCount(4);
  await expect(first.getByTestId("variant-line")).toHaveText("Differs from A in bar 1: 1 added", { timeout: 30_000 });
  await expect(first.locator('[data-diff="added"]')).toHaveCount(1);
});

// --- the read of a song during a sync (review F18, INV-015 / INV-031) ---
const syncState = (page: Page) =>
  idb<string | undefined>(page, `return (await all("meta")).find((m) => m.key === "syncStatus")?.value?.state;`);

/** Hold every pull for `ms`, as a slow connection does. 0 never answers, as a dead one does. */
const slowPull = (page: Page, ms: number) =>
  page.route("**/api/sync/pull**", async (route) => {
    if (ms === 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue().catch(() => {});
  });

/** A signed-in device holding one drained song. */
async function signedInWithASong(browser: Browser) {
  const id = randomUUID().slice(0, 8);
  const page = await signUp(browser, id);
  const { songUrl } = await startCapturing(page, `Probe band ${id}`);
  await fret(page, "E", 7).click();
  await expect(page.getByTestId("tab-column")).toHaveCount(1);
  await page.goto(songUrl);
  await page.getByRole("button", { name: "Each part once" }).click();
  await expect(page.getByTestId("roadmap-chip")).toHaveCount(1);
  await expect.poll(() => outbox(page), { timeout: 30_000 }).toBe(0);
  return { page, id, songUrl, playUrl: `${songUrl}/play` };
}

/** A staff with a cell in it. A play view waiting for its columns draws an empty one. */
const firstCell = (page: Page) => page.locator('[data-testid="tab-column"] .tab-cell > span').first();

const untilDrawn = async (page: Page, open: () => Promise<unknown>) => {
  const started = Date.now();
  await open();
  await firstCell(page).waitFor({ state: "visible", timeout: 25_000 });
  return Date.now() - started;
};

const DRAWN_WITHIN = 3_000;

test("INV-015 a reload in the middle of a slow pull draws what is on the device", async ({ browser }) => {
  test.setTimeout(120_000);
  const { page, songUrl } = await signedInWithASong(browser);
  await slowPull(page, 6_000);
  await page.reload();
  await expect.poll(() => syncState(page), { timeout: 10_000 }).toBe("syncing");
  const ms = await untilDrawn(page, () => page.goto(songUrl));
  expect(ms).toBeLessThan(DRAWN_WITHIN);
});

for (const surface of ["song page", "play view"] as const) {
  test(`INV-015 an in-app link during a pull that never answers: ${surface}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const { page, songUrl } = await signedInWithASong(browser);
    await slowPull(page, 0);
    await page.goto(new URL(songUrl).origin);
    await expect.poll(() => syncState(page), { timeout: 10_000 }).toBe("syncing");
    await page.locator('a[href^="/bands/"]').first().click();
    await expect(page).toHaveURL(/\/bands\//);
    const ms = await untilDrawn(page, async () => {
      await page.locator(`a[href$="${new URL(songUrl).pathname}"]`).first().click();
      await expect(page).toHaveURL(songUrl);
      if (surface === "play view") {
        await page.getByRole("link", { name: "Play view" }).click();
        await expect(page).toHaveURL(/\/play$/);
      }
    });
    expect(ms).toBeLessThan(DRAWN_WITHIN);
  });
}

test("INV-015 a `syncing` left by a killed tab holds no page offline, on any open", async ({ browser }) => {
  test.setTimeout(120_000);
  const { page, songUrl, playUrl } = await signedInWithASong(browser);
  const context = page.context();
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
  expect({ first: first < DRAWN_WITHIN, second: second < DRAWN_WITHIN }, `song ${first} ms, play ${second} ms`).toEqual({
    first: true,
    second: true,
  });
});

test("INV-031 a local edit during a sync reaches the page at once", async ({ browser }) => {
  test.setTimeout(120_000);
  const { page } = await signedInWithASong(browser);
  await slowPull(page, 6_000);
  const variant = page.getByRole("button", { name: "+ variant" }).first();
  await variant.click();
  await expect(page.getByTestId("variant-line")).toHaveCount(1);
  await expect.poll(() => syncState(page), { timeout: 10_000 }).toBe("syncing");
  const started = Date.now();
  await variant.click();
  await expect(page.getByTestId("variant-line")).toHaveCount(2, { timeout: 12_000 });
  expect(Date.now() - started).toBeLessThan(2_000);
});

test("INV-015 a pull slower than the stuck timer still lands whole", async ({ browser }) => {
  test.setTimeout(180_000);
  const { first, second } = await twoDevices(browser);
  await record(first);
  await slowPull(first, 11_500);
  for (let made = 1; made <= 3; made += 1) {
    await second.getByRole("button", { name: "+ variant" }).first().click();
    await expect(second.getByTestId("variant-line")).toHaveCount(made);
    await expect.poll(() => outbox(second), { timeout: 30_000 }).toBe(0);
    await expect(first.getByTestId("variant-line")).toHaveCount(made, { timeout: 40_000 });
  }
  expect([...new Set(await recorded(first))].filter((t) => t !== "Same as A")).toEqual([]);
});
