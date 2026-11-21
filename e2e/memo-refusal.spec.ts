import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { recordMemo, sharePartA, twoMembers, withFakeMicrophone } from "./memo-helpers";

/**
 * INV-015 (e2e): a viewer's recording is refused in words, not retried by itself; Try again sends one push of the
 * row; once the account is an editor, the row and the PUT go through.
 */
withFakeMicrophone();
const DB_URL = process.env.STABLATURE_DATABASE_URL;
const sql = postgres(DB_URL ?? "postgres://unset", { max: 2, onnotice: () => {} });
test.skip(!DB_URL, "STABLATURE_DATABASE_URL is not set");
test.afterAll(async () => {
  await sql.end();
});

test("V is refused in words, nothing is retried, Try again pushes once, E's account uploads", async ({ browser }) => {
  test.setTimeout(240_000);
  const bandName = `Memo band ${randomUUID().slice(0, 8)}`;
  const trio = await twoMembers(browser, bandName);
  try {
    await sharePartA(trio);
    const bandId = (await sql`select id from bands where name = ${bandName}`)[0].id as string;
    const [gUser] = await sql`select id from "user" where email = ${trio.guest.who.email}`;
    await sql`update band_members set role = 'viewer' where band_id = ${bandId} and user_id = ${gUser.id}`;

    const page = trio.guest.page;
    let puts = 0;
    let pushes = 0;
    await page.route("**/api/memos/*/audio", (route) => {
      if (route.request().method() === "PUT") puts++;
      return route.continue();
    });
    await page.route("**/api/sync/push", (route) => {
      pushes++;
      return route.continue();
    });

    await recordMemo(page, "A", 2_000);
    await expect(page.getByTestId("memo-state").first()).toContainText("You have read-only access to that band.", {
      timeout: 20_000,
    });
    // Three sync cycles later, still no PUT.
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await page.waitForTimeout(1_500);
    }
    expect(puts).toBe(0);

    const before = pushes;
    await page.getByTestId("memo-retry").first().click();
    await expect.poll(() => pushes - before, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(2_000);
    expect(pushes - before).toBe(1);

    // The account becomes an editor; the row is sent and the clip goes up.
    await sql`update band_members set role = 'editor' where band_id = ${bandId} and user_id = ${gUser.id}`;
    await page.getByTestId("memo-retry").first().click();
    await expect.poll(() => puts, { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
  } finally {
    await trio.close();
  }
});
