/**
 * INV-009 / FR-006 / US2 scenario 3 through the live route, which the suite's
 * e2e/grouping-sync.spec.ts:79 does not do: it only parses an incomplete row, and passes as long as
 * no issue names groupKind. This queues real rows offline, strips `groupKind` and its clock from
 * them and from the local store, exactly as a build from before this entry left them, puts a
 * plain group of 20 in the same batch, then goes online and watches the push land in Postgres.
 *
 * Skips itself without STABLATURE_DATABASE_URL.
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { addNotes, groupControl, selectColumns, startCapturing } from "./probe-helpers";

loadEnv({ path: path.resolve(__dirname, "../../../.env.local"), override: true, quiet: true });

const DB_URL = process.env.STABLATURE_DATABASE_URL;
const sql = postgres(DB_URL ?? "postgres://unset", { max: 2, onnotice: () => {} });

test.skip(!DB_URL, "STABLATURE_DATABASE_URL is not set");
test.afterAll(async () => {
  await sql.end();
});

async function signUp(page: Page) {
  const id = randomUUID().slice(0, 8);
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(`Tester ${id}`);
  await page.getByLabel("Email").fill(`tester-${id}@example.test`);
  await page.getByLabel("Password").fill("practice-space-5");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Remove the field from every event and every queued event, as an older build stored them. */
const strip = (page: Page, first: number, last: number) =>
  page.evaluate(
    async ([from, to]) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open("stablature");
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      const tx = db.transaction(["events", "outbox"], "readwrite");
      const events = tx.objectStore("events");
      const outbox = tx.objectStore("outbox");
      const all = await new Promise<Record<string, unknown>[]>((resolve) => {
        const r = events.getAll();
        r.onsuccess = () => resolve(r.result);
      });
      const clear = (row: Record<string, unknown>) => {
        delete row.groupKind;
        delete (row.fieldClocks as Record<string, unknown>).groupKind;
      };
      const chosen = new Set(
        all
          .sort((a, b) => String(a.rank).localeCompare(String(b.rank)))
          .slice(from, to)
          .map((r) => r.id),
      );
      for (const row of all) {
        if (!chosen.has(row.id)) continue;
        clear(row);
        events.put(row);
      }
      const queued = await new Promise<Record<string, unknown>[]>((resolve) => {
        const r = outbox.getAll();
        r.onsuccess = () => resolve(r.result);
      });
      let stripped = 0;
      for (const entry of queued) {
        const row = entry.row as Record<string, unknown>;
        if (entry.table !== "events" || !chosen.has(row.id)) continue;
        clear(row);
        outbox.put(entry);
        stripped += 1;
      }
      await new Promise((resolve) => (tx.oncomplete = resolve));
      db.close();
      return stripped;
    },
    [first, last],
  );

test("a queued row with no key pushes, beside a plain group of 20, and reaches Postgres", async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name !== "mobile", "one project is enough for a real account");
  test.setTimeout(120_000);
  await signUp(page);
  const { partUrl } = await startCapturing(page, `Band ${randomUUID().slice(0, 8)}`);
  const partId = partUrl.split("/").pop()!;
  // `all synced` no longer renders (spec 007): the quiet state is no `N unsynced` text.
  await expect(page.getByText(/\d+ unsynced/)).toHaveCount(0, { timeout: 25_000 });

  await context.setOffline(true);
  await addNotes(page, 23);
  await selectColumns(page, 0, 19);
  await groupControl(page).click();
  expect(await strip(page, 20, 23)).toBeGreaterThanOrEqual(3);
  await context.setOffline(false);
  await page.reload();

  const stored = () => sql`
    select tuplet_count, group_kind, count(*)::int as n from events
    where part_id = ${partId} and deleted_at is null group by 1, 2 order by 3`;
  await expect
    .poll(async () => (await stored()).map((r) => [r.tupletCount ?? r.tuplet_count, r.group_kind, r.n]), {
      timeout: 40_000,
    })
    .toEqual([
      [null, null, 3],
      [null, "plain", 20],
    ]);
  await expect(page.getByText(/\d+ unsynced/)).toHaveCount(0, { timeout: 25_000 });
  await expect(page.getByText(/sync error|rejected/i)).toHaveCount(0);
});
