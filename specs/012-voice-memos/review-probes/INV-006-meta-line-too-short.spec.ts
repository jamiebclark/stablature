/**
 * INV-006 (review round 2): `e2e/memo-recorder.spec.ts`'s meta-line test failed 4 of 8 runs at `--workers=1` in
 * round 2, every time on "Too short to keep. Recordings need at least 1 second." after `recordMemo(owner, "A",
 * 2_000)`. Round 1 ran it 4 of 4 green. This probe repeats that test's steps with observation-only wrappers on
 * `getUserMedia`, `MediaRecorder.start` and `dataavailable`, and prints when each happened relative to the tap on
 * Record memo, so the cause can be told apart:
 *   - the microphone opening late (Stop lands while the recorder is still asking);
 *   - the recorder starting but no chunk arriving (`total === 0`);
 *   - a `visibilitychange` to hidden in the first second (E8 with < 1 s spoken).
 * Round 2 result: the microphone opened 1.2 s and 1.8 s after the tap in the two failing runs (0.1-0.7 s in the passing
 * ones), so the test recorded 0.8 s and 0.2 s and the product was right to say "Too short". The defect is the
 * suite helper `recordMemo`, which starts its wait when the panel shows (while still asking), not when recording
 * starts. So this probe holds when each run agrees with E11: kept if at least 1.1 s passed between the recorder's
 * `start` event and Stop, and "Too short to keep" if under 0.9 s. Run it as separate tests to reproduce the slow
 * microphone: `PROBE_RUNS=1 ... --repeat-each=4`.
 */
import { expect, test } from "@playwright/test";
import { sharePartA, twoMembers } from "../../../e2e/memo-helpers";

test("a recording is kept iff the recorder ran at least a second before Stop, while the push is held", async ({ browser }) => {
  test.setTimeout(400_000);
  const outcomes: unknown[] = [];
  for (let run = 0; run < Number(process.env.PROBE_RUNS ?? 3); run++) {
    const trio = await twoMembers(browser);
    try {
      await sharePartA(trio);
      const page = trio.owner.page;
      await page.evaluate(() => {
        const w = window as unknown as { __t: Record<string, number | number[] | string> };
        w.__t = { chunks: [] as number[] };
        const t = w.__t;
        const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getUserMedia = async (c) => {
          t.gumCalled = performance.now();
          const s = await gum(c);
          t.gumResolved = performance.now();
          return s;
        };
        const start = MediaRecorder.prototype.start;
        MediaRecorder.prototype.start = function (this: MediaRecorder, slice?: number) {
          t.recStart = performance.now();
          this.addEventListener("start", () => (t.recOnStart = performance.now()));
          this.addEventListener("dataavailable", (e) => (t.chunks as number[]).push(Math.round(performance.now()) * 1e6 + e.data.size));
          return start.call(this, slice);
        };
        document.addEventListener("visibilitychange", () => (t[`vis-${document.visibilityState}`] = performance.now()));
      });
      let release!: () => void;
      const held = new Promise<void>((r) => (release = r));
      await page.route("**/api/sync/push", async (route) => {
        await held;
        return route.continue().catch(() => {});
      });
      await page.getByRole("button", { name: /^Actions for part A(,|$)/ }).click();
      await page.evaluate(() => ((window as unknown as { __t: Record<string, number> }).__t.tap = performance.now()));
      await page.getByRole("menuitem", { name: "Record a memo on part A" }).click();
      await expect(page.getByTestId("record-panel")).toBeVisible();
      await page.waitForTimeout(2_000);
      const elapsedAtStop = await page.getByTestId("record-elapsed").textContent().catch(() => null);
      await page.evaluate(() => ((window as unknown as { __t: Record<string, number> }).__t.stop = performance.now()));
      await page.getByTestId("record-stop").click();
      const kept = await page
        .getByTestId("memo-play")
        .first()
        .waitFor({ timeout: 3_000 })
        .then(() => true)
        .catch(() => false);
      const notice = await page.getByTestId("memo-notice").allTextContents();
      const t = await page.evaluate(() => (window as unknown as { __t: Record<string, unknown> }).__t);
      const tap = t.tap as number;
      const rel = (k: string) => (typeof t[k] === "number" ? Math.round((t[k] as number) - tap) : null);
      outcomes.push({
        run,
        kept,
        elapsedAtStop,
        notice,
        gumCalled: rel("gumCalled"),
        gumResolved: rel("gumResolved"),
        recStart: rel("recStart"),
        recOnStart: rel("recOnStart"),
        stop: rel("stop"),
        chunks: (t.chunks as number[]).length,
        hidden: rel("vis-hidden"),
      });
      release();
    } finally {
      await trio.close();
    }
  }
  console.log("INV-006 meta-line:", JSON.stringify(outcomes));
  const wrong = (outcomes as { kept: boolean; recOnStart: number | null; stop: number | null; notice: string[] }[]).filter((o) => {
    const ran = o.recOnStart === null || o.stop === null ? 0 : o.stop - o.recOnStart;
    if (ran >= 1_100) return !o.kept;
    if (ran < 900) return o.kept || !o.notice.some((n) => n.startsWith("Too short to keep."));
    return false;
  });
  expect(wrong, "a run disagrees with E11").toEqual([]);
});
