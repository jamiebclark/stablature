/**
 * A pull never hands out a cursor past a row it did not send.
 *
 * Adopted from specs/006-reading-aids/review-probes/OOS-F23-a-pull-under-load.spec.ts. A second device makes
 * variants while the first watches. When a variant has not arrived after 30 s, the first device reloads, which
 * pulls again from its stored cursor: if the part is still missing while the server holds it, the cursor went
 * past it and nothing short of a rewind brings it back. Before readPull shared one snapshot, this lost a part in
 * 23 of 48 runs at 6 workers on one machine, and 0 of 48 after.
 */
import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { fret, startCapturing } from "./capture-surface-helpers";
import { idb } from "./reading-helpers";

test.skip(!process.env.STABLATURE_DATABASE_URL, "STABLATURE_DATABASE_URL is not set");

const outbox = (page: Page) => idb<number>(page, `return (await all("outbox")).length;`);
const liveParts = (page: Page) =>
  idb<string[]>(page, `return (await all("parts")).filter((p) => !p.deletedAt).map((p) => p.id);`);
const onServer = (page: Page) =>
  page.evaluate(async () => {
    const response = await fetch("/api/sync/pull?since=0&limit=1000");
    const body = (await response.json()) as { rows: { parts?: { id: string; deletedAt: unknown }[] } };
    return (body.rows.parts ?? []).filter((p) => !p.deletedAt).map((p) => p.id);
  });

const signUp = async (browser: Browser, id: string) => {
  const page = await browser.newPage();
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(`Lost rows ${id}`);
  await page.getByLabel("Email").fill(`lost-rows-${id}@example.test`);
  await page.getByLabel("Password").fill("practice-space-5");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  return page;
};
const signIn = async (browser: Browser, id: string) => {
  const page = await browser.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(`lost-rows-${id}@example.test`);
  await page.getByLabel("Password").fill("practice-space-5");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  return page;
};

test("variants made on one device all reach the other, even after a slow pull", async ({ browser }) => {
  test.setTimeout(240_000);
  const id = randomUUID().slice(0, 8);
  const first = await signUp(browser, id);
  const { songUrl } = await startCapturing(first, `Lost rows band ${id}`);
  await fret(first, "E", 7).click();
  await expect(first.getByTestId("tab-column")).toHaveCount(1);
  await first.goto(songUrl);
  await first.getByRole("button", { name: "Each part once" }).click();
  await expect(first.getByTestId("roadmap-chip")).toHaveCount(1);
  await expect.poll(() => outbox(first), { timeout: 60_000 }).toBe(0);
  const second = await signIn(browser, id);
  await second.goto(songUrl);
  await expect(second.getByTestId("tab-column").first()).toBeVisible({ timeout: 60_000 });

  for (let made = 1; made <= 4; made += 1) {
    await second.getByRole("button", { name: "+ variant" }).first().click();
    await expect(second.getByTestId("tab-staff")).toHaveCount(made + 1);
    await expect.poll(() => outbox(second), { timeout: 60_000 }).toBe(0);
    const arrived = await expect(first.getByTestId("tab-staff"))
      .toHaveCount(made + 1, { timeout: 30_000 })
      .then(() => true, () => false);
    if (arrived) continue;

    // Late is allowed; lost is not. A reload pulls again from the stored cursor.
    const server = await onServer(first);
    await first.reload();
    await expect(first.getByTestId("tab-staff").first()).toBeVisible({ timeout: 60_000 });
    await first.waitForTimeout(8_000);
    const held = await liveParts(first);
    expect(server.filter((part) => !held.includes(part)), "parts on the server this device can never pull").toEqual([]);
  }
});
