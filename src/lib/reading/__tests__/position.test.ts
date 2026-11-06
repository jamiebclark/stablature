import { describe, expect, it } from "vitest";
import { bar, ev, pass } from "@/lib/rhythm/__tests__/notation-helpers";
import type { ColumnTick } from "@/lib/rhythm/notation";
import { columnKey as played } from "../played";
import { columnAt, columnKey, FOLLOW_REST_MS, mayFollow, readingStops, stepBar, stepColumn } from "../position";
import { passBars } from "../bars";

const col = (tick: number): ColumnTick => ({ tick, pass: 0, eventId: `e${tick}`, repetition: 0 });

describe("columnKey", () => {
  it("is the text played.ts (and so marks.ts) uses", () => {
    expect(columnKey("abc", 2)).toBe(played("abc", 2));
  });
});

describe("columnAt", () => {
  const cols = [col(0), col(10), col(20)];
  it("last column at or before the tick", () => {
    expect(columnAt(cols, 0)?.tick).toBe(0);
    expect(columnAt(cols, 9.9)?.tick).toBe(0);
    expect(columnAt(cols, 10)?.tick).toBe(10);
    expect(columnAt(cols, 25)?.tick).toBe(20);
  });
  it("null below 0, at or past the length, and when empty", () => {
    expect(columnAt(cols, -1)).toBeNull();
    expect(columnAt(cols, 30, 30)).toBeNull();
    expect(columnAt([], 5)).toBeNull();
  });
});

describe("stops", () => {
  const a = [ev({}), ev({}), bar(), ev({}), ev({})];
  const b = [ev({}), ev({ repeat: 2 })];
  const passes = [pass(a), pass(b)];
  const stops = readingStops(passes, passBars(passes).offset);
  it("skips barlines, unrolls repeats, numbers bars on", () => {
    expect(stops.map((s) => [s.pass, s.bar])).toEqual([[0, 1], [0, 1], [0, 2], [0, 2], [1, 3], [1, 3], [1, 3]]);
  });
  it("stepColumn stops at the ends", () => {
    expect(stepColumn(stops, null, 1)).toBe(stops[0]);
    expect(stepColumn(stops, null, -1)).toBeNull();
    expect(stepColumn(stops, stops[0], -1)).toBe(stops[0]);
    expect(stepColumn(stops, stops[6], 1)).toBe(stops[6]);
    expect(stepColumn(stops, stops[2], 1)).toBe(stops[3]);
  });
  it("stepBar back goes to the bar's start first", () => {
    expect(stepBar(stops, stops[3], -1)).toBe(stops[2]);
    expect(stepBar(stops, stops[2], -1)).toBe(stops[0]);
    expect(stepBar(stops, stops[0], -1)).toBe(stops[0]);
    expect(stepBar(stops, stops[1], 1)).toBe(stops[2]);
    expect(stepBar(stops, stops[5], 1)).toBe(stops[5]);
  });
});

describe("mayFollow", () => {
  it("waits FOLLOW_REST_MS after the reader scrolled", () => {
    expect(mayFollow(null, 0)).toBe(true);
    expect(mayFollow(1000, 1000 + FOLLOW_REST_MS - 1)).toBe(false);
    expect(mayFollow(1000, 1000 + FOLLOW_REST_MS)).toBe(true);
  });
});
