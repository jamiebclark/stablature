import { expect, test, type Page } from "@playwright/test";
import {
  expectMicrophoneReleased,
  fillDevice,
  setDeviceFull,
  idb,
  keepMicrophoneStreams,
  seedSongM,
  startRecording,
  withFakeMicrophone,
} from "./memo-helpers";

/**
 * INV-007 (e2e): every way a recording ends leaves a memo or a notice, and the microphone is released within a second.
 * Observation only, except the one stated stand-in: E5 answers the request with a refusal, since a fake-UI Chromium
 * never refuses by itself. E8 dispatches `pagehide`, the fallback plan § Invariants names.
 */
withFakeMicrophone();

const notice = (page: Page) => page.getByTestId("memo-notice").filter({ hasNotText: "may clear memos" });
const memos = (page: Page) => page.getByTestId("memo-play");

test.beforeEach(async ({ page }) => {
  await keepMicrophoneStreams(page);
  await fillDevice(page);
});

test("E1 stop: the memo appears", async ({ page }) => {
  await seedSongM(page);
  await startRecording(page, "A");
  await page.waitForTimeout(2000);
  await page.getByTestId("record-stop").click();
  await expect(memos(page)).toHaveCount(1, { timeout: 2_000 });
  await expectMicrophoneReleased(page);
});

test("E4 discard: the words, nothing saved", async ({ page }) => {
  await seedSongM(page);
  await startRecording(page, "A");
  await page.waitForTimeout(1500);
  await page.getByTestId("record-discard").click();
  await page.getByTestId("record-discard-confirm").click();
  await expect(notice(page)).toContainText("Recording discarded. Nothing was saved.");
  await expect(memos(page)).toHaveCount(0);
  await expectMicrophoneReleased(page);
});

test("E5 refused: the words, nothing saved", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("denied", "NotAllowedError");
    };
  });
  await seedSongM(page);
  await startRecording(page, "A").catch(() => undefined);
  await expect(notice(page)).toContainText("The microphone was refused. To record, allow the microphone for this site");
  await expect(memos(page)).toHaveCount(0);
});

test("E7 track ended: kept, with the words", async ({ page }) => {
  await seedSongM(page);
  await startRecording(page, "A");
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    for (const s of (window as unknown as { __memoStreams: MediaStream[] }).__memoStreams)
      for (const t of s.getTracks()) {
        t.stop();
        t.dispatchEvent(new Event("ended"));
      }
  });
  await expect(memos(page)).toHaveCount(1, { timeout: 3_000 });
  await expect(notice(page)).toContainText("The recording was cut short. The first 0:0");
  await expectMicrophoneReleased(page);
});

test("E8 hidden: kept, with the words", async ({ page }) => {
  await seedSongM(page);
  await startRecording(page, "A");
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await expect(memos(page)).toHaveCount(1, { timeout: 3_000 });
  await expect(notice(page)).toContainText("Recording stopped when you left the app. The first 0:0");
  await expectMicrophoneReleased(page);
});

test("E9 left via a link and via browser back: kept, released", async ({ page }) => {
  const seeded = await seedSongM(page);
  await startRecording(page, "A");
  await page.waitForTimeout(2500);
  await page.locator('a[href$="/play"]:visible').first().click();
  await expect(page).toHaveURL(/\/play$/);
  await expectMicrophoneReleased(page);
  // Let the flush finish and the memo land before a full reload can pre-empt it.
  await expect.poll(() => idb<number>(page, `return (await all("memos")).length;`)).toBe(1);
  await page.goto(seeded.songUrl);
  await expect(memos(page)).toHaveCount(1);
  await expect(notice(page)).toContainText("Recording stopped when you left the song. The first 0:0");

  // Browser back: song -> capture (client navigation) -> back to the song -> record -> back again.
  await page.locator('a[href$="/capture"]:visible').first().click();
  await expect(page).toHaveURL(/\/capture/);
  await page.goBack();
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+$/);
  await startRecording(page, "B");
  await page.waitForTimeout(2500);
  await page.goBack();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { __memoStreams: MediaStream[] }).__memoStreams.every((s) =>
          s.getTracks().every((t) => t.readyState === "ended"),
        ),
      ),
    )
    .toBe(true);
});

test("E11 too short: dropped, with the words", async ({ page }) => {
  await seedSongM(page);
  await startRecording(page, "A");
  await page.getByTestId("record-stop").click();
  await expect(notice(page)).toContainText("Too short to keep. Recordings need at least 1 second.");
  await expect(memos(page)).toHaveCount(0);
  await expectMicrophoneReleased(page);
});

test("E12 out of room: held with the words", async ({ page }) => {
  await seedSongM(page);
  await startRecording(page, "A");
  await setDeviceFull(page, true);
  await page.waitForTimeout(4000);
  await page.getByTestId("record-stop").click();
  await expect(notice(page)).toContainText("This device is out of room, so the recording isn't saved yet.");
  await expect(page.getByTestId("record-retry")).toBeVisible();
  await expectMicrophoneReleased(page);
});

test("E13/E14: a seeded garbage draft is dropped with the unrecoverable words", async ({ page }) => {
  await seedSongM(page);
  await idb(
    page,
    `
    const part = (await all("parts")).find((p) => p.label === "A");
    const id = "garbage-draft";
    await write("memoDrafts", (s) => s.put({ id, memoId: "garbage-memo", partId: part.id, bandId: part.bandId, songId: part.songId, format: "audio/webm;codecs=opus", startedAt: Date.now() }));
    await write("memoDraftChunks", (s) => { for (let i = 0; i < 3; i++) s.put({ draftId: id, index: i, bytes: new Uint8Array(1000).fill(7).buffer }); });
    `,
  );
  await page.reload();
  await expect(notice(page)).toContainText("A recording was cut off when the app closed and couldn't be recovered.", {
    timeout: 8_000,
  });
  await expect(memos(page)).toHaveCount(0);
});
