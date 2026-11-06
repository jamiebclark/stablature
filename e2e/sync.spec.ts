import { openTools } from "./usability-helpers";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

/**
 * Sync, against the real database.
 *
 * The unit tests prove merging converges; these prove the wire actually
 * carries it. The two that matter most are the offline one -- capture with the
 * network cut, reconnect, confirm the rows reached Postgres -- and the
 * two-device one, because a merge that only works in a unit test is worth
 * nothing to a band.
 *
 * Assertions poll Postgres rather than watching the UI's sync badge. The badge
 * is absent both when everything is synced and before the engine has started,
 * so waiting for it to disappear would pass for the wrong reason.
 */

const DB_URL = process.env.STABLATURE_DATABASE_URL;

test.describe.configure({ mode: "serial" });

const sql = postgres(DB_URL ?? "postgres://unset", { max: 2, onnotice: () => {} });

test.skip(!DB_URL, "STABLATURE_DATABASE_URL is not set");

test.afterAll(async () => {
  await sql.end();
});

/** A fresh account per test, so nothing shares band membership. */
function credentials() {
  const id = randomUUID().slice(0, 8);
  return { name: `Tester ${id}`, email: `tester-${id}@example.test`, password: "practice-space-5" };
}

const unique = (prefix: string) => `${prefix} ${randomUUID().slice(0, 8)}`;

async function signUp(page: Page, who = credentials()) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(who.name);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  return who;
}

async function signIn(page: Page, who: ReturnType<typeof credentials>) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
}

async function createBandAndSong(page: Page, bandName: string, songTitle: string) {
  await page.goto("/");
  await page.getByLabel("Band name").fill(bandName);
  await page.getByRole("button", { name: "Add band" }).click();
  await expect(page).toHaveURL(/\/bands\//);
  const bandUrl = page.url();

  await page.getByLabel("Song title").fill(songTitle);
  await page.getByRole("button", { name: "Add song" }).click();
  await expect(page).toHaveURL(/\/songs\//);
  return { bandUrl, songUrl: page.url() };
}

const columns = (page: Page) => page.getByTestId("tab-column");

const fret = (page: Page, string: string, number: number) =>
  page.getByRole("button", { name: new RegExp(`^${string} string, fret ${number},`) });

async function songIdFor(title: string): Promise<string> {
  let id: string | undefined;
  await expect
    .poll(
      async () => {
        const rows = await sql`select id from songs where title = ${title} limit 1`;
        id = rows[0]?.id as string | undefined;
        return Boolean(id);
      },
      { timeout: 25_000, message: `song "${title}" never reached Postgres` },
    )
    .toBe(true);
  return id!;
}

/** Fret maps of a song's columns, in playing order, straight from Postgres. */
async function storedFrets(songId: string) {
  const rows = await sql`
    select e.frets from events e
    join parts p on p.id = e.part_id
    where p.song_id = ${songId} and e.deleted_at is null
    order by e.rank collate "C"`;
  return rows.map((row) => row.frets as Record<string, number | "x">);
}

test("local writes reach Postgres once signed in", async ({ page }) => {
  await signUp(page);
  const title = unique("Synced");
  const { songUrl } = await createBandAndSong(page, unique("Band"), title);

  await page.goto(`${songUrl}/capture`);
  await page.getByRole("button", { name: "Add a part" }).click();
  await fret(page, "E", 7).click();
  await expect(columns(page)).toHaveCount(1);

  const songId = await songIdFor(title);
  await expect.poll(() => storedFrets(songId), { timeout: 25_000 }).toEqual([{ "3": 7 }]);
});

test("capture works offline and pushes on reconnect", async ({ page, context }) => {
  await signUp(page);
  const title = unique("Offline");
  const { songUrl } = await createBandAndSong(page, unique("Band"), title);
  const songId = await songIdFor(title);

  await page.goto(`${songUrl}/capture`);
  await page.getByRole("button", { name: "Add a part" }).click();
  await expect.poll(
    async () => (await sql`select count(*)::int as n from parts where song_id = ${songId}`)[0].n,
    { timeout: 25_000 },
  ).toBe(1);

  // The actual scenario: a rehearsal room with no signal.
  await context.setOffline(true);

  await fret(page, "E", 7).click();
  await fret(page, "E", 5).click();
  await fret(page, "A", 3).click();
  // Capture is completely unaffected by the network being gone -- this is the
  // single claim the whole local-first design exists to make good on.
  await expect(columns(page)).toHaveCount(3);

  // And none of it has reached the server yet.
  expect(await storedFrets(songId)).toEqual([]);

  await context.setOffline(false);
  // Coming back online is one of the engine's triggers; reloading also forces
  // a cycle, which is what walking out of the room and unlocking your phone
  // amounts to.
  await page.reload();

  await expect
    .poll(() => storedFrets(songId), { timeout: 30_000 })
    .toEqual([{ "3": 7 }, { "3": 5 }, { "2": 3 }]);
});

test("two devices editing offline both survive the merge", async ({ browser }) => {
  // One account on two devices. That isolates the merge from the invite flow,
  // which gets its own test below.
  const who = credentials();

  const first = await browser.newContext();
  const firstPage = await first.newPage();
  await signUp(firstPage, who);

  const title = unique("Merge");
  const { songUrl } = await createBandAndSong(firstPage, unique("Band"), title);
  const songId = await songIdFor(title);

  await firstPage.goto(`${songUrl}/capture`);
  await firstPage.getByRole("button", { name: "Add a part" }).click();
  await expect.poll(
    async () => (await sql`select count(*)::int as n from parts where song_id = ${songId}`)[0].n,
    { timeout: 25_000 },
  ).toBe(1);

  // Second device, same account, pulls the band down.
  const second = await browser.newContext();
  const secondPage = await second.newPage();
  await signIn(secondPage, who);
  await secondPage.goto(songUrl);
  await expect(secondPage.getByRole("heading", { name: title })).toBeVisible({ timeout: 25_000 });
  await expect(
    secondPage.getByRole("button", { name: "Add part A to the arrangement" }),
  ).toBeVisible({ timeout: 25_000 });

  // Both devices land on the page they will edit *before* the network goes,
  // because until the service worker ships a hard navigation offline fails.
  await firstPage.goto(songUrl);
  await openTools(firstPage);
  await expect(firstPage.getByLabel("Beats per minute")).toBeVisible();

  // Now offline, and each changes something different about the same song.
  await first.setOffline(true);
  await second.setOffline(true);

  await firstPage.getByLabel("Beats per minute").fill("122");
  await firstPage.getByLabel("Beats per minute").blur();

  await secondPage.getByRole("button", { name: "Add part A to the arrangement" }).click();
  await expect(secondPage.getByTestId("roadmap-chip")).toHaveCount(1);

  await first.setOffline(false);
  await second.setOffline(false);
  await firstPage.reload();
  await secondPage.reload();

  /*
   * Neither edit may be lost. They touched different rows -- and in the song's
   * case a single field -- so last-write-wins must not come into it at all.
   * This is the exact scenario a row-level clock would get wrong.
   */
  await expect
    .poll(async () => (await sql`select bpm from songs where id = ${songId}`)[0].bpm, {
      timeout: 30_000,
    })
    .toBe(122);

  await expect
    .poll(
      async () =>
        (
          await sql`select count(*)::int as n from arrangement_entries
                    where song_id = ${songId} and deleted_at is null`
        )[0].n,
      { timeout: 30_000 },
    )
    .toBe(1);

  // And both devices converge on the same picture.
  await firstPage.reload();
  await expect(firstPage.getByTestId("roadmap-chip")).toHaveCount(1, { timeout: 25_000 });
  await expect(firstPage.getByLabel("Beats per minute")).toHaveValue("122");
  await secondPage.reload();
  await openTools(secondPage);
  await expect(secondPage.getByLabel("Beats per minute")).toHaveValue("122", {
    timeout: 25_000,
  });

  await first.close();
  await second.close();
});

test("an invite lets another account into the band", async ({ browser }) => {
  const owner = await browser.newContext();
  const ownerPage = await owner.newPage();
  await signUp(ownerPage);

  const title = unique("Shared");
  const { bandUrl } = await createBandAndSong(ownerPage, unique("Band"), title);
  await songIdFor(title);

  await ownerPage.goto(bandUrl);
  await ownerPage.getByRole("button", { name: "Invite a bandmate" }).click();
  const link = await ownerPage.getByLabel("Invite link").inputValue();
  expect(link).toMatch(/\/join\/[0-9A-Z]{12}$/);

  // A different person opens the link.
  const guest = await browser.newContext();
  const guestPage = await guest.newPage();
  await signUp(guestPage);

  await guestPage.goto(new URL(link).pathname);
  await guestPage.getByRole("button", { name: "Accept invite" }).click();
  await expect(guestPage).toHaveURL(/\/bands\//, { timeout: 25_000 });

  /*
   * The band's existing history has to arrive even though all of it sits below
   * this device's sync cursor -- the case the client handles by noticing a
   * band it has not seen before and rewinding to zero.
   */
  await expect(guestPage.getByRole("link", { name: title })).toBeVisible({ timeout: 30_000 });

  await owner.close();
  await guest.close();
});

test("a stale invite code is refused", async ({ page }) => {
  await signUp(page);
  await page.goto("/join/ZZZZZZZZZZZZ");
  await page.getByRole("button", { name: "Accept invite" }).click();
  // Targeted by text rather than by role: Next renders its own empty
  // role="alert" container, so the role alone is ambiguous.
  await expect(page.getByText(/not valid any more/i)).toBeVisible();
});
