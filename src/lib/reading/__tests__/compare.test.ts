/**
 * INV-019/020/021/024/026: the worked examples of contracts/compare.md, and that ops account for both parts.
 */
import { describe, expect, it } from "vitest";
import type { EventRow, PartRow } from "@/lib/model";
import { compareParts, compareVariants, type Op } from "@/lib/reading/compare";
import { playedColumns } from "@/lib/reading/played";
import { staffMarks } from "@/lib/reading/marks";
import { layoutPart } from "@/lib/tab/layout";
import { TUNING_PRESETS } from "@/lib/tunings";
import { events, input, part } from "./compare-helpers";

const tuning = TUNING_PRESETS[0];
const strings = tuning.strings.length;
const cmp = (a: string, b: string) => compareParts(input("a", a), input("b", b), strings);
const changes = (ops: Op[]) => ops.filter((o) => o.kind !== "same");
const lineOf = (a: string, b: string) => {
  const variant = events(b);
  const comparison = compareParts(input("a", a), input("b", variant), strings);
  return staffMarks(comparison, { events: variant, fromBar: null, toBar: null, density: "expanded" }).line;
};

describe("worked examples", () => {
  const P = "5 7 8 | 5 7 8";
  it.each([
    [P, "Same as A"],
    ["5 7 9 8 | 5 7 8", "Differs from A in bar 1: 1 added"],
    ["5 7 9 | 5 7 8", "Differs from A in bar 1: 1 changed"],
    ["5 7 | 5 7 8", "Differs from A in bar 1: 1 removed"],
    ["5 7 8 5 7 8", "Differs from A in bar 1: 1 removed"],
    ["5 7 8 | 5 7 9 10", "Differs from A in bar 2: 1 changed, 1 added"],
  ])("%s", (variant, expected) => {
    expect(lineOf(P, variant)).toBe(expected);
  });

  it("exact cases", () => {
    expect(changes(cmp("7x8", "7x4 7x4").ops)).toEqual([]);
    expect(changes(cmp("7x8", "7x6").ops).map((o) => o.kind)).toEqual(["removed", "removed"]);
    expect(changes(cmp("a b c d e", "e f g h i").ops).map((o) => o.kind)).toEqual(Array(5).fill("changed"));
    expect(changes(cmp("[a b c]", "[b c]").ops).map((o) => o.kind)).toEqual(["removed"]);
    expect(changes(cmp("[a b c]", "[a] n [b c]").ops).map((o) => o.kind)).toEqual(["added"]);
    const grouped = changes(cmp("[a b][c d]", "[a b c d]").ops);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ kind: "changed", words: "group changed" });
    expect(changes(cmp("", "").ops)).toEqual([]);
    expect(changes(cmp("", "5 7").ops).map((o) => o.kind)).toEqual(["added", "added"]);
    expect(changes(cmp("5 7", "").ops)).toEqual([
      { kind: "removed", from: 0, bar: 1, before: null },
      { kind: "removed", from: 1, bar: 1, before: null },
    ]);
  });

  it("words", () => {
    expect((changes(cmp("5", "7").ops)[0] as { words: string }).words).toBe("fret 5 to fret 7 on string 1");
  });
});

describe("ops", () => {
  it("cover both parts once, in order", () => {
    const n = (s: string) => events(s).reduce((t, e) => t + Math.max(1, e.repeat), 0);
    for (const [a, b] of [["5 7 8 | 5", "5 | 7 8 9 9"], ["", "5"], ["5", ""], ["a b c", "c b a"]]) {
      const ops = cmp(a, b).ops;
      expect(ops.flatMap((o) => ("from" in o ? [o.from] : []))).toEqual(Array.from({ length: n(a) }, (_, i) => i));
      expect(ops.flatMap((o) => ("to" in o ? [o.to] : []))).toEqual(Array.from({ length: n(b) }, (_, i) => i));
    }
  });

  it("ignores frets the tuning lacks and techniques on unplayed strings", () => {
    const noisy = events("5").map((e) => ({ ...e, frets: { ...e.frets, "9": 3 }, techniques: { "3": ["bend"] } }));
    expect(changes(compareParts(input("a", "5"), input("b", noisy as EventRow[]), strings).ops)).toEqual([]);
  });

  it("each of fret, technique, duration, kind and group counts as one change", () => {
    const one = (mutate: (e: EventRow) => EventRow) => {
      const parent = events("5 7");
      const variant = parent.map((e, i) => (i === 0 ? mutate({ ...e }) : { ...e }));
      const found = changes(compareParts(input("a", parent), input("b", variant), strings).ops);
      // The signature and the words read the same fields, so a change always has something to say.
      for (const op of found) if (op.kind === "changed") expect(op.words).not.toBe("");
      return found;
    };
    expect(one((e) => ({ ...e, frets: { "0": 6 } }))).toHaveLength(1);
    expect(one((e) => ({ ...e, techniques: { "0": ["bend"] } }))).toHaveLength(1);
    expect(one((e) => ({ ...e, durationHint: "q" }) as EventRow)).toHaveLength(1);
    expect(one((e) => ({ ...e, kind: "rest", frets: {} }) as EventRow)).toHaveLength(1);
    expect(one((e) => ({ ...e, tupletId: "t", tupletCount: 3 }))).toHaveLength(1);
  });

  it("a chord counts, and a blank one does not", () => {
    const parent = events("5 7");
    const copy = () => parent.map((e) => ({ ...e }));
    const note = (value: string) => [{ kind: "chord", anchorEventId: parent[0].id, value }] as never;
    expect(changes(compareParts(input("a", parent), input("b", copy(), note(" ")), strings).ops)).toEqual([]);
    expect(changes(compareParts(input("a", parent), input("b", copy(), note("Am")), strings).ops)).toHaveLength(1);
  });
});

describe("compareVariants", () => {
  const A = part("a", "A");
  const content = (parts: ReturnType<typeof part>[], by: Record<string, EventRow[]>) =>
    ({ parts, eventsByPart: by, annotationsByPart: {} }) as never;
  it("is keyed by exactly the parts with a live declared parent", () => {
    const evs = events("5 7");
    const c = content(
      [A, part("b", "B", "a"), part("c", "C", "c"), part("d", "D", "gone"), part("e", "E", null)],
      { a: evs, b: evs, c: evs, d: evs, e: evs },
    );
    expect([...compareVariants(c, tuning).keys()]).toEqual(["b"]);
  });
  it("matches layoutPart's unrolling, keys, order and bars", () => {
    const evs = events("5x3 | 7 | 8x2");
    const layout = layoutPart({ events: evs, tuning, annotations: [], density: "expanded" });
    const played = playedColumns(evs, [], strings, () => 0);
    expect(played.map((p) => [p.eventId, p.repetition, p.bar])).toEqual(
      layout.columns.map((c) => [c.eventId, c.repetition, c.barNumber]),
    );
  });
  it("finds a pasted copy equal to its parent", () => {
    const evs = events("5 7 | 8");
    const c = content([A, part("b", "B", "a")], { a: evs, b: evs.map((e) => ({ ...e, id: `z${e.id}` })) });
    expect(changes(compareVariants(c, tuning).get("b")!.ops)).toEqual([]);
  });
});

describe("INV-021 an edit beside an equal column reports itself (review F2)", () => {
  let serial = 0;
  const col = (fret: number, over: Partial<EventRow> = {}) =>
    ({ id: `c${++serial}`, kind: "notes", frets: { "0": fret }, techniques: {}, repeat: 1, durationHint: null, tupletId: null, tupletCount: null, groupKind: null, ...over }) as unknown as EventRow;
  const grouped = (group: string, ...frets: number[]) => frets.map((f) => col(f, { tupletId: group, tupletCount: 3, groupKind: "tuplet" }));
  const P = { id: "p", label: "A" } as PartRow;
  const V = { id: "v", label: "B" } as PartRow;
  const line = (a: readonly EventRow[], b: readonly EventRow[]) =>
    staffMarks(compareParts({ part: P, events: a, annotations: [] }, { part: V, events: b, annotations: [] }, strings), {
      events: b, fromBar: null, toBar: null, density: "expanded",
    }).line;
  const triplets = () => [...grouped("g1", 7, 7, 7), ...grouped("g2", 7, 7, 7)];

  it("removing one note of a run of triplets of one note", () => {
    const parent = triplets();
    expect(line(parent, parent.filter((_, i) => i !== 2))).toBe("Differs from A in bar 1: 1 removed");
  });
  it("removing the first note of the second triplet", () => {
    const parent = triplets();
    expect(line(parent, parent.filter((_, i) => i !== 3))).toBe("Differs from A in bar 1: 1 removed");
  });
  it("adding a note to the first triplet", () => {
    const parent = triplets();
    const variant = [...parent.slice(0, 3), col(7, { tupletId: "g1", tupletCount: 3, groupKind: "tuplet" }), ...parent.slice(3)];
    expect(line(parent, variant)).toBe("Differs from A in bar 1: 1 added");
  });
  it("adding a note between the two triplets", () => {
    const parent = triplets();
    expect(line(parent, [...parent.slice(0, 3), col(7), ...parent.slice(3)])).toBe("Differs from A in bar 1: 1 added");
  });
  it("removing a note of a two-note figure across two groups", () => {
    const parent = [...grouped("a", 5, 7), ...grouped("b", 5, 7), ...grouped("c", 5, 7)];
    expect(line(parent, [...parent.slice(0, 2), ...parent.slice(3)])).toBe("Differs from A in bar 1: 1 removed");
  });
  it("removing a whole triplet leaves the other unmarked", () => {
    const parent = triplets();
    expect(line(parent, parent.slice(3))).toBe("Differs from A in bar 1: 3 removed");
  });
});
