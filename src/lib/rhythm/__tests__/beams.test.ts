/**
 * INV-002 and INV-019: the FR-036 corpus of contracts/beaming.md, against a HAND table of runs and flags
 * (never a second implementation). Starts are in beats from the bar start. Indices count layout columns,
 * and a barline is a column.
 */
import { describe, expect, it } from "vitest";
import type { Density } from "@/lib/tab/layout";
import { tupletSpans } from "@/lib/tab/layout";
import { groupLabels, rhythmMarks, type RhythmMark } from "../beams";
import { barPositions } from "../notation";
import { layoutOf, parse } from "./rhythm-corpus";

function marksFor(text: string, density: Density = "expanded") {
  const events = parse(text);
  const layout = layoutOf(events, density);
  return { events, layout, marks: rhythmMarks(layout.columns, barPositions(events), density) };
}

/** Runs of joined columns, as index lists. */
function runs(marks: RhythmMark[]): number[][] {
  const out: number[][] = [];
  marks.forEach((m, i) => {
    if (m.kind !== "note" || m.left > 0 || m.right === 0) return;
    const run = [i];
    while ((marks[run[run.length - 1]] as { right: number }).right > 0) run.push(run[run.length - 1] + 1);
    out.push(run);
  });
  return out;
}
const flags = (marks: RhythmMark[]) => marks.map((m) => (m.kind === "note" ? m.flags : null));
const joins = (marks: RhythmMark[], i: number) => (marks[i] as { right: number }).right;

interface Row {
  n: number;
  text: string;
  density?: Density;
  runs: number[][];
  flags?: Record<number, number>;
  kinds?: Record<number, string>;
}

const ROWS: Row[] = [
  { n: 1, text: "8 8 8 8 8 8 8 8", runs: [[0, 1], [2, 3], [4, 5], [6, 7]] },
  { n: 2, text: "16 16 8 16 8 16", runs: [[0, 1, 2], [3, 4, 5]] },
  // starts 0, 0.5 (q), 1.5, 1.75
  { n: 3, text: "8 q 16 16", runs: [[2, 3]], flags: { 0: 1, 1: 0 } },
  // starts 0, 0.5, 0.75, 1.25
  { n: 4, text: "8 16 8 16", runs: [[0, 1, 2]], flags: { 3: 2 } },
  { n: 5, text: "8 8 8", runs: [[0, 1]], flags: { 2: 1 } },
  { n: 6, text: "8 | 8 8 | 8", runs: [[2, 3]], flags: { 0: 1, 5: 1 } },
  // starts 0, 0.25, 0.5, 0.75
  { n: 7, text: "16 r16 16 16", runs: [[2, 3]], flags: { 0: 2 }, kinds: { 1: "rest" } },
  { n: 8, text: "16 unset 16 16", runs: [], flags: { 0: 2, 2: 2, 3: 2 } },
  { n: 9, text: "[3: 8 8 8] 8 8", runs: [[0, 1, 2], [3, 4]] },
  { n: 10, text: "8 [3: 8 8 8] 8", runs: [[1, 2, 3]], flags: { 0: 1, 4: 1 } },
  { n: 11, text: "[5: 16 16 16 16 16]", runs: [[0, 1, 2, 3, 4]] },
  { n: 12, text: "[p: 16 16 16 16 16 16 16 16]", runs: [[0, 1, 2, 3], [4, 5, 6, 7]] },
  { n: 13, text: "16 [p: 16 16] 16", runs: [[1, 2]], flags: { 0: 2, 3: 2 } },
  { n: 14, text: "8 [3: 8 8 8] | 8 8", runs: [[1, 2, 3], [5, 6]], flags: { 0: 1 } },
  { n: 15, text: "[p: x4:16 8 8]", runs: [[0, 1, 2, 3], [4, 5]] },
  { n: 16, text: "[p: x4:16 8 8]", density: "compact", runs: [[1, 2]], flags: { 0: 2 } },
  { n: 17, text: "[3: x2:8 8 8] 8 8", runs: [], flags: { 0: 1, 1: 1, 2: 1 } },
  { n: 18, text: "[3: 8 8]", runs: [], flags: { 0: 1, 1: 1 } },
  { n: 19, text: "unset 8 | 8 8", runs: [[3, 4]], flags: { 1: 1 } },
  { n: 20, text: "w | h h | q q q q", runs: [], flags: { 0: 0, 2: 0, 3: 0, 5: 0, 6: 0, 7: 0, 8: 0 } },
  { n: 22, text: '8 "64" 8', runs: [], flags: { 0: 1, 2: 1 }, kinds: { 1: "none" } },
  { n: 23, text: "32 32 32 32 32 32 32 32", runs: [[0, 1, 2, 3, 4, 5, 6, 7]] },
  { n: 24, text: "8 32 32 16", runs: [[0, 1, 2, 3]] },
];

describe("rhythmMarks: the FR-036 corpus", () => {
  it.each(ROWS)("row $n: $text ($density)", (row) => {
    const { marks, layout } = marksFor(row.text, row.density);
    expect(marks.length).toBe(layout.columns.length);
    expect(runs(marks)).toEqual(row.runs);
    for (const [i, f] of Object.entries(row.flags ?? {})) expect(flags(marks)[Number(i)], `flags of ${i}`).toBe(f);
    for (const [i, k] of Object.entries(row.kinds ?? {})) expect(marks[Number(i)].kind).toBe(k);
    // INV-002: a beam is never half drawn.
    for (let i = 0; i + 1 < marks.length; i++) {
      const a = marks[i];
      const b = marks[i + 1];
      expect(a.kind === "note" ? a.right : 0, `join ${i}|${i + 1}`).toBe(b.kind === "note" ? b.left : 0);
    }
    // Every note is in a run or flagged, never both.
    for (const m of marks) if (m.kind === "note") expect(m.flags > 0 && (m.left > 0 || m.right > 0)).toBe(false);
  });

  it("row 2: stubs on the sixteenths either side of the eighth", () => {
    const { marks } = marksFor("16 16 8 16 8 16");
    expect(marks[3]).toMatchObject({ stubs: 1, stubSide: "right", left: 0, right: 1 });
    expect(marks[5]).toMatchObject({ stubs: 1, stubSide: "left", left: 1, right: 0 });
  });

  it("row 4: the sixteenth in an eighth run has a level-2 stub pointing left", () => {
    const { marks } = marksFor("8 16 8 16");
    expect(marks[1]).toMatchObject({ left: 1, right: 1, stubs: 1, stubSide: "left" });
  });

  it("row 11: level 2 throughout", () => {
    const { marks } = marksFor("[5: 16 16 16 16 16]");
    expect([0, 1, 2, 3].map((i) => joins(marks, i))).toEqual([2, 2, 2, 2]);
  });

  it("row 24: joins 1, 3, 2 and no stubs", () => {
    const { marks } = marksFor("8 32 32 16");
    expect([0, 1, 2].map((i) => joins(marks, i))).toEqual([1, 3, 2]);
    expect(marks.every((m) => m.kind !== "note" || m.stubs === 0)).toBe(true);
  });

  it("row 21: rests keep their duration and break a run", () => {
    const { marks } = marksFor("rw | rh | rq r8 r16 r32");
    expect(marks.filter((m) => m.kind === "rest").map((m) => (m as { duration: string }).duration)).toEqual([
      "w", "h", "q", "8", "16", "32",
    ]);
    expect(runs(marks)).toEqual([]);
  });

  it("row 20: whole, half and quarter have no levels", () => {
    const { marks } = marksFor("w | h h | q q q q");
    expect(marks.every((m) => m.kind !== "note" || m.levels === 0)).toBe(true);
  });

  it("rows 15 and 16: both densities read one position map", () => {
    const events = parse("[p: x4:16 8 8]");
    const positions = barPositions(events);
    const after = (density: Density) => {
      const layout = layoutOf(events, density);
      const last = layout.columns[layout.columns.length - 1];
      return positions.get(`${last.eventId}:${last.repetition}`);
    };
    expect(after("expanded")).toEqual(after("compact"));
    expect(after("compact")?.tick).toBe(360360 + 180180);
  });

  it("never throws on an empty layout", () => {
    expect(rhythmMarks([], new Map(), "expanded")).toEqual([]);
  });
});

describe("groupLabels (L1-L4)", () => {
  const labels = (text: string) => groupLabels(tupletSpans(marksFor(text).layout));
  it("L1 one counted group has one label at the middle column", () => {
    expect([...labels("[3: 8 8 8]").values()]).toEqual([1]);
  });
  it("L2 a group split across a barline has one label, at the first span middle", () => {
    const events = parse("[3: 8 8 8]");
    const split = [events[0], events[1], parse("|")[0], events[2]];
    const l = groupLabels(tupletSpans(layoutOf(split)));
    expect(l.size).toBe(1);
    expect([...l.values()]).toEqual([0]);
  });
  it("L3 a plain group has none", () => {
    expect(labels("[p: 8 8 8]").size).toBe(0);
  });
  it("L4 two adjacent counted groups have two", () => {
    expect(labels("[3: 8 8 8] [3: 8 8 8]").size).toBe(2);
  });
});
