/**
 * Round 3. INV-009 over the **When** members `e2e/play-stop.spec.ts` never times. Its fixed moments (0, 600, 1500 and
 * 2700 ms after the tap) fall in the count-in or on part T's first notes. Its 100 seeded stops wait 0 to 900 ms after
 * each tap, which is always inside the 2 s count-in at 120 bpm. So mid-glide, mid-let-ring and the loop seam were never
 * stopped at.
 *
 * Part T at 120 bpm, part playback (Loop on). Every column lasts 0.5 s from the first note's start `t0`:
 *   - mid-glide: column 3 (`3:9[slide_up]`, connected) glides over [t0 + 1.35, t0 + 1.5], so stop at t0 + 1.42;
 *   - mid-let-ring: the chord at column 13 rings under column 14's `3:0`, so stop at t0 + 7.2;
 *   - loop seam: the round is 28 columns (14 s), so stop at t0 + 13.99, as round 2's first note is being queued.
 * The moment is read on the audio clock in the page, then the stop is applied. Each **Stop** member is the same as
 * `play-stop.spec.ts`'s. The checks are the same too: no source left to stop later than t + 50 ms unless the context
 * closed, and silence on a live context 160 ms after the stop.
 */
import { expect, test, type Page } from "@playwright/test";
import { analyse, installPlayRecorder, noteStarts, playRecord, recordedAudio, seedPlaybackSong } from "../../../e2e/play-helpers";
import { deviceSets } from "../../../e2e/rhythm-probe-helpers";

const STOPS: { name: string; stop: (page: Page) => Promise<unknown> }[] = [
  { name: "tap Stop", stop: (p) => p.getByTestId("click-stop").click() },
  { name: "Space", stop: (p) => p.keyboard.press("Space") },
  { name: "r", stop: (p) => p.keyboard.press("r") },
  { name: "back link", stop: (p) => p.getByRole("link", { name: "Song" }).first().click() },
  { name: "audio lost", stop: (p) => deviceSets(p, "suspended") },
  { name: "hidden", stop: (p) => p.evaluate(() => window.dispatchEvent(new Event("pagehide"))) },
];
const WHEN = [
  { name: "mid-glide", at: 1.42 },
  { name: "mid-let-ring", at: 7.2 },
  { name: "loop seam", at: 13.99 },
];

for (const s of STOPS) {
  for (const w of WHEN) {
    test(`${s.name} ${w.name} leaves nothing sounding`, async ({ page }) => {
      test.setTimeout(60_000);
      await installPlayRecorder(page);
      const seeded = await seedPlaybackSong(page);
      await page.goto(`${seeded.songUrl}/play/${seeded.parts.t}`);
      await expect(page.getByTestId("click-start")).toBeEnabled();
      await page.getByTestId("click-start").click();
      await expect(page.getByTestId("click-stop")).toBeVisible();
      await expect.poll(async () => noteStarts(await playRecord(page)).length, { timeout: 5_000 }).toBeGreaterThan(0);
      const t0 = noteStarts(await playRecord(page))[0].when;
      await page.waitForFunction(
        (at) => (window as unknown as { __ctxs: AudioContext[] }).__ctxs.at(-1)!.currentTime >= at,
        t0 + w.at,
        { timeout: 30_000, polling: 5 },
      );
      const stoppedAt = await page.evaluate(() => (window as unknown as { __ctxs: AudioContext[] }).__ctxs.at(-1)!.currentTime);
      await s.stop(page);
      if (s.name === "back link") await page.waitForURL((u) => !u.pathname.includes("/play/"));
      await page.waitForTimeout(60);
      const audio = await recordedAudio(page);
      const t = await page.evaluate(() => (window as unknown as { __ctxs: AudioContext[] }).__ctxs.at(-1)!.currentTime);
      const lateStops = audio.stops.filter((x) => x.when !== null && x.when > t + 0.05);
      const closed = audio.closes > 0;
      expect(closed || lateStops.length === 0, `a source is left to stop later (stopped at t0 + ${(stoppedAt - t0).toFixed(3)})`).toBe(true);
      await page.waitForTimeout(100);
      const live = await page.evaluate(() => (window as unknown as { __ctxs: AudioContext[] }).__ctxs.at(-1)!.state === "running");
      const a = live ? await analyse(page) : null;
      if (a && s.name !== "r") expect(a.peak, `sound 160 ms after a stop at t0 + ${(stoppedAt - t0).toFixed(3)}`).toBeLessThan(0.001);
    });
  }
}
