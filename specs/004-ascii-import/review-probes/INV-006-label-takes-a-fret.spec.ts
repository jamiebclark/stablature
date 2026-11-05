/**
 * Round 6. INV-006 through the real screen and the real store. `G5-7-5-7-` holds four notes as a
 * person reads it. No import button may appear, because the text cannot say whether the first digit
 * is an octave or a fret. If one does, the second test records what reaches the store.
 */
import { expect, test } from "@playwright/test";
import { TUNINGS, dumpStore, emptySong, pasteTab, startWith } from "../../../e2e/import-helpers";

const TEXT = ["G5-7-5-7-", "D5-7-5-7-", "A3-5-3-5-", "E3-5-3-5-"].join("\n");

const importButton = /^(Import as part|Switch to)/;

test("INV-006 a digit flush on a label is not taken for an octave", async ({ page }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await pasteTab(page, TEXT);
  await expect(page.getByRole("status")).not.toHaveText("Paste tab here.");
  await expect(page.getByRole("button", { name: importButton })).toHaveCount(0);
});

test("imported, the part holds all four notes of the row", async ({ page }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await pasteTab(page, TEXT);
  await expect(page.getByRole("status")).not.toHaveText("Paste tab here.");
  const button = page.getByRole("button", { name: importButton });
  test.skip((await button.count()) === 0, "refused, which is the fix");
  const before = ((await dumpStore(page)).events as unknown[]).length;
  await button.click();
  await expect(page.getByTestId("paste-tab")).toHaveCount(0);
  const events = (await dumpStore(page)).events as { kind: string; frets: Record<string, number> }[];
  const frets = events
    .slice(before)
    .filter((e) => e.kind === "notes")
    .map((e) => e.frets);
  console.log("stored:", JSON.stringify(frets));
  expect(frets).toHaveLength(4);
});
