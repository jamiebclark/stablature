/**
 * INV-031: every member of F reaches another device. `e2e/import-sync.spec.ts` carries `fits` only.
 * INV-027: offline through a full import, then the outbox count, then online and drained.
 * Needs Postgres, as `e2e/import-sync.spec.ts` does.
 */
import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { TUNINGS, dumpStore, emptySong, pasteTab, readStaffText, startWith } from "./import-helpers";

const DB_URL = process.env.STABLATURE_DATABASE_URL;
test.skip(!DB_URL, "STABLATURE_DATABASE_URL is not set, so there is no server to sync with");
test.setTimeout(120_000);

const FIVE = ["G |-5-7-|", "D |-----|", "A |-----|", "E |-----|", "B |-3---|"].join("\n");
const FOUR = ["G |-5-7-|", "D |-----|", "A |-----|", "E |-3---|"].join("\n");
const rejected = (page: Page) => page.getByText(/sync error|rejected/i);
const parts = (page: Page) => page.locator('[id^="part-"]');

async function signUp(page: Page) {
  const id = randomUUID().slice(0, 8);
  const who = { email: `tester-${id}@example.test`, password: "practice-space-5" };
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(`Tester ${id}`);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  return who;
}

async function secondDevice(browser: Browser, who: { email: string; password: string }) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  return page;
}

async function drained(page: Page) {
  await expect
    .poll(async () => (await dumpStore(page)).outbox.length, { timeout: 60_000 })
    .toBe(0);
}

async function arrives(page: Page, songUrl: string, staff: string) {
  await page.goto(songUrl);
  await expect
    .poll(async () => readStaffText(page).catch(() => ""), { timeout: 60_000 })
    .toBe(staff);
  await expect(rejected(page)).toHaveCount(0);
}

test("INV-031: an offer of a preset the band lacks, then of a tuning the band holds", async ({ browser }) => {
  const first = await browser.newPage();
  const who = await signUp(first);
  const seeded = await startWith(first, TUNINGS[0], `Band ${randomUUID().slice(0, 8)}`);

  const lacking = await emptySong(first, seeded.songUrl);
  await pasteTab(first, FIVE);
  await first.getByRole("button", { name: /^Switch to / }).click();
  await expect(parts(first)).toHaveCount(1);
  const lackingStaff = await readStaffText(first);
  const tunings = (await dumpStore(first)).tunings.length;

  const holding = await emptySong(first, seeded.songUrl);
  await pasteTab(first, FIVE);
  await first.getByRole("button", { name: /^Switch to / }).click();
  await expect(parts(first)).toHaveCount(1);
  const holdingStaff = await readStaffText(first);
  expect((await dumpStore(first)).tunings.length, "the band's own tuning is reused").toBe(tunings);

  await drained(first);
  await expect(rejected(first)).toHaveCount(0);
  const second = await secondDevice(browser, who);
  await arrives(second, lacking, lackingStaff);
  await arrives(second, holding, holdingStaff);
});

for (const [name, text] of [
  ["fits", FOUR],
  ["offer", FIVE],
] as const) {
  test(`INV-027: offline through a full import, ${name}, then online and drained`, async ({ browser }) => {
    const context = await browser.newContext();
    const first = await context.newPage();
    const who = await signUp(first);
    const seeded = await startWith(first, TUNINGS[0], `Band ${randomUUID().slice(0, 8)}`);
    const songUrl = await emptySong(first, seeded.songUrl);
    await drained(first);

    // The page is already open: this entry owes the import offline, not a server-rendered route.
    await expect(first.getByRole("button", { name: "Paste tab" }).first()).toBeVisible();
    await context.setOffline(true);
    await pasteTab(first, text);
    await first.getByRole("button", { name: /^(Switch to|Import as part)/ }).click();
    await expect(parts(first)).toHaveCount(1);
    const staff = await readStaffText(first);
    expect((await dumpStore(first)).outbox.length, "the rows wait").toBeGreaterThan(0);

    await context.setOffline(false);
    await drained(first);
    await expect(rejected(first)).toHaveCount(0);
    await arrives(await secondDevice(browser, who), songUrl, staff);
  });
}

test("INV-027: a song with no tuning can take the offer", async ({ page }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  // The band's only song: a second song on the deleted tuning withholds the offer (F32).
  const songUrl = seeded.songUrl;
  await page.goto(songUrl);
  await page.getByRole("link", { name: "Band" }).click();
  await page.waitForURL(/\/bands\/[0-9a-f-]+$/);
  await page.goto(`${page.url()}/tunings`);
  const remove = page.getByRole("button", { name: /^Delete / });
  await expect(remove.first()).toBeVisible();
  while ((await remove.count()) > 0) {
    const count = await remove.count();
    await remove.first().click();
    await expect(remove).toHaveCount(count - 1);
  }
  await page.goto(songUrl);
  await pasteTab(page, FIVE);
  await page.getByRole("button", { name: /^Switch to / }).click();
  // The seeded song already holds an empty part A, so the import is the second.
  await expect(parts(page)).toHaveCount(2);
  await expect(parts(page).last()).toContainText("5");
});
