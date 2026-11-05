/**
 * Round 9. INV-006 and INV-009 through the real screen and the real store. Two systems. The first
 * is a riff of notes in brackets, which spec.md's accepted list names as common in wild tab, spaced
 * with two rails and with no labels or pipes, so no digit on it touches a rail and no S-test claims
 * it. No import button may appear unless every note of both systems reaches the store. The second
 * test records what is stored if one does.
 */
import { expect, test } from "@playwright/test";
import { TUNINGS, dumpStore, emptySong, pasteTab, startWith } from "./import-helpers";

const TEXT = [
  "--(5)--(7)--",
  "------------",
  "------------",
  "------------",
  "",
  "G |---5---7---|",
  "D |-----------|",
  "A |-----------|",
  "E |---9-------|",
].join("\n");

const importButton = /^(Import as part|Switch to)/;

test("INV-006 a riff of notes in brackets is read, or the paste refuses", async ({ page }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await pasteTab(page, TEXT);
  await expect(page.getByRole("status")).not.toHaveText("Paste tab here.");
  const ignored = await page.getByTestId("paste-ignored").locator("li").allTextContents();
  expect(ignored).toEqual([]);
});

test("imported, the part holds all five notes of both systems", async ({ page }) => {
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
  expect(notes.reduce((n, e) => n + Object.keys(e.frets).length * e.repeat, 0)).toBe(5);
});
