import { describe, expect, it } from "vitest";
import {
  compareRanked,
  rankAtEnd,
  rankAtStart,
  rankBetween,
  rankForMove,
  ranksAtEnd,
  ranksBetween,
  sortByRank,
  type Ranked,
} from "../rank";

const item = (id: string, rank: string): Ranked => ({ id, rank });

describe("rankBetween", () => {
  it("appends and prepends against open ends", () => {
    const first = rankBetween(null, null);
    const after = rankBetween(first, null);
    const before = rankBetween(null, first);
    expect(after > first).toBe(true);
    expect(before < first).toBe(true);
  });

  it("lands strictly between two neighbours", () => {
    const a = rankBetween(null, null);
    const c = rankBetween(a, null);
    const b = rankBetween(a, c);
    expect(a < b && b < c).toBe(true);
  });

  it("can subdivide repeatedly without collapsing", () => {
    // Dragging one column to the same spot over and over must keep working;
    // fractional keys just grow a character rather than needing a reindex.
    let low = rankBetween(null, null);
    const high = rankBetween(low, null);
    for (let i = 0; i < 60; i += 1) {
      const mid = rankBetween(low, high);
      expect(low < mid && mid < high).toBe(true);
      low = mid;
    }
  });
});

describe("batch generation", () => {
  it("returns n distinct keys in order", () => {
    const keys = ranksBetween(null, null, 8);
    expect(keys).toHaveLength(8);
    expect(keys).toEqual([...keys].sort());
    expect(new Set(keys).size).toBe(8);
  });

  it("appends a run after existing items", () => {
    // This is the repeat-expansion path: one tap, many new columns.
    const existing = [item("1", "a0"), item("2", "a1")];
    const keys = ranksAtEnd(existing, 4);
    expect(keys.every((k) => k > "a1")).toBe(true);
    expect(keys).toEqual([...keys].sort());
  });

  it("rejects a nonsense count", () => {
    expect(() => ranksBetween(null, null, -1)).toThrow(RangeError);
    expect(() => ranksBetween(null, null, 1.5)).toThrow(RangeError);
  });
});

describe("end anchors", () => {
  it("do not care whether the input is sorted", () => {
    const shuffled = [item("3", "a3"), item("1", "a1"), item("2", "a2")];
    expect(rankAtEnd(shuffled) > "a3").toBe(true);
    expect(rankAtStart(shuffled) < "a1").toBe(true);
  });

  it("handles an empty collection", () => {
    expect(() => rankAtEnd([])).not.toThrow();
    expect(() => rankAtStart([])).not.toThrow();
  });
});

describe("rankForMove", () => {
  it("returns null when the item is already in place", () => {
    // Skipping the write matters: a pointless write would bump the row's HLC
    // and let a no-op win a merge against someone's real edit.
    const moving = item("m", "a2");
    expect(rankForMove(moving, item("x", "a3"), moving)).toBeNull();
    expect(rankForMove(item("x", "a1"), moving, moving)).toBeNull();
  });

  it("produces a rank between the new neighbours", () => {
    const rank = rankForMove(item("a", "a1"), item("b", "a2"), item("m", "a9"));
    expect(rank).not.toBeNull();
    expect(rank! > "a1" && rank! < "a2").toBe(true);
  });
});

describe("ordering", () => {
  it("falls back to the id when two devices mint the same rank", () => {
    // Both offline, both inserted at the end of the same part. Neither is
    // "wrong" -- what matters is that every replica agrees on the order.
    const a = item("aaa", "a1");
    const b = item("bbb", "a1");
    expect(compareRanked(a, b)).toBe(-1);
    expect(compareRanked(b, a)).toBe(1);
    expect(compareRanked(a, { ...a })).toBe(0);
  });

  it("sorts by codepoint, not locale", () => {
    // 'Z' must precede 'a'. A locale-aware compare would invert this and
    // scramble every fractional key in the app.
    expect(sortByRank([item("1", "a0"), item("2", "Z0")]).map((i) => i.id)).toEqual(["2", "1"]);
  });

  it("does not mutate its input", () => {
    const items = [item("2", "a2"), item("1", "a1")];
    const sorted = sortByRank(items);
    expect(items.map((i) => i.id)).toEqual(["2", "1"]);
    expect(sorted.map((i) => i.id)).toEqual(["1", "2"]);
  });
});
