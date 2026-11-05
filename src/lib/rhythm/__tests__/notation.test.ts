import { describe, expect, it } from "vitest";
import { DURATIONS, TICKS_PER_BEAT } from "../durations";
import { readNotation } from "../notation";
import { bar, beats, dur, ev, group, pass, quarters } from "./notation-helpers";

const at = (s: ReturnType<typeof readNotation>) => s.clicks.map((c) => [c.tick, c.level]);
const FIT: Record<number, number> = { 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 4, 8: 8, 9: 8, 10: 8, 11: 8, 12: 8, 13: 8, 14: 8, 15: 8, 16: 16 };
const timed = (events: ReturnType<typeof quarters>) => readNotation([pass(events)]).timedFromStart;

describe("readNotation", () => {
  it("reads the worked example", () => {
    const s = readNotation([pass([...quarters(4), bar(), ...group("g", 3, "8"), ev({}), ev({ durationHint: "h" })])]);
    expect(s.lengthTicks).toBe(beats(8));
    expect(at(s)).toEqual([
      [0, "accent"], [beats(1), "beat"], [beats(2), "beat"], [beats(3), "beat"], [beats(4), "accent"],
      [beats(4 + 1 / 3), "soft"], [beats(4 + 2 / 3), "soft"], [beats(5), "beat"], [beats(6), "beat"], [beats(7), "beat"],
    ]);
    expect(s.timedFromStart).toBe(true);
  });

  it("reads five eighths then three quarters", () => {
    const eighths = Array.from({ length: 5 }, () => ev({ durationHint: "8" }));
    const s = readNotation([pass([...eighths, bar(), ...quarters(3)])]);
    expect(s.lengthTicks).toBe(beats(5.5));
    expect(at(s)).toEqual([
      [0, "accent"], [beats(1), "beat"], [beats(2), "beat"],
      [beats(2.5), "accent"], [beats(3.5), "beat"], [beats(4.5), "beat"],
    ]);
  });

  it("handles each counted size and duration", () => {
    for (let size = 2; size <= 16; size++) {
      for (const d of DURATIONS) {
        const s = readNotation([pass(group("g", size, d.id))]);
        const hit = (d.ticks * FIT[size]) / size;
        expect(s.lengthTicks).toBe(hit * size);
        for (let i = 0; i < size; i++) {
          const c = s.clicks.find((x) => x.tick === i * hit);
          expect(c).toBeDefined();
        }
        const ticks = s.clicks.map((c) => c.tick);
        expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
        expect(new Set(ticks).size).toBe(ticks.length);
      }
    }
  });

  it("reads a plain group by its columns' own length, soft on the first hit once", () => {
    const plain = Array.from({ length: 4 }, () => ev({ durationHint: "8", tupletId: "p", tupletCount: null, groupKind: "plain" }));
    const s = readNotation([pass([ev({ durationHint: "8" }), ...plain, ev({ durationHint: "8" })])]);
    expect(at(s).slice(0, 3)).toEqual([[0, "accent"], [beats(0.5), "soft"], [beats(1), "beat"]]);
    expect(s.clicks.filter((c) => c.level === "soft")).toHaveLength(1);
    expect(s.lengthTicks).toBe(beats(3));
  });

  it("counts a repeat as hits", () => {
    const s = readNotation([pass([ev({ repeat: 7, durationHint: "8" }), ev({ durationHint: "8" })])]);
    expect(s.lengthTicks).toBe(beats(4));
    expect(at(s)).toEqual([0, 1, 2, 3].map((b) => [beats(b), b === 0 ? "accent" : "beat"]));
    expect(readNotation([pass([ev({ repeat: 512 })])]).lengthTicks).toBe(512 * TICKS_PER_BEAT);
  });

  it("reads a pickup, and no barlines as one bar", () => {
    expect(at(readNotation([pass([ev({ durationHint: "8" }), bar(), ev({})])]))).toEqual([[0, "accent"], [beats(0.5), "accent"]]);
    expect(readNotation([pass(quarters(8))]).clicks.filter((c) => c.level === "accent")).toHaveLength(1);
  });

  it("ignores trailing and double barlines and empty parts", () => {
    expect(readNotation([pass([...quarters(2), bar(), bar()])]).lengthTicks).toBe(beats(2));
    expect(readNotation([pass([bar(), ...quarters(1), bar(), bar(), ...quarters(1)])]).lengthTicks).toBe(beats(2));
    expect(readNotation([pass([])])).toMatchObject({ lengthTicks: 0, timedFromStart: false });
  });

  it("goes untimed per INV-034", () => {
    expect(timed([ev({ durationHint: null })])).toBe(false);
    expect(timed([ev({ durationHint: "x" as never })])).toBe(false);
    expect(timed(group("g", 3, "8").slice(0, 2))).toBe(false);
    expect(timed([...group("g", 3, "8"), ev({ durationHint: null })])).toBe(false);
    expect(timed(group("g", 3, "8", { repeat: 2 }))).toBe(false);
    expect(timed(group("g", 17, "8"))).toBe(false);
    expect(timed([...group("g", 2, "8"), ...group("g", 1, "8", { groupKind: "plain", tupletCount: null })])).toBe(false);
    expect(timed([...group("g", 2, "8"), ...group("g", 1, "8", { tupletCount: 5 })])).toBe(false);
    expect(timed(group("g", 3, "8", { groupKind: null, tupletCount: null }))).toBe(true);
  });

  it("times a group split over a barline only when it adds up", () => {
    const g = group("g", 4, "8");
    expect(readNotation([pass([g[0], g[1], bar(), g[2], g[3]])]).timedFromStart).toBe(true);
    expect(readNotation([pass([g[0], g[1], bar(), g[2]])]).timedFromStart).toBe(false);
  });

  it("ends at the first untimed bar and keeps earlier bars", () => {
    const s = readNotation([pass([...quarters(4), bar(), ev({ durationHint: null })])]);
    expect(s.lengthTicks).toBe(beats(4));
    expect(s.timedFromStart).toBe(true);
    expect(timed([ev({ durationHint: null }), bar(), ...quarters(4)])).toBe(false);
  });

  it("is independent of earlier bars (metamorphic)", () => {
    const a = [ev({ durationHint: "8" }), ev({ durationHint: "h" })];
    const rel = (s: ReturnType<typeof readNotation>, from: number, to: number) =>
      s.clicks.filter((c) => c.tick >= from && c.tick < to).map((c) => [c.tick - from, c.level]);
    const s1 = readNotation([pass([...a, bar(), ...quarters(3)])]);
    const s2 = readNotation([pass([...quarters(3), bar(), ...a])]);
    expect(rel(s1, 0, beats(2.5))).toEqual(rel(s2, beats(3), beats(5.5)));
    expect(dur("q")).toBe(TICKS_PER_BEAT);
  });

  it("keeps a repeat inside a plain group timed, and a bar never joins the next pass", () => {
    const g = group("g", 2, "8", { groupKind: "plain", tupletCount: null, repeat: 2 });
    expect(readNotation([pass(g)]).lengthTicks).toBe(beats(2));
    const s = readNotation([pass([ev({})]), pass([ev({})])]);
    expect(s.clicks.filter((c) => c.level === "accent")).toHaveLength(2);
  });
});
