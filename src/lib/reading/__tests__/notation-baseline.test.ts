/**
 * INV-036: `readNotation` gives the same output it gave before the usability pass, for every Bars shape in
 * every Arr arrangement, at tempos 40, 120 and 300. The baseline was recorded from UNEDITED `notation.ts`
 * (T007) with `RECORD_NOTATION_BASELINE=1 npx vitest run <this file>`; it is a hold-the-line probe and passes
 * on the pre-change tree by design. Prove it can fail: change one level in `notation.ts`, see it fail, revert.
 * `readNotation` takes no tempo, so the tempos only scale the ticks to milliseconds.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TICKS_PER_BEAT } from "@/lib/rhythm/durations";
import { readNotation } from "@/lib/rhythm/notation";
import { bar, ev, group, pass, quarters } from "@/lib/rhythm/__tests__/notation-helpers";

const TEMPOS = [40, 120, 300];
const PATH = new URL("./notation-baseline.json", import.meta.url);

const bars = (k: number, perBar = 4) => Array.from({ length: k }, () => [...Array.from({ length: perBar }, () => ev({})), bar()]).flat();

const BARS: Record<string, () => ReturnType<typeof quarters>> = {
  "no barlines": () => quarters(8),
  "trailing barline": () => [...quarters(4), bar()],
  "leading barline": () => [bar(), ...quarters(4)],
  "empty bar in the middle": () => [...quarters(4), bar(), bar(), ...quarters(4)],
  "sixteen bars": () => bars(16),
  "one bar wider than a line": () => quarters(40),
  "a repeat crossing a line": () => [...quarters(3), ev({ repeat: 6, durationHint: "8" }), bar(), ...quarters(4)],
  "no notes": () => [bar()],
  "empty": () => [],
  "a triplet": () => [...group("t1", 3, "8"), ev({}), bar(), ...quarters(4)],
  "untimed": () => [ev({ durationHint: null }), ev({ durationHint: null }), bar(), ...quarters(2)],
};

const ARR: Record<string, (events: ReturnType<typeof quarters>) => ReturnType<typeof pass>[]> = {
  "one part": (e) => [pass(e)],
  "A x4": (e) => [pass(e), pass(e), pass(e), pass(e)],
  "last pass a variant": (e) => [pass(e), pass(e.slice(0, Math.ceil(e.length / 2)))],
  "a sliced pass": (e) => [pass(e.slice(1, Math.max(2, e.length - 1)))],
  "a pass with nothing": (e) => [pass(e), pass([]), pass(e)],
};

function record() {
  const out: Record<string, unknown> = {};
  for (const [b, makeBars] of Object.entries(BARS)) {
    for (const [a, makePasses] of Object.entries(ARR)) {
      const score = readNotation(makePasses(makeBars()));
      const times: Record<string, number[]> = {};
      for (const t of TEMPOS) times[t] = score.clicks.map((c) => Math.round(((c.tick * 60000) / (t * TICKS_PER_BEAT)) * 1000) / 1000);
      out[`${b} | ${a}`] = {
        clicks: score.clicks.map((c) => [c.tick, c.level]),
        lengthTicks: score.lengthTicks,
        timedFromStart: score.timedFromStart,
        times,
      };
    }
  }
  return out;
}

describe("readNotation is unchanged (INV-036)", () => {
  it("matches the baseline recorded from unedited code", () => {
    const now = record();
    if (process.env.RECORD_NOTATION_BASELINE) {
      writeFileSync(PATH, JSON.stringify(now, null, 1) + "\n");
      return;
    }
    const baseline = JSON.parse(readFileSync(PATH, "utf8"));
    expect(Object.keys(baseline).length).toBe(Object.keys(BARS).length * Object.keys(ARR).length);
    expect(now).toEqual(baseline);
  });
});
