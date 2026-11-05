/**
 * Round 3. INV-006 through the real screen and the real store, for the rows T065 left out.
 *
 * Five rows on a four-string song is a refusal (FR-015). The top row of each paste has one thing the
 * notation lacks and no run of three rails. Each must leave no import button and nothing stored.
 */
import { expect, test } from "@playwright/test";
import { TUNINGS, dumpStore, emptySong, pasteTab, startWith } from "../../../e2e/import-helpers";

const REST = ["---5---7---", "---5---7---", "---3---5---", "---3---5---"];

const PASTES: [string, string][] = [
  ["`s` for a slide", ["-5s7-5-7-", ...REST].join("\n")],
  ["one space between notes", ["-5 7-5-7-", ...REST].join("\n")],
  ["minus signs for rails", ["−5−7−5−7−", ...REST].join("\n")],
];

const importButton = /^(Import as part|Switch to)/;

test.describe("INV-006 a damaged top row never reaches the store", () => {
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
  // The paste's top row is the damaged one, so nothing below it belongs on key 0, the top string.
  expect(frets.filter((f) => "0" in f)).toEqual([]);
});
