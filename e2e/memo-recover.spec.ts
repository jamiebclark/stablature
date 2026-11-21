import { expect, test } from "@playwright/test";
import { idb, seedSongM, startRecording, withFakeMicrophone } from "./memo-helpers";

/** INV-008 (e2e): a crash loses at most the last second; the next open recovers the memo or says it could not.
 * Copies the draft a crash would leave and recovers it on a fresh device; no Page.crash, which closes the context. */
withFakeMicrophone();

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
