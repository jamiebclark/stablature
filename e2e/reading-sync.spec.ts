import { openCluster, openTools } from "./usability-helpers";
import { appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { deleteButton, fret, startCapturing } from "./capture-surface-helpers";
import { choose, dump, idb, n, seedReadable, seedSong, view } from "./reading-helpers";

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
  await openTools(first);
  await openTools(second);
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
  await openTools(page);
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

// INV-031 over its whole product, and INV-015's sync batch on the play view in a labelling view.
{
  const outbox = (page: Page) => idb<number>(page, `return (await all("outbox")).length;`);
  const liveParts = (page: Page) =>
    idb<string[]>(page, `return (await all("parts")).filter((p) => !p.deletedAt).map((p) => p.id);`);
  const cursor = (page: Page) =>
    idb<unknown>(page, `return (await all("meta")).find((m) => m.key === "syncCursor")?.value ?? null;`);
  const onServer = (page: Page) =>
    page.evaluate(async () => {
      const response = await fetch("/api/sync/pull?since=0&limit=1000");
      const body = (await response.json()) as {
        rows: { parts?: { id: string; deletedAt: unknown; serverSeq?: number | string }[] };
      };
      return (body.rows.parts ?? []).filter((p) => !p.deletedAt).map((p) => ({ id: p.id, seq: Number(p.serverSeq) }));
    });
  const line = (page: Page) => page.getByTestId("variant-line");
  const WAIT = { timeout: 30_000 };

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

  /** A and its variant, the variant on the last pass, drained, and open on a second device. */
  async function twoDevices(browser: Browser) {
    const id = randomUUID().slice(0, 8);
    const first = await signUp(browser, id);
    const { songUrl } = await startCapturing(first, `Probe band ${id}`);
    await fret(first, "E", 7).click();
    await fret(first, "A", 5).click();
    await expect(first.getByTestId("tab-column")).toHaveCount(2);
    await first.goto(songUrl);
    await first.getByRole("button", { name: "+ variant" }).first().click();
    await expect(line(first)).toHaveText("Same as A");
    await first.getByRole("button", { name: "Each part once" }).click();
    await expect(first.getByTestId("roadmap-chip")).toHaveCount(1);
    // A variant plays through the entry of its parent, so the play view draws it as the last pass.
    await first.getByTestId("roadmap-chip").first().click();
    await first.getByLabel("Last pass").selectOption({ label: "A'" });
    await expect.poll(() => outbox(first), WAIT).toBe(0);
    const second = await signIn(browser, id);
    await second.goto(songUrl);
    await expect(line(second)).toHaveText("Same as A", WAIT);
    return { first, second, songUrl, playUrl: `${songUrl}/play` };
  }

  /** Open the Nth part's capture screen from the song page, and come back when `work` is done. */
  const inCapture = async (page: Page, songUrl: string, index: number, work: () => Promise<unknown>) => {
    await page.getByRole("link", { name: "Edit" }).nth(index).click();
    await expect(page).toHaveURL(/\/capture\/[0-9a-f-]+$/);
    await expect(page.getByTestId("tab-column").first()).toBeVisible();
    await work();
    await page.goto(songUrl);
    await openTools(page);
    await expect(page.getByTestId("tab-staff").first()).toBeVisible(WAIT);
  };
  const addColumn = async (page: Page, count: number) => {
    await fret(page, "E", 3).click();
    await expect(page.getByTestId("tab-column")).toHaveCount(count);
  };
  const dropColumn = async (page: Page, count: number) => {
    await deleteButton(page).click();
    await expect(page.getByTestId("tab-column")).toHaveCount(count);
  };
  const setChord = async (page: Page, value: string) => {
    await page.getByRole("button", { name: "chord symbol" }).click();
    await page.getByLabel("Chord").fill(value);
    await page.getByRole("button", { name: "Set" }).click();
    await expect(page.getByTestId("tab-staff").getByText(value)).toBeVisible();
  };

  for (const surface of ["song page", "play view"] as const) {
    test(`INV-031 every write by a pull: ${surface}`, async ({ browser }) => {
      test.setTimeout(240_000);
      const { first, second, songUrl, playUrl } = await twoDevices(browser);
      if (surface === "play view") await first.goto(playUrl);
      await expect(line(first)).toHaveText("Same as A", WAIT);

      // Edit the variant, then delete that column.
      await inCapture(second, songUrl, 1, () => addColumn(second, 3));
      await expect(line(first)).toHaveText("Differs from A in bar 1: 1 added", WAIT);
      await inCapture(second, songUrl, 1, () => dropColumn(second, 2));
      await expect(line(first)).toHaveText("Same as A", WAIT);

      // Edit the parent, then delete that column.
      await inCapture(second, songUrl, 0, () => addColumn(second, 3));
      await expect(line(first)).toHaveText("Differs from A in bar 1: 1 removed", WAIT);
      await inCapture(second, songUrl, 0, () => dropColumn(second, 2));
      await expect(line(first)).toHaveText("Same as A", WAIT);

      // A chord on the variant, then the same chord on the parent.
      await inCapture(second, songUrl, 1, () => setChord(second, "Am"));
      await expect(line(first)).toHaveText("Differs from A in bar 1: 1 changed", WAIT);
      await inCapture(second, songUrl, 0, () => setChord(second, "Am"));
      await expect(line(first)).toHaveText("Same as A", WAIT);

      // Delete the parent: the comparison goes away, and the variant stays.
      await second.getByRole("button", { name: "Delete part A", exact: true }).click();
      await expect(line(first)).toHaveCount(0, WAIT);
      await expect(first.locator("[data-diff]")).toHaveCount(0);
      await expect(first.getByTestId("tab-removal")).toHaveCount(0);
    });

    test(`INV-031 a chord and the parent's deletion from a real second tab: ${surface}`, async ({ page, context }) => {
      test.setTimeout(120_000);
      const { songUrl, playUrl, parts, songId } = await seedSong(
        page,
        [
          { key: "a", label: "A", columns: [n(5), n(7)] },
          { key: "v", label: "A'", variantOf: "a", columns: [n(5), n(7)] },
        ],
        [{ part: "a" }, { part: "v" }],
      );
      if (surface === "play view") await page.goto(playUrl);
      await expect(line(page)).toHaveText("Same as A");
      const other = await context.newPage();
      await other.goto(`/songs/${songId}/capture/${parts.v}`);
      await expect(other.getByTestId("tab-column")).toHaveCount(2);
      await setChord(other, "Am");
      await expect(line(page)).toHaveText("Differs from A in bar 1: 1 changed");
      await other.goto(`/songs/${songId}/capture/${parts.a}`);
      await expect(other.getByTestId("tab-column")).toHaveCount(2);
      await setChord(other, "Am");
      await expect(line(page)).toHaveText("Same as A");
      await other.goto(songUrl);
      await other.getByRole("button", { name: "Delete part A", exact: true }).click();
      await expect(line(page)).toHaveCount(0);
      await other.close();
    });
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

  for (const surface of ["song page", "play view"] as const) {
    for (const view of ["notes", "intervals"] as const) {
      test(`INV-015 a variant arriving by a pull, on the last pass: ${surface}, ${view}`, async ({ browser }) => {
        test.setTimeout(180_000);
        const id = randomUUID().slice(0, 8);
        const first = await signUp(browser, id);
        const { songUrl } = await startCapturing(first, `Probe band ${id}`);
        await fret(first, "E", 7).click();
        await setChord(first, "Am");
        await fret(first, "A", 5).click();
        await expect(first.getByTestId("tab-column")).toHaveCount(2);
        await first.goto(songUrl);
        await first.getByRole("button", { name: "Each part once" }).click();
        await expect(first.getByTestId("roadmap-chip")).toHaveCount(1);
        await expect.poll(() => outbox(first), WAIT).toBe(0);
        if (surface === "play view") await first.goto(`${songUrl}/play`);
        await expect(first.getByTestId("tab-column").first()).toBeVisible(WAIT);
        if (surface === "song page") await openTools(first);
        await choose(first, view);
        await record(first);

        const second = await signIn(browser, id);
        await second.goto(songUrl);
        await expect(second.getByTestId("tab-column").first()).toBeVisible(WAIT);
        await second.getByRole("button", { name: "+ variant" }).first().click();
        await expect(line(second)).toHaveText("Same as A");
        // Inside the one-second debounce, so the variant and the entry that plays it go in one push.
        await second.getByTestId("roadmap-chip").first().click();
        await second.getByLabel("Last pass").selectOption({ label: "A'" });
        await expect.poll(() => outbox(second), WAIT).toBe(0);

        const arrived = await expect(line(first)).toHaveText("Same as A", WAIT).then(() => true, () => false);
        if (!arrived) {
          // Under load the server can hand out a cursor past a row (OOS-F23-a-pull-under-load.spec.ts). That is the only
          // excuse: the row must be missing from this device, below its cursor. Held here and not drawn is a page bug.
          const held = await liveParts(first);
          const lost = (await onServer(first)).filter((p) => !held.includes(p.id));
          expect(lost, "the variant is on this device and the page did not draw it").not.toEqual([]);
          expect(Number(await cursor(first))).toBeGreaterThan(Math.min(...lost.map((p) => p.seq)));
          if (process.env.F23_LOG) appendFileSync(process.env.F23_LOG, `${JSON.stringify({ kind: "lost", surface, view, lost })}
  `);
        } else if (process.env.F23_LOG) appendFileSync(process.env.F23_LOG, `${JSON.stringify({ kind: "fine" })}
  `);
        expect([...new Set(await recorded(first))].filter((t) => t !== "Same as A")).toEqual([]);
      });
    }
  }
}

// INV-003: a signed-in play view, where a view change reaching the outbox or the network would leave the device.
{
  test("INV-003 100 changes on the play view, signed in, reach no table, queue or write", async ({ page }) => {
    test.setTimeout(120_000);
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
    await openTools(page);
    await page.getByRole("button", { name: "Each part once" }).click();
    await expect(page.getByTestId("roadmap-chip")).toHaveCount(1);
    const outbox = () => idb<number>(page, `return (await all("outbox")).length;`);
    await expect.poll(outbox, { timeout: 30_000 }).toBe(0);
    await page.goto(`${songUrl}/play`);
    await expect(page.getByTestId("tab-column").first()).toBeVisible();
    // Let the start-up sync finish, or its own bookkeeping would read as a change.
    await page.waitForTimeout(1_500);
    await openCluster(page);

    /** Every table, leaving out the sync engine's own status and clock-driven bookkeeping in `meta`. */
    const tables = async () => {
      const all = JSON.parse(await dump(page)) as Record<string, unknown[]>;
      delete all.meta;
      return JSON.stringify(all);
    };
    const before = await tables();
    const writes: string[] = [];
    page.on("request", (r) => {
      if (r.method() !== "GET") writes.push(`${r.method()} ${r.url()}`);
    });
    const views = ["frets", "intervals", "notes"];
    for (let i = 0; i < 100; i += 1) {
      await page.getByTestId(`staff-view-${views[i % 3]}`).click();
      if (i === 50) {
        await page.reload();
        await expect(page.getByTestId("tab-column").first()).toBeVisible();
      }
    }
    await page.waitForTimeout(1_500);
    expect(await outbox()).toBe(0);
    expect(await tables()).toBe(before);
    expect(writes.filter((w) => !/\/api\/auth\//.test(w))).toEqual([]);
  });
}
