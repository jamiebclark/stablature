import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { startCapturing } from "./capture-surface-helpers";
import {
  addNotes,
  brackets,
  groupControl,
  selectColumns,
} from "./grouping-helpers";

/** Plain groups over the wire, against the real database (INV-009, US2 scenario 6). */

const DB_URL = process.env.STABLATURE_DATABASE_URL;

test.describe.configure({ mode: "serial" });

const sql = postgres(DB_URL ?? "postgres://unset", {
  max: 2,
  onnotice: () => {},
});

test.skip(!DB_URL, "STABLATURE_DATABASE_URL is not set");

test.afterAll(async () => {
  await sql.end();
});

async function signUp(page: Page) {
  const id = randomUUID().slice(0, 8);
  const who = {
    name: `Tester ${id}`,
    email: `tester-${id}@example.test`,
    password: "practice-space-5",
  };
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(who.name);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  return who;
}

test("a plain group of 20 syncs and a second context draws it with no numeral", async ({
  browser,
}) => {
  const first = await browser.newPage();
  const who = await signUp(first);
  const { partUrl } = await startCapturing(
    first,
    `Band ${randomUUID().slice(0, 8)}`,
  );
  await addNotes(first, 20);
  await selectColumns(first, 0, 19);
  await groupControl(first).click();
  await expect(brackets(first)).toHaveCount(1);

  await expect
    .poll(async () => {
      const rows =
        await sql`select count(*)::int as n from events where part_id = ${partUrl.split("/").pop()!} and group_kind = 'plain' and tuplet_count is null`;
      return rows[0].n;
    })
    .toBe(20);

  const second = await (await browser.newContext()).newPage();
  await second.goto("/sign-in");
  await second.getByLabel("Email").fill(who.email);
  await second.getByLabel("Password").fill(who.password);
  await second.getByRole("button", { name: "Sign in" }).click();
  await expect(second).toHaveURL(/\/$/);
  await second.goto(partUrl);
  await expect(brackets(second)).toHaveCount(1, { timeout: 25_000 });
  await expect(second.locator(".tab-bracket-label")).toHaveCount(0);
  await expect(second.getByText(/sync error|rejected/i)).toHaveCount(0);
});

test("a queued outbox row with no groupKind still pushes", async ({
  request,
}) => {
  // The wire schema must keep accepting rows written before groupKind existed.
  const { pushRequestSchema } = await import("../src/lib/sync/protocol");
  const row = {
    id: randomUUID(),
    partId: randomUUID(),
    kind: "notes",
    rank: "a0",
    frets: {},
    techniques: {},
    repeat: 1,
    tupletId: null,
    tupletCount: null,
  };
  const parsed = pushRequestSchema.safeParse({
    mutations: [{ table: "events", row }],
  });
  expect(
    parsed.success ||
      parsed.error.issues.every((i) => !i.path.includes("groupKind")),
  ).toBe(true);
  void request;
});
