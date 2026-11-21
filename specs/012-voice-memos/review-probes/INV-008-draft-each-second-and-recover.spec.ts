/**
 * INV-008 (review round 1, F7): "Never does a crash or close lose more than the last second recorded."
 *
 * The suite's `e2e/memo-recover.spec.ts` never runs: it self-skips off `desktop`, `playwright.config.ts` lists it in
 * PHONE_ONLY so the desktop project never loads it, and on a desktop project CDP `Page.crash` closes the whole
 * context too (`page.goto: Target page, context or browser has been closed`), so its reopen cannot run anywhere.
 *
 * This probe checks the claim without a crash, in a real browser:
 *   1. record; time the recording from the recorder's own clock (the panel's elapsed time reaching 0:01);
 *   2. copy, byte for byte, the draft a crash at that moment would leave;
 *   3. give it to a fresh device and open the song: the app's own `recoverDrafts` must recover it (E13), or say it
 *      could not (E14) for a format whose prefix cannot play;
 *   4. decode the recovered audio and compare its real length with the time recorded.
 * Holds when at most 1 s (+0.3 s for this probe's sampling) is lost.
 */
import { expect, test } from "@playwright/test";
import { idb, seedSongM, startRecording } from "../../../e2e/memo-helpers";

interface Captured {
  draft: Record<string, unknown> & { id: string; format: string };
  chunks: { index: number; b: number[] }[];
}

test("a recording cut off by a crash loses at most the last second", async ({ browser }) => {
  const rec = await browser.newContext({ permissions: ["microphone"] });
  const page = await rec.newPage();
  await seedSongM(page);
  await startRecording(page, "A");
  await expect
    .poll(() => page.getByTestId("record-elapsed").textContent(), { intervals: [50], timeout: 10_000 })
    .toBe("0:01");
  const startedAt = Date.now() - 1_000;
  await page.waitForTimeout(3_500);
  const recordedMs = Date.now() - startedAt;
  const captured = await idb<Captured>(
    page,
    `const d = (await all("memoDrafts"))[0];
     const c = (await all("memoDraftChunks")).filter((x) => x.draftId === d.id).sort((a, b) => a.index - b.index);
     return { draft: d, chunks: c.map((x) => ({ index: x.index, b: Array.from(new Uint8Array(x.bytes)) })) };`,
  );
  await rec.close();

  const ctx = await browser.newContext();
  const next = await ctx.newPage();
  const seeded = await seedSongM(next);
  const partA = (seeded.parts as Record<string, string>).a;
  await idb(
    next,
    `const { cap, partA } = arg;
     const part = (await all("parts")).find((p) => p.id === partA);
     const draft = { ...cap.draft, id: crypto.randomUUID(), memoId: crypto.randomUUID(), partId: partA, bandId: part.bandId, songId: part.songId };
     await write("memoDrafts", (s) => s.put(draft));
     await write("memoDraftChunks", (s) => cap.chunks.forEach((c) => s.put({ draftId: draft.id, index: c.index, bytes: new Uint8Array(c.b).buffer })));`,
    { cap: captured, partA },
  );
  await next.goto(seeded.songUrl);
  const notice = next.getByTestId("memo-notice");
  await expect(notice).toContainText("A recording was cut off when the app closed", { timeout: 5_000 });
  const words = (await notice.first().textContent()) ?? "";
  expect(await idb<number>(next, `return (await all("memoDrafts")).length;`)).toBe(0);

  if (!/was recovered/.test(words)) {
    console.log("INV-008:", JSON.stringify({ format: captured.draft.format, recordedMs, words }));
    expect(/webm|ogg/.test(captured.draft.format), "a WebM/Ogg prefix always plays, so E14 is wrong for it").toBe(false);
    await ctx.close();
    return;
  }
  const decodedMs = await idb<number>(
    next,
    `const a = (await all("memoAudio"))[0];
     const ac = new OfflineAudioContext(1, 1, 48000);
     const buf = await ac.decodeAudioData(a.bytes.slice(0));
     return Math.round(buf.duration * 1000);`,
  );
  const statedMs = await idb<number>(next, `return (await all("memos"))[0].durationMs;`);
  console.log("INV-008:", JSON.stringify({ format: captured.draft.format, chunks: captured.chunks.length, recordedMs, decodedMs, statedMs, lostMs: recordedMs - decodedMs, words }));
  expect(recordedMs - decodedMs, "more than the last second was lost").toBeLessThanOrEqual(1_300);
  await ctx.close();
});
