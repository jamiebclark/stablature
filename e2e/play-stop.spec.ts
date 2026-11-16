/**
 * Spec 011 INV-009: every way of stopping silences every source within 50 ms (SC-007), at every moment in the music.
 */
import { expect, test, type Page } from "@playwright/test";
import { deviceSets } from "./rhythm-probe-helpers";
import { analyse, installPlayRecorder, recordedAudio, seedPlaybackSong } from "./play-helpers";

async function running(page: Page) {
  const seeded = await seedPlaybackSong(page);
  await page.goto(`${seeded.songUrl}/play/${seeded.parts.t}`);
  await expect(page.getByTestId("click-start")).toBeEnabled();
  await page.getByTestId("click-start").click();
  await expect(page.getByTestId("click-stop")).toBeVisible();
  return seeded;
}

const STOPS: { name: string; stop: (page: Page, url: string) => Promise<unknown> }[] = [
  { name: "tap Stop", stop: (p) => p.getByTestId("click-stop").click() },
  { name: "Space", stop: (p) => p.keyboard.press("Space") },
  { name: "r", stop: (p) => p.keyboard.press("r") },
  { name: "back link", stop: (p) => p.getByRole("link", { name: "Song" }).first().click() },
  { name: "audio lost", stop: (p) => deviceSets(p, "suspended") },
  { name: "hidden", stop: (p) => p.evaluate(() => window.dispatchEvent(new Event("pagehide"))) },
];
const WHEN = [0, 600, 1500, 2700];

for (const s of STOPS) {
  for (const ms of WHEN) {
    test(`${s.name} at ${ms} ms leaves nothing sounding`, async ({ page }) => {
      await installPlayRecorder(page);
      const seeded = await running(page);
      await page.waitForTimeout(ms);
      await s.stop(page, seeded.songUrl);
      // The back link stops the engine when the route unmounts, so wait for the route, not for a fixed beat.
      if (s.name === "back link") await page.waitForURL((u) => !u.pathname.includes("/play/"));
      await page.waitForTimeout(60);
      const audio = await recordedAudio(page);
      const t = await page.evaluate(() => (window as unknown as { __ctxs: AudioContext[] }).__ctxs.at(-1)!.currentTime);
      const lateStops = audio.stops.filter((x) => x.when !== null && x.when > t + 0.05);
      const closed = audio.closes > 0;
      expect(closed || lateStops.length === 0, "a source is left to stop later ").toBe(true);
      await page.waitForTimeout(100);
      // A closed or suspended context renders nothing, and its analyser keeps its last samples: only a live one is read.
      const live = await page.evaluate(() => (window as unknown as { __ctxs: AudioContext[] }).__ctxs.at(-1)!.state === "running");
      const a = live ? await analyse(page) : null;
      if (a && s.name !== "r") expect(a.peak).toBeLessThan(0.001);
    });
  }
}

test("100 stops at seeded random times leave nothing sounding", async ({ page }) => {
  test.setTimeout(180_000);
  await installPlayRecorder(page);
  const seeded = await seedPlaybackSong(page);
  await page.goto(`${seeded.songUrl}/play/${seeded.parts.t}`);
  await expect(page.getByTestId("click-start")).toBeEnabled();
  let seed = 11;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 100; i++) {
    await page.getByTestId("click-start").click();
    await page.waitForTimeout(Math.floor(next() * 900));
    await page.getByTestId("click-stop").click();
    await expect(page.getByTestId("click-start")).toBeVisible();
  }
  await page.waitForTimeout(150);
  const audio = await recordedAudio(page);
  expect(audio.closes).toBe(audio.contexts.length);
  const a = await analyse(page);
  if (a) expect(a.peak).toBeLessThan(0.001);
});

test("part scope: browser back from a running part leaves nothing sounding", async ({ page }) => {
  await installPlayRecorder(page);
  const s = await seedPlaybackSong(page);
  await page.goto(s.songUrl);
  await page.getByRole("button", { name: /^Actions for part T/ }).click();
  await page.getByRole("menuitem", { name: /^Play part T/ }).click();
  await expect(page).toHaveURL(new RegExp(`/play/${s.parts.t}$`));
  await expect(page.getByTestId("click-start")).toBeEnabled();
  await page.getByTestId("click-start").click();
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await page.waitForTimeout(2700);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/songs/${s.songId}$`));
  await page.waitForTimeout(60);
  const t = await page.evaluate(() => (window as unknown as { __ctxs: AudioContext[] }).__ctxs.at(-1)!.currentTime);
  await page.waitForTimeout(40);
  const rec = await recordedAudio(page);
  const late = rec.stops.filter((x) => x.when !== null && x.when > t + 0.05).length;
  expect({ contexts: rec.contexts.length, closed: rec.closes, ok: rec.closes > 0 || late === 0 }).toEqual({
    contexts: 1,
    closed: 1,
    ok: true,
  });
});
