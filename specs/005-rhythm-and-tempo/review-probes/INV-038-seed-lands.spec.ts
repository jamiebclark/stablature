/**
 * Why does `click.spec.ts` go red some of the time? Runs its own `seedPlayable` and reads what landed,
 * and separately drives the same taps with a wait after each, to tell the helper from the product.
 * Run with `--repeat-each`. The tally goes to stdout.
 */
import { expect, test, type Page } from "@playwright/test";
import { seedPlayable } from "../../../e2e/click-helpers";
import { columns } from "../../../e2e/capture-surface-helpers";
import { eventRows, seed, cols, idb } from "./helpers";

const stored = async (page: Page) => {
  const rows = await eventRows(page);
  return rows.filter((r) => r.kind !== "barline" && !r.deletedAt).map((r) => r.durationHint ?? null);
};

const entries = (page: Page) =>
  idb<number[]>(
    page,
    `const tx = db.transaction("arrangementEntries");
     const r = tx.objectStore("arrangementEntries").getAll();
     await new Promise((res) => (tx.oncomplete = res));
     return r.result.filter((e) => !e.deletedAt).map((e) => e.repeat);`,
  );

test("what seedPlayable leaves behind, with two quarters and no repeat", async ({ page }) => {
  await seedPlayable(page, { durations: [2, 2] });
  const got = await stored(page);
  await page.waitForTimeout(1000);
  const follow = await page.getByTestId("click-follow").count();
  console.log(`SEED ${JSON.stringify(got)} entries=${JSON.stringify(await entries(page))} follow=${follow}`);
});

test("what seedPlayable leaves behind, with a second pass asked for", async ({ page }) => {
  await seedPlayable(page, { durations: [2, 2], passes: 2 });
  const got = await stored(page);
  const repeats = await idb<number[]>(
    page,
    `const tx = db.transaction("arrangementEntries");
     const r = tx.objectStore("arrangementEntries").getAll();
     await new Promise((res) => (tx.oncomplete = res));
     return r.result.filter((e) => !e.deletedAt).map((e) => e.repeat);`,
  );
  console.log(`PASSES ${JSON.stringify(got)} repeats=${JSON.stringify(repeats)}`);
});

test("a person's pace: the same taps, each awaited, always land", async ({ page }) => {
  const { partUrl } = await seed(page, cols(null, null), { arrange: false });
  await page.goto(partUrl);
  await expect(columns(page)).toHaveCount(2);
  for (const i of [0, 1]) {
    await columns(page).nth(i).click();
    await page.getByRole("button", { name: "Open column details" }).click();
    await page.getByTestId("duration-row").getByRole("button").nth(2).click();
    await expect(page.getByTestId("duration-row").getByRole("button").nth(2)).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  }
  await expect.poll(() => stored(page)).toEqual(["q", "q"]);
});
