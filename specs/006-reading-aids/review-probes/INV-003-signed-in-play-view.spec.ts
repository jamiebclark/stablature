/**
 * INV-003's last member: 100 changes on the play view, signed in, with a reload between.
 *
 * Earlier rounds ran the signed-in half on the song page only. A signed-in device is the one with a live sync
 * engine, so it is where a view change reaching the outbox or the network would actually leave the device.
 */
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { fret, startCapturing } from "../../../e2e/capture-surface-helpers";
import { dump, idb } from "./helpers";

test.skip(!process.env.STABLATURE_DATABASE_URL, "STABLATURE_DATABASE_URL is not set");

test("100 changes on the play view, signed in, reach no table, queue or write", async ({ page }) => {
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
  await page.getByRole("button", { name: "Each part once" }).click();
  await expect(page.getByTestId("roadmap-chip")).toHaveCount(1);
  const outbox = () => idb<number>(page, `return (await all("outbox")).length;`);
  await expect.poll(outbox, { timeout: 30_000 }).toBe(0);
  await page.goto(`${songUrl}/play`);
  await expect(page.getByTestId("tab-column").first()).toBeVisible();
  // Let the start-up sync finish, or its own bookkeeping would read as a change.
  await page.waitForTimeout(1_500);

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
