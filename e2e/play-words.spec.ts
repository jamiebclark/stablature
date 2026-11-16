/** Spec 011 INV-023 (e2e): the bar's idle words and whether Play is enabled, for each state of the music. */
import { expect, test, type Page } from "@playwright/test";
import { seedSong } from "./reading-helpers";
import { setStoredTempo } from "./rhythm-probe-helpers";
import { openFourString } from "./wide-helpers";
import { openCluster } from "./usability-helpers";
import { installPlayRecorder, seedPlaybackSong, textToCols } from "./play-helpers";

async function withNotes(page: Page) {
  await openCluster(page);
  await page.getByTestId("play-notes").click();
}

async function oneSong(page: Page, text: string, tempo: number | null, lengths: (string | null)[] = []) {
  await installPlayRecorder(page);
  const s = await seedSong(page, [{ key: "a", label: "A", columns: textToCols(text).map((c, i) => (c.kind === "barline" ? c : { ...c, d: lengths[i] ?? null })) }], [{ part: "a" }]);
  await setStoredTempo(page, tempo);
  await openFourString(page, s.songUrl);
  return s;
}

test("playback song: some notes carry a length, so the last one is carried", async ({ page }) => {
  await installPlayRecorder(page);
  const s = await seedPlaybackSong(page);
  await page.goto(s.playUrl);
  await withNotes(page);
  await expect(page.getByTestId("click-state")).toHaveText(/^(Notes with no length take|No note has a length|Notes play)/);
  await expect(page.getByTestId("click-start")).toBeEnabled();
});

test("every note timed: written", async ({ page }) => {
  const s = await oneSong(page, "3:5 3:7 |", 120, ["q", "q"]);
  await page.goto(`${s.songUrl}/play`);
  await withNotes(page);
  await expect(page.getByTestId("click-state")).toHaveText("Notes play the lengths written.");
  await expect(page.getByTestId("click-start")).toBeEnabled();
});

test("one set length: some", async ({ page }) => {
  const s = await oneSong(page, "3:5 3:7 |", 120, ["8"]);
  await page.goto(`${s.songUrl}/play`);
  await withNotes(page);
  await expect(page.getByTestId("click-state")).toHaveText("Notes with no length take the last length, or one beat.");
});

test("empty part: nothing to play", async ({ page }) => {
  const s = await oneSong(page, "|", 120);
  await page.goto(`${s.songUrl}/play/${s.parts.a}`);
  await expect(page.getByTestId("click-state")).toHaveText("There are no notes to play here.");
  await expect(page.getByTestId("click-start")).toBeDisabled();
});

test("no tempo", async ({ page }) => {
  const s = await oneSong(page, "3:5 |", null, ["q"]);
  await page.goto(`${s.songUrl}/play/${s.parts.a}`);
  await expect(page.getByTestId("click-state")).toHaveText("Set a tempo to use the click.");
  await expect(page.getByTestId("click-start")).toBeDisabled();
});
