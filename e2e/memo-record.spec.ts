import { expect, test } from "@playwright/test";
import { idb, recordMemo, seedSongM, stopToPlayable, withFakeMicrophone } from "./memo-helpers";

/** SC-001: record 4 s, Stop, and the memo plays within a second. */
withFakeMicrophone();

test("SC-001 record 4 s, Stop, play enabled within 1 s", async ({ page }) => {
  await seedSongM(page);
  await recordMemo(page, "A", 4000);
  const memo = page.getByTestId("memo").first();
  await expect(page.getByTestId("part-memos")).toHaveCount(1);
  await memo.getByTestId("memo-play").click();
  await expect(memo.getByTestId("memo-play")).toHaveAttribute("aria-pressed", "true");
});

/** SC-001 over several lengths: Stop to playable stays within 1 s. */
test("signed out: Stop to playable, by recording length", async ({ page }) => {
  test.setTimeout(180_000);
  await seedSongM(page);
  const samples: { recordMs: number; ms: number }[] = [];
  for (const recordMs of [2_000, 4_000, 8_000, 2_000, 4_000, 8_000]) {
    samples.push({ recordMs, ms: await stopToPlayable(page, recordMs) });
  }
  console.log("SC-001 signed out:", JSON.stringify(samples));
  expect(samples.filter((s) => s.ms > 1_000), "Stop to playable over 1 s").toEqual([]);
});

/**
 * F27: the microphone can open late on a slow device or a loaded runner. This stands in for one: the REAL stream
 * resolves 1.5 s late and nothing else changes. `recordMemo` counts from the recorder's start, so 2 s is still 2 s.
 */
test("recordMemo keeps a 2 s memo when the microphone opens 1.5 s late", async ({ page }) => {
  await page.addInitScript((late) => {
    const md = navigator.mediaDevices;
    if (!md) return;
    const real = md.getUserMedia.bind(md);
    md.getUserMedia = async (constraints) => {
      const stream = await real(constraints);
      await new Promise((resolve) => setTimeout(resolve, late));
      return stream;
    };
  }, 1_500);
  await seedSongM(page);
  await recordMemo(page, "A", 2_000);
  const kept = await idb<{ durationMs: number }[]>(
    page,
    `return (await all("memos")).filter((m) => m.deletedAt === null).map((m) => ({ durationMs: m.durationMs }));`,
  );
  expect(kept).toHaveLength(1);
  expect(kept[0].durationMs).toBeGreaterThanOrEqual(1_000);
});
