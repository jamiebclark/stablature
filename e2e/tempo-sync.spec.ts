import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { startCapturing } from "./capture-surface-helpers";

/** A tempo set by tap reaches a second device in the stored shape of a typed one (INV-017). */

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

test("a tapped tempo syncs as a plain bpm and a second context shows it", async ({
  browser,
}) => {
  const first = await browser.newPage();
  const who = await signUp(first);
  const { songUrl, partUrl } = await startCapturing(
    first,
    `Band ${randomUUID().slice(0, 8)}`,
  );
  const songId = songUrl.split("/").pop()!;

  await first.getByTestId("tempo-control").click();
  await first.getByTestId("tap-pad").evaluate((pad) => {
    for (const t of [1000, 1500, 2000]) {
      const e = new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerType: "touch",
        isPrimary: true,
      });
      Object.defineProperty(e, "timeStamp", { value: t });
      pad.dispatchEvent(e);
    }
  });
  await first.getByTestId("tempo-set").click();
  await expect(first.getByTestId("tempo-control")).toHaveText("120 bpm");

  await expect
    .poll(async () => {
      const rows = await sql`select bpm from songs where id = ${songId}`;
      return rows[0]?.bpm;
    })
    .toBe(120);

  const second = await (await browser.newContext()).newPage();
  await second.goto("/sign-in");
  await second.getByLabel("Email").fill(who.email);
  await second.getByLabel("Password").fill(who.password);
  await second.getByRole("button", { name: "Sign in" }).click();
  await expect(second).toHaveURL(/\/$/);
  await second.goto(partUrl);
  await expect(second.getByTestId("tempo-control")).toHaveText("120 bpm", {
    timeout: 25_000,
  });
});
