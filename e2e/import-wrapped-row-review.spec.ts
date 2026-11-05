/**
 * Round 5. INV-006 through the real screen and the real store. Five rows on four strings, the top
 * one holding wrapped cells joined by a character the notation does not have. No import button may
 * appear. If one does, the second test records what reaches the store.
 */
import { expect, test } from "@playwright/test";
import { TUNINGS, dumpStore, emptySong, pasteTab, startWith } from "./import-helpers";

const REST = ["---5---7---", "---5---7---", "---3---5---", "---3---5---"];

const PASTES: [string, string][] = [
  ["`s` between let-ring notes", ["-(5)s(7)-", ...REST].join("\n")],
  ["a space between let-ring notes", ["-(5) (7)-", ...REST].join("\n")],
];

const importButton = /^(Import as part|Switch to)/;

test.describe("INV-006 a damaged row of wrapped cells never reaches the store", () => {
  for (const [name, text] of PASTES) {
    test(name, async ({ page }) => {
      const seeded = await startWith(page, TUNINGS[0]);
      await emptySong(page, seeded.songUrl);
      await pasteTab(page, text);
      await expect(page.getByRole("status")).not.toHaveText("Paste tab here.");
      await expect(page.getByRole("button", { name: importButton })).toHaveCount(0);
    });
  }
});

test("the first paste, imported, keeps the paste's second row off the top string", async ({ page }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await pasteTab(page, PASTES[0][1]);
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
  expect(frets.filter((f) => "0" in f)).toEqual([]);
});
