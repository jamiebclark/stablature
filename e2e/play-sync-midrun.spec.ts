/** Spec 011 mid-run edit edge: a remote edit and a part deletion mid-run change nothing until the next start. */
import { expect, test } from "@playwright/test";
import { fromAnotherDevice, patchEvent } from "./rhythm-probe-helpers";
import { installPlayRecorder, noteStarts, playRecord, seedPlaybackSong } from "./play-helpers";

test("a remote edit mid-run changes nothing sounding until the next start", async ({ page }) => {
  await installPlayRecorder(page);
  const s = await seedPlaybackSong(page);
  await page.goto(`${s.songUrl}/play/${s.parts.t}`);
  await page.getByTestId("click-start").click();
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await page.waitForTimeout(800);
  await patchEvent(page, 0, { frets: { 3: 12 } });
  await page.waitForTimeout(2500);
  await expect(page.getByTestId("click-stop")).toBeVisible();
  expect(noteStarts(await playRecord(page)).length).toBeGreaterThan(0);
  await page.getByTestId("click-stop").click();
});

test("a part deleted mid-run does not break the run, which ends at the stop", async ({ page }) => {
  await installPlayRecorder(page);
  const s = await seedPlaybackSong(page);
  await page.goto(`${s.songUrl}/play/${s.parts.t}`);
  await page.getByTestId("click-start").click();
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await page.waitForTimeout(800);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fromAnotherDevice(
    page,
    `const rows = await all("parts");
     await write("parts", (s) => { for (const r of rows) if (r.id === arg) s.put({ ...r, deletedAt: "2026-11-05T00:00:00.000Z-0000-x" }); });`,
    s.parts.t,
  );
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
  if (await page.getByTestId("click-stop").count()) await page.getByTestId("click-stop").click();
  const after = noteStarts(await playRecord(page)).length;
  await page.waitForTimeout(600);
  expect(noteStarts(await playRecord(page)).length).toBe(after);
});
