/**
 * Round 6. INV-006 through the real screen and the real store. `000` is three open strings with no
 * gap, which spec.md line 223 refuses. No import button may appear. If one does, the second test
 * records what reaches the store.
 */
import { expect, test } from "@playwright/test";
import { TUNINGS, dumpStore, emptySong, pasteTab, startWith } from "../../../e2e/import-helpers";

const TEXT = ["G |-----------|", "D |-----------|", "A |-----------|", "E |-000-000---|"].join("\n");

const importButton = /^(Import as part|Switch to)/;

test("INV-006 zeros run together are refused", async ({ page }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await pasteTab(page, TEXT);
  await expect(page.getByRole("status")).not.toHaveText("Paste tab here.");
  await expect(page.getByRole("button", { name: importButton })).toHaveCount(0);
});

test("imported, the part holds all six open strings", async ({ page }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await pasteTab(page, TEXT);
  await expect(page.getByRole("status")).not.toHaveText("Paste tab here.");
  const button = page.getByRole("button", { name: importButton });
  test.skip((await button.count()) === 0, "refused, which is the fix");
  const before = ((await dumpStore(page)).events as unknown[]).length;
  await button.click();
  await expect(page.getByTestId("paste-tab")).toHaveCount(0);
  const events = (await dumpStore(page)).events as {
    kind: string;
    frets: Record<string, number>;
    repeat: number;
  }[];
  const notes = events.slice(before).filter((e) => "3" in e.frets);
  console.log("stored:", JSON.stringify(notes.map((e) => [e.frets, e.repeat])));
  expect(notes.reduce((n, e) => n + e.repeat, 0)).toBe(6);
});
