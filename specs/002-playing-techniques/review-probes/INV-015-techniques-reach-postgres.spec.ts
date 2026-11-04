/**
 * INV-015 and FR-001 end to end, and the second device round 1 could not reach. `eventRowSchema`
 * in a unit test says the wire would take a row; this sends one. A hammer-on from a chip, then a
 * vibrato and a palm mute from the sheet, on a real account: the push route accepts it, Postgres
 * holds exactly the stored form, and a second browser context signed in to the same account
 * pulls it and draws `5h7~m`, with both toggles lit in its own sheet.
 *
 * Skips itself without STABLATURE_DATABASE_URL, as e2e/sync.spec.ts does.
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { columns, connectors, details, inspector, latch, openDialog, toggle } from "./probe-helpers";

loadEnv({ path: path.resolve(__dirname, "../../../.env.local"), override: true, quiet: true });

const DB_URL = process.env.STABLATURE_DATABASE_URL;
const sql = postgres(DB_URL ?? "postgres://unset", { max: 2, onnotice: () => {} });

test.skip(!DB_URL, "STABLATURE_DATABASE_URL is not set");
test.afterAll(async () => {
  await sql.end();
});

const fretOn = (page: Page, string: string, number: number) =>
  page.getByRole("button", { name: new RegExp(`^${string} string, fret ${number},`) });

test("a captured technique is pushed, stored and pulled by a second device", async ({ browser }, info) => {
  test.skip(info.project.name !== "mobile", "one project is enough for a real account");
  test.setTimeout(120_000);
  const id = randomUUID().slice(0, 8);
  const who = { name: `Tester ${id}`, email: `tester-${id}@example.test`, password: "practice-space-5" };
  const title = `Techniques ${id}`;

  const first = await browser.newContext();
  const page = await first.newPage();
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(who.name);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByLabel("Band name").fill(`Band ${id}`);
  await page.getByRole("button", { name: "Add band" }).click();
  await expect(page).toHaveURL(/\/bands\//);
  await page.getByLabel("Song title").fill(title);
  await page.getByRole("button", { name: "Add song" }).click();
  await expect(page).toHaveURL(/\/songs\//);
  const songUrl = page.url();

  await page.goto(`${songUrl}/capture`);
  await page.getByRole("button", { name: "Add a part" }).click();
  await fretOn(page, "E", 5).click();
  await expect(columns(page)).toHaveCount(1);
  await latch(page, "hammer-on").click();
  await fretOn(page, "E", 7).click();
  await expect(columns(page)).toHaveCount(2);
  await columns(page).last().click();
  await details(page).click();
  await toggle(page, "vibrato").click();
  await toggle(page, "palm mute").click();
  await expect(toggle(page, "palm mute")).toHaveAttribute("aria-pressed", "true");
  await inspector(page).getByRole("button", { name: "close" }).click();

  const stored = async () => {
    const rows = await sql`
      select e.frets, e.techniques from events e
      join parts p on p.id = e.part_id
      join songs s on s.id = p.song_id
      where s.title = ${title} and e.deleted_at is null
      order by e.rank collate "C"`;
    return rows.map((r) => ({ frets: r.frets, techniques: r.techniques }));
  };
  await expect
    .poll(stored, { timeout: 25_000 })
    .toEqual([
      { frets: { "3": 5 }, techniques: {} },
      { frets: { "3": 7 }, techniques: { "3": ["hammer_on", "vibrato", "palm_mute"] } },
    ]);

  const second = await browser.newContext();
  const other = await second.newPage();
  await other.goto("/sign-in");
  await other.getByLabel("Email").fill(who.email);
  await other.getByLabel("Password").fill(who.password);
  await other.getByRole("button", { name: "Sign in" }).click();
  await expect(other).toHaveURL(/\/$/);
  await other.goto(songUrl);
  await expect(other.getByRole("heading", { name: title })).toBeVisible({ timeout: 25_000 });
  await other.getByRole("link", { name: "Capture" }).click();
  await expect(columns(other)).toHaveCount(2, { timeout: 25_000 });
  await expect(connectors(other)).toHaveCount(1);
  await expect(columns(other).last()).toContainText("7~m");
  await expect(columns(other).last()).toHaveAttribute(
    "aria-label",
    "string 4 fret 7 with hammer-on, vibrato and palm mute",
  );
  await columns(other).last().click();
  await details(other).click();
  await expect(openDialog(other)).toHaveCount(1);
  await expect(toggle(other, "vibrato")).toHaveAttribute("aria-pressed", "true");
  await expect(toggle(other, "palm mute")).toHaveAttribute("aria-pressed", "true");
  await expect(toggle(other, "bend")).toHaveAttribute("aria-pressed", "false");

  await first.close();
  await second.close();
});
