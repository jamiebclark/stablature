/**
 * Review round 4, MAJOR F27 (carries MINOR F18 and F24). Plan § Constitution Check gate "tests must be able to fail
 * for the right reason".
 *
 * `recordMemo` and `startRecording` (`e2e/memo-helpers.ts:287-301`) start their clock when `record-panel` shows. The
 * panel shows at the tap, in the recorder's `asking` phase, but the recorder starts only once `getUserMedia`
 * resolves (`src/lib/memos/recorder.ts:347`, `:403-407`). When the microphone opens late (0.7-1.8 s under load; see
 * `INV-006-meta-line-too-short.spec.ts`), a 2 s `recordMemo` records under 1 s. The product then rightly says "Too
 * short to keep" (E11), and the calling test fails on the helper, not on what it tests.
 *
 * This probe makes the late microphone happen every time. An init script resolves the REAL stream 1.5 s late, and
 * changes nothing else. It is a probe of the test helper, not of the product, so the plan's "no replaced browser
 * behaviour" rule for invariant probes does not apply; it stands in for a slow device or a loaded CI runner.
 *
 * Holds when `recordMemo(page, "A", 2_000)` still yields one kept memo of at least 1 s. Fails today: the helper
 * presses Stop 2 s after the tap, which is 0.5 s after the recorder started.
 *
 *   npx playwright test -c specs/012-voice-memos/review-probes/playwright.review.config.ts --workers=1 F27
 */
import { expect, test } from "@playwright/test";
import { idb, recordMemo, seedSongM } from "../../../e2e/memo-helpers";

const LATE_MS = 1_500;

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
  }, LATE_MS);
  await seedSongM(page);

  let kept: { durationMs: number }[] = [];
  let notices: string[] = [];
  try {
    await recordMemo(page, "A", 2_000);
  } finally {
    notices = await page.getByTestId("memo-notice").allTextContents();
    kept = await idb<{ durationMs: number }[]>(
      page,
      `return (await all("memos")).filter((m) => m.deletedAt === null).map((m) => ({ durationMs: m.durationMs }));`,
    );
    console.log("F27 late-microphone:", JSON.stringify({ lateMs: LATE_MS, kept, notices }));
  }
  expect(kept).toHaveLength(1);
  expect(kept[0].durationMs).toBeGreaterThanOrEqual(1_000);
});
