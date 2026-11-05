/**
 * Two signed-in devices through a real server and Postgres.
 *
 * `e2e/reading-sync.spec.ts` seeds the fixed band name "Hollow Crown", so on any database that has run it once the
 * server refuses the band on `bands_slug_idx`, the outbox never drains, and the spec skips itself. A unique name
 * here keeps it honest. Anything that stops a drain fails rather than skips.
 */
import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { fret, startCapturing } from "../../../e2e/capture-surface-helpers";
import { idb } from "./helpers";

test.skip(!process.env.STABLATURE_DATABASE_URL, "STABLATURE_DATABASE_URL is not set");

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

test("INV-003 the view stays on its device, and queues nothing", async ({ browser }) => {
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
