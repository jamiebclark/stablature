/**
 * What the hold in `useSongContent` (T056) does while a page is already open, round 2.
 *
 *  - INV-031 "from this tab": a local edit during a sync does not reach the page until the sync ends. Every local write
 *    starts a sync a second later (`runner.ts`), so a slow connection puts the next tap inside one.
 *  - INV-015 "a sync batch": past `STUCK_SYNC_MS` the hold lets every read through, so a pull that takes longer than
 *    that lands in pieces on the page, which is F1 again on exactly the connection most likely to be slow.
 */
import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { fret, startCapturing } from "../../../e2e/capture-surface-helpers";
import { idb } from "./helpers";

test.skip(!process.env.STABLATURE_DATABASE_URL, "STABLATURE_DATABASE_URL is not set");

const outbox = (page: Page) => idb<number>(page, `return (await all("outbox")).length;`);
const syncState = (page: Page) =>
  idb<string | undefined>(page, `return (await all("meta")).find((m) => m.key === "syncStatus")?.value?.state;`);

const slowPull = (page: Page, ms: number) =>
  page.route("**/api/sync/pull**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue().catch(() => {});
  });

async function signUp(browser: Browser, id: string) {
  const page = await browser.newPage();
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(`Probe ${id}`);
  await page.getByLabel("Email").fill(`probe-${id}@example.test`);
  await page.getByLabel("Password").fill("practice-space-5");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  return page;
}

async function signIn(browser: Browser, id: string) {
  const page = await browser.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(`probe-${id}@example.test`);
  await page.getByLabel("Password").fill("practice-space-5");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  return page;
}

async function aSong(page: Page, id: string) {
  const { songUrl } = await startCapturing(page, `Probe band ${id}`);
  await fret(page, "E", 7).click();
  await fret(page, "A", 5).click();
  await fret(page, "D", 3).click();
  await expect(page.getByTestId("tab-column")).toHaveCount(3);
  await page.goto(songUrl);
  await page.getByRole("button", { name: "Each part once" }).click();
  await expect(page.getByTestId("roadmap-chip")).toHaveCount(1);
  await expect.poll(() => outbox(page), { timeout: 30_000 }).toBe(0);
  return songUrl;
}

test("INV-031 a local edit during a sync reaches the page at once", async ({ browser }) => {
  const id = randomUUID().slice(0, 8);
  const page = await signUp(browser, id);
  await aSong(page, id);
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
  const id = randomUUID().slice(0, 8);
  const first = await signUp(browser, id);
  const songUrl = await aSong(first, id);
  const second = await signIn(browser, id);
  await second.goto(songUrl);
  await expect(second.getByTestId("tab-column")).toHaveCount(3, { timeout: 30_000 });

  await first.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __seen: string[] }).__seen = seen;
    const read = () => {
      for (const el of document.querySelectorAll('[data-testid="variant-line"], [data-testid="tab-removal"], [data-diff]')) {
        seen.push(el.getAttribute("data-testid") === "variant-line" ? (el.textContent ?? "") : `mark: ${el.textContent}`);
      }
    };
    new MutationObserver(read).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await slowPull(first, 11_500);

  for (let made = 1; made <= 3; made += 1) {
    await second.getByRole("button", { name: "+ variant" }).first().click();
    await expect(second.getByTestId("variant-line")).toHaveCount(made);
    await expect.poll(() => outbox(second), { timeout: 30_000 }).toBe(0);
    await expect(first.getByTestId("variant-line")).toHaveCount(made, { timeout: 40_000 });
  }
  const seen = await first.evaluate(() => (window as unknown as { __seen: string[] }).__seen);
  expect([...new Set(seen)].filter((t) => t !== "Same as A")).toEqual([]);
});
