/**
 * Round 4. INV-030: never does a long paste freeze typing or the screen. Its set names "a 5,000-line
 * lyric paste, which is linear, not quadratic".
 *
 * Round 3's lyric paste had no punctuation beside a number, so S5 left it alone. T073 made a line
 * with a digit beside a mark join the block it touches. S5 walks top to bottom and adds one row per
 * pass going up, so lines stacked above a staff take one pass each. Numbered lyric or chord lines
 * are the plain case. The block refuses in the end, so this is a slow refusal, but it runs on the
 * deferred pass of every keystroke in the box.
 *
 * Measured here in round 4: 2,000 lines 592 ms, 4,000 lines 2,499 ms, 5,000 lines 4,240 ms, against
 * 10 ms for the same 5,000 below the staff. No ratio test: it would compare a few milliseconds.
 */
import { describe, expect, it } from "vitest";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const ctx = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };
const STAFF = ["G|---5---|", "D|---5---|", "A|---3---|", "E|---3---|"];

function timed(count: number, line: (n: number) => string, where: "above" | "below") {
  const lines = Array.from({ length: count }, (_, n) => line(n));
  const text = (where === "above" ? [...lines, ...STAFF] : [...STAFF, ...lines]).join("\n");
  const start = performance.now();
  readTab(text, ctx);
  return performance.now() - start;
}

describe("INV-030 lines with a digit beside a mark, stacked against a staff", () => {
  it("5,000 numbered lines above a staff read within the lyric bound", () => {
    const ms = timed(5_000, (n) => `${n + 1}. and on we go`, "above");
    console.log(`5,000 numbered lines above: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(1_000);
  });
  it("5,000 numbered lines below a staff read within the lyric bound", () => {
    const ms = timed(5_000, (n) => `${n + 1}. and on we go`, "below");
    console.log(`5,000 numbered lines below: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(1_000);
  });
});
