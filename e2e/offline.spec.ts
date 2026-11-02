import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

/**
 * The installable, offline half of the app.
 *
 * The sync tests already prove capture survives losing signal mid-session.
 * What those cannot show is a *cold* open: the phone gets locked and pocketed
 * on the way out of the rehearsal room, and the next thing that happens is a
 * fresh page load with no network. Without a service worker that fails, no
 * matter how good the local data layer is.
 */

const unique = (prefix: string) => `${prefix} ${randomUUID().slice(0, 8)}`;

/** The worker claims clients on activation, so this settles without a reload. */
async function waitForServiceWorker(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 30_000,
  });
}

/**
 * Wait until the current route is in the page cache.
 *
 * The app warms it shortly after a client-side navigation. Waiting for that to
 * have happened is the honest precondition -- a real user spends minutes on a
 * page before pocketing the phone, not the few hundred milliseconds a test
 * takes to reach the next line.
 */
async function waitForPageCached(page: Page) {
  const path = new URL(page.url()).pathname;

  // expect.poll with page.evaluate rather than waitForFunction: an async
  // predicate handed to waitForFunction resolves on the truthy Promise itself
  // rather than on what it resolves to, so it would report success instantly
  // and this would quietly stop testing anything.
  await expect
    .poll(
      () =>
        page.evaluate(async (key) => {
          const cache = await caches.open("stablature-pages-v1");
          return Boolean(await cache.match(key, { ignoreVary: true }));
        }, path),
      { timeout: 30_000, message: `${path} was never added to the page cache` },
    )
    .toBe(true);
}

test("serves a web app manifest with icons", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);

  const manifest = (await response.json()) as {
    name: string;
    display: string;
    icons: { sizes: string; purpose?: string }[];
  };

  expect(manifest.name).toBe("stablature");
  // Installability requires standalone display and a 512px icon.
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((icon) => icon.sizes)).toContain("512x512");
  // Android crops icons to a circle unless one is declared maskable.
  expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
});

test("the icons it advertises actually exist", async ({ request }) => {
  for (const path of ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"]) {
    const response = await request.get(path);
    expect(response.ok(), `${path} is missing`).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
});

test("a visited page is served from cache with no network", async ({ page, context }) => {
  await page.goto("/");
  await waitForServiceWorker(page);

  const title = unique("Cold open");
  await page.getByLabel("Band name").fill(unique("Band"));
  await page.getByRole("button", { name: "Add band" }).click();
  await expect(page).toHaveURL(/\/bands\//);

  await page.getByLabel("Song title").fill(title);
  await page.getByRole("button", { name: "Add song" }).click();
  await expect(page).toHaveURL(/\/songs\//);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  // Capture something, so there is data to come back to.
  await page.goto(`${page.url()}/capture`);
  await page.getByRole("button", { name: "Add a part" }).click();
  await page.getByRole("button", { name: /^E string, fret 7,/ }).click();
  await expect(page.getByTestId("tab-column")).toHaveCount(1);

  const capturePath = new URL(page.url()).pathname;

  // Pocket the phone -- but only once the app has had its moment to cache this
  // route, which is what actually happens in the time it takes to pack up.
  await waitForPageCached(page);
  await context.setOffline(true);

  /*
   * Asserted by asking the service worker for the document rather than by
   * reloading the page. Under Playwright's offline emulation a reload is
   * failed above the service worker and never reaches it, so reloading would
   * test the harness rather than the app. This goes through the worker's fetch
   * handler -- the same code path a real cold open uses -- and proves it
   * answers with the real page and not the offline notice.
   */
  const served = await page.evaluate(async (path) => {
    const response = await fetch(path, { headers: { accept: "text/html" } });
    const body = await response.text();
    return { status: response.status, isOfflineNotice: body.includes("No connection") };
  }, capturePath);

  expect(served.status).toBe(200);
  expect(served.isOfflineNotice).toBe(false);

  // And capture carries on working with the network gone, which is the whole
  // point of being here.
  await page.getByRole("button", { name: /^A string, fret 5,/ }).click();
  await expect(page.getByTestId("tab-column")).toHaveCount(2);
});

test("a page never opened on this device shows the offline notice", async ({ page, context }) => {
  await page.goto("/");
  await waitForServiceWorker(page);

  await context.setOffline(true);

  // Nothing cached for this URL, so there is genuinely nothing to show.
  await page.goto(`/bands/${randomUUID()}`);
  await expect(page.getByRole("heading", { name: "No connection" })).toBeVisible({
    timeout: 20_000,
  });
  // The reassurance matters: nothing was ever stored on the server first.
  await expect(page.getByText(/still here/i)).toBeVisible();
});

test("sync requests are never served from cache", async ({ page }) => {
  await page.goto("/");
  await waitForServiceWorker(page);

  // A cached 401 or a stale pull cursor would quietly break syncing forever,
  // so /api must always reach the network.
  const fromServiceWorker = await page.evaluate(async () => {
    const response = await fetch("/api/sync/pull?since=0");
    return response.headers.get("x-from-sw");
  });
  expect(fromServiceWorker).toBeNull();

  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    for (const name of names) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      if (keys.some((request) => new URL(request.url).pathname.startsWith("/api/"))) return true;
    }
    return false;
  });
  expect(cached).toBe(false);
});
