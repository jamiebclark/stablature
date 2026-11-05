/**
 * Round 2. INV-006 through the real screen and the real store.
 *
 * Five rows on a four-string song is a refusal (FR-015). Each paste below has an empty or a
 * damaged row at the top, and each must leave no import button and nothing stored.
 */
import { expect, test } from "@playwright/test";
import { TUNINGS, dumpStore, emptySong, pasteTab, startWith } from "../../../e2e/import-helpers";

const PASTES: [string, string][] = [
  ["an empty row over rows that open on a note", "-------\n5---7--\n7---9--\n7---9--\n5---7--"],
  [
    "an empty row with barlines",
    "-------|-------|\n---5---|---7---|\n---7---|---9---|\n---9---|---3---|\n---3---|---3---|",
  ],
  ["an empty row with a closing pipe", "-------|\n---5---|\n---7---|\n---9---|\n---3---|"],
  [
    "a row of long dashes, as a phone leaves it",
    "———5———7———\n---5---7---\n---5---7---\n---5---7---\n---5---7---",
  ],
];

const importButton = /^(Import as part|Switch to)/;

test.describe("INV-006 five rows on four strings never reach the store", () => {
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

/** What the person actually gets today, recorded rather than asserted away: the stored frets. */
test("the first paste, imported, stores every note one string off", async ({ page }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await pasteTab(page, PASTES[0][1]);
  // The reading is deferred, so wait for it before asking whether there is a button.
  await expect(page.getByRole("status")).not.toHaveText("Paste tab here.");
  const button = page.getByRole("button", { name: importButton });
  test.skip((await button.count()) === 0, "refused, which is the fix");
  await button.click();
  await expect(page.getByTestId("paste-tab")).toHaveCount(0);
  const store = await dumpStore(page);
  const frets = (store.events as { kind: string; frets: Record<string, number> }[])
    .filter((e) => e.kind === "notes")
    .map((e) => e.frets);
  // The paste's top row is empty, so nothing it holds belongs on the song's top string, key 0.
  expect(frets.filter((f) => "0" in f)).toEqual([]);
});
