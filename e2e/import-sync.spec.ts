import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { TUNINGS, emptySong, pasteTab, readStaffText, startWith, tabText } from "./import-helpers";

const DB_URL = process.env.STABLATURE_DATABASE_URL;
test.skip(!DB_URL, "STABLATURE_DATABASE_URL is not set, so there is no server to sync with");

async function signUp(page: Page) {
  const id = randomUUID().slice(0, 8);
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(`Tester ${id}`);
  await page.getByLabel("Email").fill(`tester-${id}@example.test`);
  await page.getByLabel("Password").fill("practice-space-5");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  return { email: `tester-${id}@example.test`, password: "practice-space-5" };
}

test.setTimeout(90_000);

test("an imported part over 200 rows reaches a second context with no rejections", async ({
  browser,
}) => {
  const first = await browser.newPage();
  const who = await signUp(first);
  const seeded = await startWith(first, TUNINGS[0], `Band ${randomUUID().slice(0, 8)}`);
  const songUrl = await emptySong(first, seeded.songUrl);
  await pasteTab(first, await tabText(250));
  await first.getByRole("button", { name: /Import as part/ }).click();
  await expect(first.locator('[id^="part-"]')).toHaveCount(1);
  const staff = await readStaffText(first);
  await expect(first.getByText(/sync error|rejected/i)).toHaveCount(0);

  const second = await (await browser.newContext()).newPage();
  await second.goto("/sign-in");
  await second.getByLabel("Email").fill(who.email);
  await second.getByLabel("Password").fill(who.password);
  await second.getByRole("button", { name: "Sign in" }).click();
  await expect(second).toHaveURL(/\/$/);
  await second.goto(songUrl);
  await expect
    .poll(async () => readStaffText(second).catch(() => ""), { timeout: 60_000 })
    .toBe(staff);
  await expect(second.getByText(/sync error|rejected/i)).toHaveCount(0);
});
