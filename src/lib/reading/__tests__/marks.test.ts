/**
 * INV-027/028/035: marks and the line come from one op list; compact folds; words are exact.
 */
import { describe, expect, it } from "vitest";
import { compareParts } from "@/lib/reading/compare";
import { staffMarks, type StaffMarks } from "@/lib/reading/marks";
import { TUNING_PRESETS } from "@/lib/tunings";
import { events, input } from "./compare-helpers";
import { eventsInBars, type Density } from "@/lib/tab/layout";
import { type EventRow, type PartRow } from "@/lib/model";
import { type Op } from "@/lib/reading/compare";
import { countBars } from "@/lib/tab/layout";

const strings = TUNING_PRESETS[0].strings.length;
const marks = (a: string, b: string, density: Density = "expanded", from: number | null = null, to: number | null = null): StaffMarks => {
  const variant = events(b);
  const comparison = compareParts(input("a", a), input("b", variant), strings);
  return staffMarks(comparison, { events: eventsInBars(variant, from, to), fromBar: from, toBar: to, density });
};

describe("staffMarks", () => {
  it("marks changed and added columns and counts the same ops in the line", () => {
    const m = marks("5 7 8", "5 9 8 4");
    expect([...m.columns.values()].map((c) => c.status)).toEqual(["changed", "added"]);
    expect(m.line).toBe("Differs from A in bar 1: 1 changed, 1 added");
    expect(m.any).toBe(true);
  });

  it("draws a removal before the next column, or at the end", () => {
    const m = marks("5 7 8", "5 8");
    expect(m.removals.size).toBe(1);
    expect(m.removedAtEnd).toBe(0);
    const end = marks("5 7 8", "5 7");
    expect(end.removedAtEnd).toBe(1);
    expect(marks("5 7", "5 7").any).toBe(false);
  });

  it("two removals in one gap add up", () => {
    const m = marks("5 7 8 9", "5 9");
    expect([...m.removals.values()]).toEqual([2]);
  });

  it("compact folds repetitions: + when all are added, * otherwise", () => {
    expect([...marks("5", "5 7x4", "compact").columns.values()][0]).toMatchObject({ status: "added", count: 4, total: 4 });
    const some = [...marks("7x8", "7x5 9x3", "compact").columns.values()];
    expect(some.every((c) => c.status === "changed")).toBe(true);
  });

  it("counts do not depend on density", () => {
    expect(marks("7x8", "7x6 9x2", "compact").line).toBe(marks("7x8", "7x6 9x2", "expanded").line);
  });

  it("limits to the bars drawn and names the part's own bars", () => {
    const parent = "5 | 6 | 7 | 8";
    const variant = "5 | 6 | 9 | 8";
    expect(marks(parent, variant, "expanded", 3, 4).line).toBe("Differs from A in bar 3: 1 changed, in these bars only");
    expect(marks(parent, variant, "expanded", 1, 2).line).toBe("Same as A in these bars");
  });

  it("names runs of bars", () => {
    const p = "1 | 2 | 3 | 4 | 5 | 6 | 7 | 8";
    const v = "9 | 9 | 9 | 9 | 5 | 6 | 7 | 9";
    expect(marks(p, v).line).toBe("Differs from A in bars 1–4 and 8: 5 changed");
    expect(marks("1 | 2 | 3", "9 | 2 | 9").line).toBe("Differs from A in bars 1 and 3: 2 changed");
  });
});

describe("staffMarks over a drawn slice (INV-029/030)", () => {
  const parent = "1 2 | 3 4 | 5 6";
  const edges: Array<[number | null, number | null]> = [[1, 1], [2, 2], [3, 3], [1, 2], [2, 3], [3, 9], [null, null]];

  it("marks only the drawn bars and names the part's own bar numbers", () => {
    const v = "1 9 | 3 9 | 9 6";
    expect(marks(parent, v, "expanded", 2, 2).line).toBe("Differs from A in bar 2: 1 changed, in these bars only");
    expect(marks(parent, v, "expanded", 3, 3).line).toBe("Differs from A in bar 3: 1 changed, in these bars only");
    expect(marks(parent, v, "expanded", 1, 1).columns.size).toBe(1);
  });

  it("a slice with no differences says so in these bars", () => {
    expect(marks(parent, "1 9 | 3 4 | 5 6", "expanded", 2, 3).line).toBe("Same as A in these bars");
  });

  it("removals over covering slices sum to the whole", () => {
    const v = "1 | 3 | 5";
    const total = (m: StaffMarks) => [...m.removals.values()].reduce((x, y) => x + y, 0) + m.removedAtEnd;
    const whole = total(marks(parent, v));
    const parts = [1, 2, 3].map((b) => total(marks(parent, v, "expanded", b, b)));
    expect(parts.reduce((x, y) => x + y, 0)).toBe(whole);
  });

  it("never throws at any slice edge, even past the end", () => {
    for (const [from, to] of edges) {
      for (const v of ["1 2 | 3 4 | 5 6 7", "9 | 3 4", "1 2 | 3 4 | 5 6 |"]) {
        expect(() => marks(parent, v, "expanded", from, to)).not.toThrow();
      }
    }
  });
});

describe("review probe INV-027-028-029-marks.test.ts", { timeout: 300_000 }, () => {
  const strings = TUNING_PRESETS[0].strings.length;
  let serial = 0;
  const col = (fret: number, repeat = 1) =>
    ({ id: `m${++serial}`, kind: "notes", frets: { "0": fret }, techniques: {}, repeat, durationHint: null, tupletId: null, tupletCount: null, groupKind: null }) as unknown as EventRow;
  const bar = () => ({ ...col(0), kind: "barline", frets: {} }) as EventRow;
  const P = { id: "p", label: "A" } as PartRow;
  const V = { id: "v", label: "B" } as PartRow;
  const compare = (a: readonly EventRow[], b: readonly EventRow[]) =>
    compareParts({ part: P, events: a, annotations: [] }, { part: V, events: b, annotations: [] }, strings);
  /** `5 7 | 8x3`, for the cases that read better as text. */
  const parts = (text: string) =>
    text.split(" ").filter(Boolean).map((token) => {
      if (token === "|") return bar();
      const [fret, times] = token.split("x");
      return col(Number(fret), times ? Number(times) : 1);
    });
  const seeded = (seed: number) => {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 2 ** 32;
    };
  };
  
  /** Each variant column as the layout numbers it, walked here. */
  function columnsOf(events: readonly EventRow[]) {
    const out: { id: string; rep: number; bar: number; kind: string }[] = [];
    let number = 1;
    for (const e of events) {
      if (e.kind === "barline") {
        out.push({ id: e.id, rep: 0, bar: number, kind: "barline" });
        number += 1;
        continue;
      }
      for (let r = 0; r < Math.max(1, e.repeat); r += 1) out.push({ id: e.id, rep: r, bar: number, kind: e.kind });
    }
    return out;
  }
  
  /** What should be kept on a slice, from the ops' kinds and positions only. */
  function oracle(ops: readonly Op[], variant: readonly EventRow[], drawn: readonly EventRow[], from: number | null, to: number | null) {
    const columns = columnsOf(variant);
    const held = new Set(drawn.map((e) => e.id));
    const first = from ?? 1;
    const last = to ?? Infinity;
    let changed = 0;
    let added = 0;
    let removed = 0;
    const bars = new Set<number>();
    ops.forEach((op, index) => {
      if (op.kind === "same") return;
      if (op.kind === "removed") {
        const next = ops.slice(index + 1).find((o) => o.kind !== "removed") as { to: number } | undefined;
        const at = next ? columns[next.to].bar : columns.length ? columns[columns.length - 1].bar : 1;
        if (at < first || at > last) return;
        removed += 1;
        bars.add(at);
        return;
      }
      const column = columns[op.to];
      if (!held.has(column.id)) return;
      if (op.kind === "changed") changed += 1;
      else added += 1;
      bars.add(column.bar);
    });
    return { changed, added, removed, bars };
  }
  
  const numbers = (line: string) => ({
    changed: Number(/(\d+) changed/.exec(line)?.[1] ?? 0),
    added: Number(/(\d+) added/.exec(line)?.[1] ?? 0),
    removed: Number(/(\d+) removed/.exec(line)?.[1] ?? 0),
  });
  const barsIn = (line: string) => {
    const m = /in bars? ([^:]+):/.exec(line);
    if (!m) return new Set<number>();
    const out = new Set<number>();
    for (const piece of m[1].split(/, | and /)) {
      const [a, b] = piece.split("–").map(Number);
      for (let n = a; n <= (b ?? a); n += 1) out.add(n);
    }
    return out;
  };
  const gaps = (m: StaffMarks) => [...m.removals.values()].reduce((x, y) => x + y, 0) + m.removedAtEnd;
  
  function randomPart(next: () => number) {
    const out: EventRow[] = [];
    const bars = 1 + Math.floor(next() * 5);
    for (let b = 0; b < bars; b += 1) {
      const length = 1 + Math.floor(next() * 3);
      for (let i = 0; i < length; i += 1) out.push(col(1 + Math.floor(next() * 5), next() < 0.2 ? 2 + Math.floor(next() * 3) : 1));
      if (b < bars - 1 || next() < 0.3) out.push(bar());
    }
    return out;
  }
  function randomEdit(parent: readonly EventRow[], next: () => number) {
    const out = parent.map((e) => ({ ...e, id: `${e.id}'` }));
    const edits = 1 + Math.floor(next() * 3);
    for (let n = 0; n < edits; n += 1) {
      const at = Math.floor(next() * (out.length + 1));
      const roll = next();
      if (roll < 0.3) out.splice(at, 0, col(10 + Math.floor(next() * 5)));
      else if (roll < 0.4) out.splice(at, 0, bar());
      else if (roll < 0.7 && out.length > 1) out.splice(Math.min(at, out.length - 1), 1);
      else if (out[at] && out[at].kind === "notes") out[at] = { ...out[at], frets: { "0": 20 } };
    }
    return out;
  }
  
  describe("INV-027/029 over random parts and every slice", () => {
    it("keeps exactly what the slice draws, counts exactly that, and names the part's own bars", () => {
      const next = seeded(29);
      const wrong: string[] = [];
      let slices = 0;
      for (let n = 0; n < 1500; n += 1) {
        const parent = randomPart(next);
        const variant = randomEdit(parent, next);
        const { ops } = compare(parent, variant);
        const count = countBars(variant) + 1;
        const ranges: [number | null, number | null][] = [[null, null]];
        for (let from = 1; from <= count + 1; from += 1) {
          ranges.push([from, null], [null, from]);
          for (let to = from; to <= count + 1; to += 1) ranges.push([from, to]);
        }
        for (const [from, to] of ranges) {
          slices += 1;
          const drawn = eventsInBars(variant, from, to);
          const marks = staffMarks({ parent: P, ops, coarse: false }, { events: drawn, fromBar: from, toBar: to, density: "expanded" });
          const want = oracle(ops, variant, drawn, from, to);
          const got = numbers(marks.line);
          const label = `${JSON.stringify([from, to])} ${marks.line}`;
          if (got.changed !== want.changed || got.added !== want.added || got.removed !== want.removed) wrong.push(`counts: ${label}, want ${JSON.stringify({ ...want, bars: [...want.bars] })}`);
          if (marks.columns.size !== want.changed + want.added) wrong.push(`columns ${marks.columns.size}: ${label}`);
          if (gaps(marks) !== want.removed) wrong.push(`gaps ${gaps(marks)}: ${label}`);
          const named = barsIn(marks.line);
          if ([...named].sort().join() !== [...want.bars].sort().join()) wrong.push(`bars: ${label}, want ${[...want.bars]}`);
          const keys = new Set(columnsOf(drawn).map((c) => `${c.id}-${c.rep}`));
          for (const key of [...marks.columns.keys(), ...marks.removals.keys()]) if (!keys.has(key)) wrong.push(`mark off the staff: ${key}`);
          const sliced = from !== null || to !== null;
          if (sliced && want.changed + want.added + want.removed > 0 && !marks.line.endsWith(", in these bars only")) wrong.push(`wording: ${label}`);
          if (sliced && want.changed + want.added + want.removed === 0 && marks.line !== "Same as A in these bars") wrong.push(`wording: ${label}`);
          if (!sliced && want.changed + want.added + want.removed === 0 && marks.line !== "Same as A") wrong.push(`wording: ${label}`);
          if (marks.any !== (marks.columns.size > 0 || gaps(marks) > 0)) wrong.push(`any: ${label}`);
        }
      }
      expect(slices).toBeGreaterThan(20_000);
      expect(wrong.slice(0, 10)).toEqual([]);
    });
  
    it("removals over one-bar slices sum to the whole", () => {
      const next = seeded(30);
      const wrong: string[] = [];
      for (let n = 0; n < 3000; n += 1) {
        const parent = randomPart(next);
        const variant = randomEdit(parent, next);
        const { ops } = compare(parent, variant);
        const whole = ops.filter((o) => o.kind === "removed").length;
        let sum = 0;
        // Through the last barline's bar, not `countBars`: a variant ending `| |` has an empty bar that still
        // holds a removal. The arrangement's own range stops at `countBars`; see the review's follow-ups.
        for (let b = 1; b <= Math.max(1, ...columnsOf(variant).map((c) => c.bar)); b += 1) {
          sum += gaps(staffMarks({ parent: P, ops, coarse: false }, { events: eventsInBars(variant, b, b), fromBar: b, toBar: b, density: "expanded" }));
        }
        if (sum !== whole) wrong.push(`${sum} of ${whole}: ${parent.map((e) => (e.kind === "barline" ? "|" : e.frets["0"])).join(" ")} -> ${variant.map((e) => (e.kind === "barline" ? "|" : e.frets["0"])).join(" ")}`);
      }
      expect(wrong.slice(0, 8)).toEqual([]);
    });
  });
  
  describe("INV-029 the named edges", () => {
    const line = (a: string, b: string, from: number | null, to: number | null) => {
      const variant = parts(b);
      return staffMarks(compare(parts(a), variant), { events: eventsInBars(variant, from, to), fromBar: from, toBar: to, density: "expanded" });
    };
    it("a removal just before a slice's closing barline stays on that slice", () => {
      const m = line("1 2 | 3 4 | 5 6", "1 2 | 3 | 5 6", 2, 2);
      expect(m.line).toBe("Differs from A in bar 2: 1 removed, in these bars only");
      expect(m.removedAtEnd).toBe(1);
    });
    it("a removal just after a closing barline belongs to the next bar", () => {
      expect(line("1 2 | 3 4 | 5 6", "1 2 | 4 | 5 6", 2, 2).line).toBe("Differs from A in bar 2: 1 removed, in these bars only");
      expect(line("1 2 | 3 4 | 5 6", "1 2 | 4 | 5 6", 1, 1).line).toBe("Same as A in these bars");
    });
    it("a removal at the very end belongs to the pass holding the last column", () => {
      const m = line("1 | 2 | 3", "1 | 2", 2, 2);
      expect(m.line).toBe("Differs from A in bar 2: 2 removed, in these bars only");
      expect(m.removedAtEnd).toBe(2);
      expect(line("1 | 2 | 3", "1 | 2", 1, 1).line).toBe("Same as A in these bars");
    });
    it("an added barline closing the slice is not counted, because it is not drawn", () => {
      const m = line("1 2 3", "1 | 2 3", 1, 1);
      expect(m.line).toBe("Same as A in these bars");
      expect(m.any).toBe(false);
    });
    it("a range past the end is the same in those bars", () => {
      expect(line("1 | 2", "1 | 9", 5, 9).line).toBe("Same as A in these bars");
      expect(line("1 | 2", "1 | 9", 2, 9).line).toBe("Differs from A in bar 2: 1 changed, in these bars only");
    });
  });
  
  describe("INV-028 density never changes what is counted", () => {
    const both = (a: string, b: string) => {
      const variant = parts(b);
      const comparison = compare(parts(a), variant);
      const of = (density: Density) => staffMarks(comparison, { events: variant, fromBar: null, toBar: null, density });
      return { expanded: of("expanded"), compact: of("compact"), variant };
    };
    const statuses = (m: StaffMarks) => [...m.columns.values()].map((c) => c.status);
  
    it("all repetitions added", () => {
      const { expanded, compact } = both("5", "5 7x4");
      expect(compact.line).toBe(expanded.line);
      expect(statuses(compact)).toEqual(["added"]);
      expect(expanded.columns.size).toBe(4);
    });
    it("one of 8 changed", () => {
      const { expanded, compact } = both("7x8", "7x3 9 7x4");
      expect(compact.line).toBe(expanded.line);
      expect(statuses(compact)).toEqual(["changed"]);
    });
    it("some added and some same", () => {
      const { expanded, compact } = both("7x2", "7x5");
      expect(expanded.line).toBe("Differs from A in bar 1: 3 added");
      expect(compact.line).toBe(expanded.line);
      expect(statuses(compact)).toEqual(["changed"]);
      expect([...compact.columns.values()][0]).toMatchObject({ count: 3, total: 5 });
    });
    it("a removal inside a repeat moves to before it", () => {
      const parent = "5 7x4 9";
      const variant = "5 7 7 7 9";
      const out = both(parent, variant);
      expect(out.compact.line).toBe(out.expanded.line);
      expect(gaps(out.compact)).toBe(gaps(out.expanded));
      const repeated = both("7x8 9", "7x6 8 9");
      expect(repeated.compact.line).toBe(repeated.expanded.line);
      expect(gaps(repeated.compact)).toBe(gaps(repeated.expanded));
    });
    it("two removals landing in one gap add up", () => {
      const { compact, expanded, variant } = both("5 6 7 8 9x3", "5 9x3");
      expect([...compact.removals.values()]).toEqual([3]);
      expect([...compact.removals.keys()]).toEqual([`${variant[1].id}-0`]);
      expect(compact.line).toBe(expanded.line);
    });
    it("over random parts, counts and bars are the same in both", () => {
      const next = seeded(28);
      for (let n = 0; n < 4000; n += 1) {
        const parent = randomPart(next);
        const variant = randomEdit(parent, next);
        const comparison = compare(parent, variant);
        const of = (density: Density) => staffMarks(comparison, { events: variant, fromBar: null, toBar: null, density });
        const compact = of("compact");
        const expanded = of("expanded");
        expect(compact.line).toBe(expanded.line);
        expect(gaps(compact)).toBe(gaps(expanded));
        for (const [key, mark] of compact.columns) {
          const id = key.replace(/-\d+$/, "");
          const inExpanded = [...expanded.columns.entries()].filter(([k]) => k.replace(/-\d+$/, "") === id).map(([, m]) => m.status);
          const total = Math.max(1, variant.find((e) => e.id === id)!.repeat);
          const all = inExpanded.length === total && inExpanded.every((s) => s === "added");
          expect(mark.status).toBe(all ? "added" : "changed");
        }
        for (const key of expanded.columns.keys()) expect(compact.columns.has(key.replace(/-\d+$/, "-0"))).toBe(true);
      }
    });
  });
});
