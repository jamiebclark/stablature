/**
 * Round 10. INV-006-every-cell-of-a-system.spec.ts sets an unlabelled system beside a labelled one,
 * which refuses as `systems-differ` for any cell, so its import step skips and no browser probe has
 * stored a wrapped system since T091. These two systems match, so the paste reads, and every note
 * must reach the store on the string of its row.
 */
import { expect, test } from "@playwright/test";
import { TUNINGS, dumpStore, emptySong, pasteTab, startWith } from "../../../e2e/import-helpers";

const TEXT = [
  "--(5)--(7)--",
  "------------",
  "------------",
  "------------",
  "",
  "---5---7---",
  "-----------",
  "-----------",
  "---9-------",
].join("\n");

const importButton = /^(Import as part|Switch to)/;

test("INV-006 a riff of notes in brackets beside a like system is stored whole", async ({ page }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await pasteTab(page, TEXT);
  const button = page.getByRole("button", { name: importButton });
  await expect(button).toBeVisible();
  const ignored = await page.getByTestId("paste-ignored").locator("li").allTextContents();
  expect(ignored).toEqual([]);
  const before = ((await dumpStore(page)).events as unknown[]).length;
  await button.click();
  await expect(page.getByTestId("paste-tab")).toHaveCount(0);
  const events = (await dumpStore(page)).events as {
    kind: string;
    frets: Record<string, number>;
    repeat: number;
  }[];
  const notes = events.slice(before).filter((e) => e.kind === "notes");
  const held = notes.flatMap((e) => Object.entries(e.frets).map(([key, fret]) => [Number(key), fret]));
  // Key 0 is the paste's top row and key 3 its bottom row, so 9 is on the bottom string.
  console.log("stored:", JSON.stringify(held));
  expect(held).toEqual([[0, 5], [0, 7], [0, 5], [3, 9], [0, 7]]);
});
