/**
 * Round 4. Both sides of the line touching a staff, through the real screen and the real store.
 *
 * INV-006: a row the notation can write, with no label and no run of three rails, must not vanish.
 * INV-010: the app's own export of one part must import, whatever its name and notes say.
 */
import { expect, test } from "@playwright/test";
import { TUNINGS, dumpStore, emptySong, pasteTab, startWith } from "../../../e2e/import-helpers";

const REST = ["---5---7---", "---5---7---", "---3---5---", "---3---5---"];

const PASTES: [string, string][] = [
  ["a row of let-ring notes", ["-(5)-(7)-", ...REST].join("\n")],
  ["a row of tapped and bent notes", ["-t5b-t7b-", ...REST].join("\n")],
  ["a row of let-ring dead notes", ["--(x)--(x)--", ...REST].join("\n")],
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

/** What the person gets today, recorded rather than asserted away: the stored frets. */
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
  // The paste's top row is the one lost, so nothing below it belongs on key 0, the top string.
  expect(frets.filter((f) => "0" in f)).toEqual([]);
});

const CUT = [
  "Dirge",
  "Hollow Crown  ·  Standard (G2 D2 A1 E1)  ·  120 bpm",
  "",
  "A  12-bar",
  "G |-5-7-|",
  "D |-----|",
  "A |-----|",
  "E |-----|",
  "Play 4x.",
  "",
].join("\n");

test("INV-010 one part cut from a song export imports, its name and notes listed", async ({ page }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await pasteTab(page, CUT);
  await expect(page.getByRole("button", { name: importButton })).toHaveCount(1);
  await expect(page.getByTestId("paste-ignored")).toContainText("A  12-bar");
  await expect(page.getByTestId("paste-ignored")).toContainText("Play 4x.");
});
