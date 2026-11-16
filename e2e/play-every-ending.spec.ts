/** Spec 011 INV-024: the endings of click-every-ending, with Notes on: silent within 50 ms, and Play works again. */
import { expect, test, type Page } from "@playwright/test";
import { deviceSets } from "./rhythm-probe-helpers";
import { analyse, installPlayRecorder, noteStarts, playRecord, recordedAudio, seedPlaybackSong } from "./play-helpers";

const HIDDEN = "Stopped because the screen was hidden. Start again when you are ready.";
const LOST = "Stopped because the device took the audio. Start again when you are ready.";
const BEHIND = "Stopped because the click could not keep time. Start again when you are ready.";

async function running(page: Page) {
  const s = await seedPlaybackSong(page);
  await page.goto(`${s.songUrl}/play/${s.parts.t}`);
  await expect(page.getByTestId("click-start")).toBeEnabled();
  await page.getByTestId("click-start").click();
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await page.waitForTimeout(1200);
}

const ENDINGS: { x: string; end: (p: Page) => Promise<unknown>; words: string }[] = [
  {
    x: "hidden",
    end: (p) =>
      p.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
      }),
    words: HIDDEN,
  },
  { x: "pagehide", end: (p) => p.evaluate(() => void window.dispatchEvent(new Event("pagehide"))), words: HIDDEN },
  { x: "audio lost", end: (p) => deviceSets(p, "interrupted"), words: LOST },
  {
    x: "stalled thread",
    end: (p) =>
      p.evaluate(() => {
        const t = Date.now();
        while (Date.now() - t < 2500);
      }),
    words: BEHIND,
  },
];

for (const e of ENDINGS) {
  test(`INV-024 ${e.x} with Notes on: silent, words, and Play again`, async ({ page }) => {
    await installPlayRecorder(page);
    await running(page);
    await e.end(page);
    await expect(page.getByTestId("click-start")).toBeVisible();
    await expect(page.getByTestId("click-state")).toHaveText(e.words);
    const before = noteStarts(await playRecord(page)).length;
    const audio = await recordedAudio(page);
    // The context goes 40 ms after the notes are faded, not in the same task.
    await expect.poll(async () => (await recordedAudio(page)).closes).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(600);
    expect(noteStarts(await playRecord(page)).length, "a note was queued after the end").toBe(before);
    const live = await page.evaluate(() => (window as unknown as { __ctxs: AudioContext[] }).__ctxs.at(-1)!.state === "running");
    if (live) expect((await analyse(page))!.peak).toBeLessThan(0.001);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-stop")).toBeVisible();
    await expect.poll(async () => noteStarts(await playRecord(page)).length, { timeout: 8000 }).toBeGreaterThan(before);
  });
}

test("INV-024 with no audio the outline and beat still run, and the soundless line shows", async ({ page }) => {
  await installPlayRecorder(page, { audio: "absent" });
  const s = await seedPlaybackSong(page);
  await page.goto(`${s.songUrl}/play/${s.parts.t}`);
  await page.getByTestId("click-start").click();
  await expect(page.getByTestId("click-stop")).toBeVisible();
  await expect(page.getByTestId("click-help")).toContainText("No sound on this device. The beat is still shown.");
  const seen = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const k = await page
      .locator(".tab-column-reading")
      .first()
      .getAttribute("data-column", { timeout: 500 })
      .catch(() => null);
    if (k) seen.add(k);
    await page.waitForTimeout(250);
  }
  expect(seen.size, "the outline moved").toBeGreaterThan(1);
  await expect(page.getByTestId("click-beat")).toBeVisible();
});
