/**
 * Review probe, INV-003: for every input of `notation-baseline.test.ts` (its 11 Bars shapes × 5 arrangements,
 * rebuilt here exactly as that file builds them) and every short sequence of the INV-002 alphabet, for every bar
 * the click's walk times and every hit in it, `barPositions(pass.events)` gives the tick `notationColumns` gives,
 * less the bar's start. And no timed bar has a position the click does not.
 *
 * The plan names this set; the landed `positions.test.ts` checks only a 14-row hand corpus.
 */
import { describe, expect, it } from "vitest";
import type { DrawnPass } from "@/lib/arrangement/passes";
import type { EventRow } from "@/lib/model";
import { barPositions, notationColumns } from "@/lib/rhythm/notation";
import { bar, ev, group, pass, quarters } from "@/lib/rhythm/__tests__/notation-helpers";

const bars = (k: number, perBar = 4) =>
  Array.from({ length: k }, () => [...Array.from({ length: perBar }, () => ev({})), bar()]).flat();

const BARS: Record<string, () => EventRow[]> = {
  "no barlines": () => quarters(8),
  "trailing barline": () => [...quarters(4), bar()],
  "leading barline": () => [bar(), ...quarters(4)],
  "empty bar in the middle": () => [...quarters(4), bar(), bar(), ...quarters(4)],
  "sixteen bars": () => bars(16),
  "one bar wider than a line": () => quarters(40),
  "a repeat crossing a line": () => [...quarters(3), ev({ repeat: 6, durationHint: "8" }), bar(), ...quarters(4)],
  "no notes": () => [bar()],
  empty: () => [],
  "a triplet": () => [...group("t1", 3, "8"), ev({}), bar(), ...quarters(4)],
  untimed: () => [ev({ durationHint: null }), ev({ durationHint: null }), bar(), ...quarters(2)],
};

const ARR: Record<string, (events: EventRow[]) => DrawnPass[]> = {
  "one part": (e) => [pass(e)],
  "A x4": (e) => [pass(e), pass(e), pass(e), pass(e)],
  "last pass a variant": (e) => [pass(e), pass(e.slice(0, Math.ceil(e.length / 2)))],
  "a sliced pass": (e) => [pass(e.slice(1, Math.max(2, e.length - 1)))],
  "a pass with nothing": (e) => [pass(e), pass([]), pass(e)],
};

/** Returns the number of hits compared; throws on the first disagreement. */
function agree(passes: readonly DrawnPass[], name: string): number {
  const columns = notationColumns(passes);
  let compared = 0;
  passes.forEach((p, index) => {
    const positions = barPositions(p.events);
    const barOf = new Map<string, number>();
    let b = 0;
    for (const e of p.events) {
      if (e.kind === "barline") b++;
      else barOf.set(e.id, b);
    }
    const mine = columns.filter((c) => c.pass === index);
    const start = new Map<number, number>();
    for (const c of mine) {
      const k = barOf.get(c.eventId)!;
      if (!start.has(k) || c.tick < start.get(k)!) start.set(k, c.tick);
    }
    for (const c of mine) {
      const at = positions.get(`${c.eventId}:${c.repetition}`);
      expect(at, `${name} pass ${index} ${c.eventId}:${c.repetition}`).toBeDefined();
      expect(at!.tick, `${name} pass ${index} ${c.eventId}:${c.repetition}`).toBe(c.tick - start.get(barOf.get(c.eventId)!)!);
      compared++;
    }
    // Every bar the click timed: barPositions has exactly its hits there, no more.
    const timedBars = new Set(mine.map((c) => barOf.get(c.eventId)!));
    for (const [key] of positions) {
      const id = key.slice(0, key.lastIndexOf(":"));
      if (timedBars.has(barOf.get(id)!))
        expect(mine.some((c) => `${c.eventId}:${c.repetition}` === key), `${name} pass ${index} extra ${key}`).toBe(true);
    }
  });
  return compared;
}

describe("INV-003: the staff's positions are the click's ticks", () => {
  it("every notation-baseline input × every timed bar × every hit", () => {
    let total = 0;
    for (const [b, makeBars] of Object.entries(BARS))
      for (const [a, makePasses] of Object.entries(ARR)) total += agree(makePasses(makeBars()), `${b} | ${a}`);
    expect(total).toBeGreaterThan(500);
  });

  it("every short sequence of the review alphabet, one pass", () => {
    const tokens = ["8", "16", "q", "r8", "unset", "|", "x3:16", "t3", "p2"];
    const make = (t: string): EventRow[] => {
      if (t === "|") return [bar()];
      if (t === "unset") return [ev({ durationHint: null })];
      if (t === "r8") return [ev({ kind: "rest", frets: {}, durationHint: "8" })];
      if (t === "x3:16") return [ev({ repeat: 3, durationHint: "16" })];
      if (t === "t3") return group(`t${Math.random()}`, 3, "8");
      if (t === "p2") return group(`p${Math.random()}`, 2, "16", { tupletCount: null, groupKind: "plain" });
      return [ev({ durationHint: t as never })];
    };
    let total = 0;
    const go = (prefix: string[]) => {
      if (prefix.length) total += agree([pass(prefix.flatMap(make))], prefix.join(" "));
      if (prefix.length === 4) return;
      for (const t of tokens) go([...prefix, t]);
    };
    go([]);
    expect(total).toBeGreaterThan(10_000);
  });
});
