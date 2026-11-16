/**
 * INV-017 ("never ... change the whole-song Notes choice") and data-model §4 ("Part playback has its own `notes` (on)
 * and `loop` (on) in component state"; `loop` in choices.ts is "whole song only"). Whole song: Notes on, Loop left off,
 * Notes back off. Open part playback, come back: Notes must still be off, and with Notes on again Loop must still be
 * off.
 *
 * Also the spec's edge case "A part deleted ... mid-run. The run plays what it started with, and stops at its end or
 * when the reader leaves": in part playback, a deletion arriving from another device mid-run must not end the run.
 */
import { expect, test } from "@playwright/test";
import { fromAnotherDevice } from "../../../e2e/rhythm-probe-helpers";
import { openCluster } from "../../../e2e/usability-helpers";
import { installPlayRecorder, seedPlaybackSong } from "../../../e2e/play-helpers";

test("visiting part playback leaves the whole song's Notes and Loop as they were", async ({ page }) => {
  await installPlayRecorder(page);
  const s = await seedPlaybackSong(page);
  await page.goto(s.playUrl);
  await openCluster(page);
  await page.getByTestId("play-notes").click();
  const loopBefore = await page.getByTestId("play-loop").getAttribute("aria-pressed");
  await page.getByTestId("play-notes").click();
  await page.getByTestId("panel-play-cluster").click();

  await page.goto(`${s.songUrl}/play/${s.parts.t}`);
  await expect(page.getByTestId("click-start")).toHaveText("Play");
  await page.getByRole("link", { name: "Whole song" }).click();
  await expect(page).toHaveURL(new RegExp(`/songs/${s.songId}/play$`));
  await openCluster(page);
  const notesAfter = await page.getByTestId("play-notes").getAttribute("aria-pressed");
  await page.getByTestId("play-notes").click();
  const loopAfter = await page.getByTestId("play-loop").getAttribute("aria-pressed");
  expect({ notesAfter, loopBefore, loopAfter }).toEqual({ notesAfter: "false", loopBefore: "false", loopAfter: "false" });
});

test("part playback: a deletion of the part from another device mid-run does not end the run", async ({ page }) => {
  await installPlayRecorder(page);
  const s = await seedPlaybackSong(page);
  await page.goto(`${s.songUrl}/play/${s.parts.t}`);
  await page.getByTestId("click-start").click();
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await page.waitForTimeout(800);
  await fromAnotherDevice(
    page,
    `const rows = await all("parts");
     await write("parts", (s) => { for (const r of rows) if (r.id === arg) s.put({ ...r, deletedAt: "2026-11-05T00:00:00.000Z-0000-x" }); });`,
    s.parts.t,
  );
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("click-stop"), "the run is still playing what it started with").toBeVisible();
});
