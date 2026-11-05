/**
 * F23, the open question: why does a pull miss 30 s under heavy load?
 *
 * Run many at once (`--workers=10 --repeat-each=12`). When a device has not shown a variant after 30 s, this asks
 * what kind of miss it was. A reload pulls again from the stored cursor, so:
 *  - shown after the reload, and the cursor moved: the pull was only late (or a server event was dropped);
 *  - still missing after the reload, while the server's own rows from zero hold the part: the cursor went past a
 *    row this device never got, and only a rewind can bring it back.
 * The verdict is written to the test's annotations and to `F23_LOG`, and the test fails on the second kind only.
 */
import { appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { fret, startCapturing } from "../../../e2e/capture-surface-helpers";
import { idb } from "./helpers";

test.skip(!process.env.STABLATURE_DATABASE_URL, "STABLATURE_DATABASE_URL is not set");

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

test("a variant from another device: late, or lost?", async ({ browser }, info) => {
  test.setTimeout(240_000);
  const id = randomUUID().slice(0, 8);
  const first = await signUp(browser, id);
  const { songUrl } = await startCapturing(first, `Probe band ${id}`);
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
    const started = Date.now();
    // Staves, not lines, so this runs on `main` too (`playwright.baseline.config.ts`).
    const arrived = await expect(first.getByTestId("tab-staff"))
      .toHaveCount(made + 1, { timeout: 30_000 })
      .then(() => true, () => false);
    if (arrived) continue;

    const held = await liveParts(first);
    const server = await onServer(first);
    const missing = server.filter((p) => !held.includes(p.id));
    const before = await cursor(first);
    await first.reload();
    await expect(first.getByTestId("tab-staff").first()).toBeVisible({ timeout: 60_000 });
    await first.waitForTimeout(8_000);
    const after = await cursor(first);
    const heldAfter = await liveParts(first);
    const stillMissing = server.filter((p) => !heldAfter.includes(p.id));
    const kind = stillMissing.length === 0 ? "late" : "lost";
    const report = { kind, made, waited: Date.now() - started, before, after, missing, stillMissing };
    info.annotations.push({ type: "F23", description: JSON.stringify(report) });
    if (process.env.F23_LOG) appendFileSync(process.env.F23_LOG, `${JSON.stringify(report)}\n`);
    expect(stillMissing, JSON.stringify(report)).toEqual([]);
    return;
  }
  if (process.env.F23_LOG) appendFileSync(process.env.F23_LOG, `${JSON.stringify({ kind: "fine" })}\n`);
});
