/**
 * `e2e/reading-sync.spec.ts:35` run on an empty database, with the second device's page read instead of a bare wait.
 * It needs a database where no band is called `Hollow Crown` yet (`bands_slug_idx`), or the outbox never drains and the
 * test in e2e skips, which is what every run on a reused database does:
 *   docker exec spec007-linux-pg psql -q -U stablature -d stablature -c "truncate bands cascade"
 *   bash specs/007-usability-pass/review-probes/INV-016-linux-chrome.sh probes 'F50-[^\/]*\.spec\.ts$' 1 --project=desktop
 */
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { seedReadable, view } from "../../../e2e/reading-helpers";

const queued = (page: Page) =>
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

const read = (page: Page) =>
  page.evaluate(() => ({
    url: location.pathname,
    staffView: document.querySelectorAll("[data-testid=staff-view]").length,
    toolsButton: document.querySelectorAll("[data-testid=panel-song-tools]").length,
    toolsOpen: document.querySelector("[data-testid=panel-song-tools]")?.getAttribute("aria-expanded") ?? null,
    columns: document.querySelectorAll("[data-testid=tab-column]").length,
    text: document.body.innerText.replace(/\s+/g, " ").slice(0, 160),
  }));

test("a second device opening a song by its URL", async ({ browser }) => {
  test.setTimeout(90_000);
  const id = randomUUID().slice(0, 8);
  const first = await browser.newPage();
  await first.goto("/sign-up");
  await first.getByLabel("Name").fill(`Tester ${id}`);
  await first.getByLabel("Email").fill(`tester-${id}@example.test`);
  await first.getByLabel("Password").fill("practice-space-5");
  await first.getByRole("button", { name: "Create account" }).click();
  await expect(first).toHaveURL(/\/$/);
  const { songUrl } = await seedReadable(first);
  await expect.poll(() => queued(first), { timeout: 15_000 }).toBe(0);
  await view(first, "notes").click();

  const second = await browser.newPage();
  await second.goto("/sign-in");
  await second.getByLabel("Email").fill(`tester-${id}@example.test`);
  await second.getByLabel("Password").fill("practice-space-5");
  await second.getByRole("button", { name: "Sign in" }).click();
  await second.goto(songUrl);
  for (const at of [1, 5, 15]) {
    await second.waitForTimeout(at === 1 ? 1000 : at === 5 ? 4000 : 10_000);
    console.log(`as e2e does it, at ${at}s:`, JSON.stringify(await read(second)));
  }

  // The same device, signed in for certain this time: wait for the sign-in to leave the page before navigating.
  const third = await browser.newPage();
  await third.goto("/sign-in");
  await third.getByLabel("Email").fill(`tester-${id}@example.test`);
  await third.getByLabel("Password").fill("practice-space-5");
  await third.getByRole("button", { name: "Sign in" }).click();
  await expect(third).not.toHaveURL(/sign-in/, { timeout: 15_000 });
  await third.goto(songUrl);
  for (const at of [1, 5, 15]) {
    await third.waitForTimeout(at === 1 ? 1000 : at === 5 ? 4000 : 10_000);
    console.log(`signed in first, at ${at}s:`, JSON.stringify(await read(third)));
  }
  const tools = third.getByTestId("panel-song-tools");
  if ((await tools.count()) > 0 && (await tools.getAttribute("aria-expanded")) !== "true") await tools.click();
  await expect(third.getByTestId("staff-view")).toBeVisible({ timeout: 5000 });
  await expect(view(third, "frets")).toHaveAttribute("aria-pressed", "true");
});
