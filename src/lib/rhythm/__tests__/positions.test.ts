/**
 * INV-003: `barPositions` is `readBar`'s own arithmetic, so a column's position in its bar equals the tick
 * `notationColumns` gives it, less the bar's start. Written to fail without the export.
 */
import { describe, expect, it } from "vitest";
import type { EventRow } from "@/lib/model";
import { TICKS_PER_BEAT } from "../durations";
import { barPositions, notationColumns } from "../notation";
import { pass } from "./notation-helpers";
import { parse } from "./rhythm-corpus";

const CORPUS: Record<string, string> = {
  "eighths": "8 8 8 8 8 8 8 8",
  "mixed": "16 16 8 16 8 16",
  "straddle": "8 q 16 16",
  "bars": "8 | 8 8 | 8",
  "triplet": "[3: 8 8 8] 8 8",
  "triplet off the beat": "8 [3: 8 8 8] 8",
  "five": "[5: 16 16 16 16 16]",
  "plain": "[p: 16 16 16 16 16 16 16 16]",
  "plain repeat": "[p: x4:16 8 8]",
  "group edge": "8 [3: 8 8 8] | 8 8",
  "whole half quarter": "w | h h | q q q q",
  "rests": "rw | rh | rq r8 r16 r32",
  "32nds": "8 32 32 16",
  "a repeat": "q x3:8 q",
};

describe("barPositions agrees with notationColumns", () => {
  it.each(Object.entries(CORPUS))("%s", (_name, text) => {
    const events = parse(text);
    const positions = barPositions(events);
    // The start of each bar, in the song's ticks, from the barlines passed.
    const columns = notationColumns([pass(events)]);
    expect(columns.length).toBeGreaterThan(0);
    const starts: number[] = [];
    let bars = 0;
    const barOf: Record<string, number> = {};
    for (const e of events) {
      if (e.kind === "barline") bars++;
      else barOf[e.id] = bars;
    }
    // A bar's start is the first column's tick in that bar, because each bar's first hit is at 0.
    for (const c of columns) {
      const b = barOf[c.eventId];
      if (starts[b] === undefined) starts[b] = c.tick;
    }
    for (const c of columns) {
      const at = positions.get(`${c.eventId}:${c.repetition}`);
      expect(at, `${c.eventId}:${c.repetition}`).toBeDefined();
      expect(at!.tick).toBe(c.tick - starts[barOf[c.eventId]]);
    }
    expect(positions.size).toBe(columns.length);
  });
});

describe("barPositions rows", () => {
  it("q 8 8", () => {
    const e = parse("q 8 8");
    const p = barPositions(e);
    expect([0, 1, 2].map((i) => p.get(`${e[i].id}:0`)?.tick)).toEqual([0, 360360, 540540]);
  });

  it("FR-008: position is known up to the first unset column", () => {
    const e = parse("8 unset 8");
    const p = barPositions(e);
    expect(p.has(`${e[0].id}:0`)).toBe(true);
    expect(p.has(`${e[1].id}:0`)).toBe(false);
    expect(p.has(`${e[2].id}:0`)).toBe(false);
  });

  it("FR-006: a bar after an untimeable bar is still read", () => {
    const e = parse("8 unset | 8 8");
    const p = barPositions(e);
    expect(p.get(`${e[3].id}:0`)?.tick).toBe(0);
    expect(p.get(`${e[4].id}:0`)?.tick).toBe(180180);
  });

  it("a counted triplet reads, with its group id", () => {
    const e = parse("[3: 8 8 8]");
    const p = barPositions(e);
    expect(e.map((x) => p.get(`${x.id}:0`)?.tick)).toEqual([0, 120120, 240240]);
    expect(e.every((x) => p.get(`${x.id}:0`)?.countedGroup === x.tupletId)).toBe(true);
  });

  it("a counted group with a repeat, or one still being built, has no entries", () => {
    for (const text of ["[3: x2:8 8 8] 8 8", "[3: 8 8]"]) {
      const e = parse(text);
      const p = barPositions(e);
      const group = e.filter((x: EventRow) => x.tupletId);
      expect(group.some((x) => p.has(`${x.id}:0`))).toBe(false);
    }
  });

  it("a plain group repeat gives four entries, 90090 apart, uncounted", () => {
    const e = parse("[p: x4:16]");
    const p = barPositions(e);
    expect([0, 1, 2, 3].map((h) => p.get(`${e[0].id}:${h}`)?.tick)).toEqual([0, 90090, 180180, 270270]);
    expect(p.get(`${e[0].id}:0`)?.countedGroup).toBeNull();
    expect(TICKS_PER_BEAT).toBe(360360);
  });
});
