/**
 * Round 7. INV-006 through the real screen and the real store. Two systems, each four rows, no
 * labels and no pipes. The second is a bass line on one row with one rail between notes, so none of
 * its lines holds a run of three rails beside a fret. No import button may appear unless every note
 * of both systems reaches the store. The second test records what is stored if one does.
 */
import { expect, test } from "@playwright/test";
import { TUNINGS, dumpStore, emptySong, pasteTab, startWith } from "./import-helpers";

const TEXT = [
  "---5---7---5---",
  "---------------",
  "---------------",
  "---------------",
  "",
  "-----------",
  "-----------",
  "-----------",
  "-3-3-5-5-3-",
].join("\n");

const importButton = /^(Import as part|Switch to)/;

test("INV-006 a second system is read, or the paste refuses", async ({ page }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await pasteTab(page, TEXT);
  await expect(page.getByRole("status")).not.toHaveText("Paste tab here.");
  const ignored = await page.getByTestId("paste-ignored").locator("li").count();
  expect(ignored).toBe(0);
});

test("imported, the part holds all eight notes of both systems", async ({ page }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await pasteTab(page, TEXT);
  await expect(page.getByRole("status")).not.toHaveText("Paste tab here.");
  const button = page.getByRole("button", { name: importButton });
  test.skip((await button.count()) === 0, "refused, which is a fix");
  const before = ((await dumpStore(page)).events as unknown[]).length;
  const label = await button.textContent();
  await button.click();
  await expect(page.getByTestId("paste-tab")).toHaveCount(0);
  const events = (await dumpStore(page)).events as {
    kind: string;
    frets: Record<string, number>;
    repeat: number;
  }[];
  const notes = events.slice(before).filter((e) => e.kind === "notes");
  console.log("button:", label, "stored:", JSON.stringify(notes.map((e) => [e.frets, e.repeat])));
  expect(notes.reduce((n, e) => n + e.repeat, 0)).toBe(8);
});
