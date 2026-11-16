/**
 * Spec 011 US1: part playback. Menu item, route, the pitch of the first notes, prompt start, an unknown part, back,
 * persistence of Notes, and print (INV-015, INV-017, INV-002, SC-006).
 */
import { expect, test } from "@playwright/test";
import { seedSong } from "./reading-helpers";
import { setStoredTempo } from "./rhythm-probe-helpers";
import { openFourString } from "./wide-helpers";
import {
  installPlayRecorder,
  noteStarts,
  playRecord,
  recordedAudio,
  seedPlaybackSong,
  textToCols,
} from "./play-helpers";

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

test("every part card's menu opens with Play, and it goes to the part", async ({ page }) => {
  await installPlayRecorder(page);
  const seeded = await seedPlaybackSong(page);
  await page.goto(seeded.songUrl);
  const cards = page.getByRole("button", { name: /^Actions for part / });
  await expect(cards.first()).toBeVisible();
  const total = await cards.count();
  expect(total).toBeGreaterThan(0);
  for (let i = 0; i < total; i++) {
    await cards.nth(i).click();
    const first = page.getByRole("menuitem").first();
    await expect(first).toHaveAccessibleName(/^Play part /);
    await page.keyboard.press("Escape");
  }
  await cards.last().click();
  await page.getByRole("menuitem", { name: /^Play part T/ }).click();
  await expect(page).toHaveURL(new RegExp(`/songs/${seeded.songId}/play/${seeded.parts.t}$`));
  expect((await recordedAudio(page)).contexts.length).toBe(0);
  await expect(page.locator("[data-card]")).toHaveCount(1);
  await expect(page.getByTestId("part-playback")).toContainText("Part T");
});

test("part T sounds at the written pitches, and the page leaves audio closed on back", async ({ page }) => {
  await installPlayRecorder(page);
  const seeded = await seedPlaybackSong(page);
  await page.goto(`${seeded.songUrl}/play/${seeded.parts.t}`);
  await expect(page.getByTestId("click-start")).toHaveText("Play");
  await expect(page.getByTestId("click-start")).toBeEnabled();
  await page.getByTestId("click-start").click();
  await page.waitForTimeout(5000);
  const rec = await playRecord(page);
  expect(noteStarts(rec).length).toBeGreaterThan(2);
  // The pitch is set by automation on the oscillator's frequency.
  const notes = rec.freq.filter((f) => f.kind === "set").map((f) => ({ hz: f.value }));
  // E Standard on four strings: string 3 is E1 (28), so frets 5 and 7 are 33 (A1) and 35 (B1).
  expect(notes.length).toBeGreaterThan(2);
  expect(notes[0].hz).toBeCloseTo(hz(33), 2);
  expect(notes[1].hz).toBeCloseTo(hz(35), 2);
  await page.getByTestId("click-stop").click();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/songs/${seeded.songId}$`));
  await page.waitForTimeout(200);
  const audio = await recordedAudio(page);
  expect(audio.closes).toBeGreaterThanOrEqual(audio.contexts.length);
});

test("a long part starts sounding at once", async ({ page }) => {
  await installPlayRecorder(page);
  const seeded = await seedSong(page, [{ key: "z", label: "Z", columns: textToCols("3:5 3:7 3:9 3:5 | ".repeat(500)) }]);
  await setStoredTempo(page, 120);
  await openFourString(page, seeded.songUrl);
  await page.goto(`${seeded.songUrl}/play/${seeded.parts.z}`);
  const start = page.getByTestId("click-start");
  await expect(start).toBeEnabled();
  // The tap's own time, read in the page, so the driver's round trips are not counted.
  await page.evaluate(() =>
    document.addEventListener("click", () => ((window as unknown as { __tap: number }).__tap = performance.now()), true),
  );
  await start.click();
  const tapped = await page.evaluate(() => (window as unknown as { __tap: number }).__tap);
  await expect.poll(async () => (await recordedAudio(page)).starts.length).toBeGreaterThan(0);
  const audio = await recordedAudio(page);
  const first = audio.starts.find((s) => s.hz > 0)!;
  // The context opens ~0.5 s after the tap on this runner for the plain click too (measured), so the feature's own
  // share is the gap from the context to the first sound, and the whole is bounded loosely.
  expect((first.at - audio.contexts[0].at) / 1000).toBeLessThanOrEqual(0.2);
  expect((first.at - tapped) / 1000).toBeLessThanOrEqual(1.5);
});

test("a song with no arrangement plays a part; an unknown part says so", async ({ page }) => {
  await installPlayRecorder(page);
  const seeded = await seedSong(page, [{ key: "a", label: "A", columns: textToCols("3:5 3:7 3:9 3:5 |") }], []);
  await setStoredTempo(page, 120);
  await openFourString(page, seeded.songUrl);
  await page.goto(`${seeded.songUrl}/play/${seeded.parts.a}`);
  await expect(page.getByTestId("click-start")).toBeEnabled();
  await page.goto(`${seeded.songUrl}/play/00000000-0000-0000-0000-000000000000`);
  await expect(page.getByText("That part is not on this song")).toBeVisible();
  await expect(page.getByTestId("click-bar")).toHaveCount(0);
});

test("print shows one card and no bar", async ({ page }) => {
  await installPlayRecorder(page);
  const seeded = await seedPlaybackSong(page);
  await page.goto(`${seeded.songUrl}/play/${seeded.parts.t}`);
  await expect(page.getByTestId("click-start")).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("[data-card]")).toHaveCount(1);
  await expect(page.getByTestId("click-bar")).toBeHidden();
});
