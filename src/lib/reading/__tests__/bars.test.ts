/** INV-032 (unit half), INV-033, INV-034: bar numbers, section visits, beats a bar -- against hand tables. */
import { describe, expect, it } from "vitest";
import { expandArrangement, ordinal, type ArrangementNode } from "@/lib/arrangement/expand";
import { countBars } from "@/lib/tab/layout";
import { TICKS_PER_BEAT } from "@/lib/rhythm/durations";
import { beatsPerBar, notationColumns } from "@/lib/rhythm/notation";
import { bar, ev, group, pass, quarters } from "@/lib/rhythm/__tests__/notation-helpers";
import { barStarts, partHeading, passBars } from "../bars";

const bars = (k: number, perBar = 4) => Array.from({ length: k }, () => [...Array.from({ length: perBar }, () => ev({})), bar()]).flat();

describe("passBars", () => {
  const cases: [string, ReturnType<typeof quarters>[], number[], number][] = [
    ["one pass of 4 bars with a trailing barline", [bars(4)], [0], 4],
    ["same twice", [bars(4), bars(4)], [0, 4], 8],
    ["a pass with nothing between", [bars(2), [], bars(3)], [0, 2, 2], 5],
    ["no barlines", [quarters(8), quarters(8)], [0, 1], 2],
    ["leading barline counts the empty bar? no", [[bar(), ...quarters(4)], quarters(4)], [0, 2], 3],
  ];
  it.each(cases)("%s", (_n, parts, offset, total) => {
    const got = passBars(parts.map((p) => pass(p)));
    expect(got.offset).toEqual(offset);
    expect(got.total).toBe(total);
    expect(got.total).toBe(parts.reduce((n, p) => n + countBars(p), 0));
  });
});

describe("barStarts", () => {
  it("is the first non-barline column of each bar", () => {
    const kinds = [
      { kind: "notes", barNumber: 1 }, { kind: "notes", barNumber: 1 }, { kind: "barline", barNumber: 1 },
      { kind: "barline", barNumber: 2 }, { kind: "notes", barNumber: 3 },
    ] as never[];
    expect(barStarts(kinds)).toEqual([0, 4]);
  });
});

describe("beatsPerBar", () => {
  const four = (n: number) => bars(n, 4);
  it("all bars the same", () => {
    expect(beatsPerBar(four(3))).toBe(4);
    expect(beatsPerBar(bars(3, 3))).toBe(3);
    expect(beatsPerBar(bars(2, 5))).toBe(5);
    expect(beatsPerBar(bars(2, 6))).toBe(6);
    expect(beatsPerBar(bars(1, 1))).toBe(1);
  });
  it("one bar differs, or a pickup", () => {
    expect(beatsPerBar([...bars(2, 4), ...quarters(3), bar()])).toBeNull();
    expect(beatsPerBar([...quarters(1), bar(), ...bars(2, 4)])).toBeNull();
  });
  it("untimed, empty middle, leading and trailing barlines", () => {
    expect(beatsPerBar([...quarters(4), bar(), ev({ durationHint: null }), bar()])).toBeNull();
    expect(beatsPerBar([...quarters(4), bar(), bar(), ...quarters(4)])).toBeNull();
    expect(beatsPerBar([bar(), ...bars(2, 4)])).toBe(4);
    expect(beatsPerBar([...bars(2, 4), bar()])).toBe(4);
  });
  it("a tuplet in a bar, a part of no durations, nothing, a fractional bar", () => {
    expect(beatsPerBar([...group("t", 3, "8"), ...quarters(3), bar()])).toBe(4);
    expect(beatsPerBar([ev({ durationHint: null }), bar()])).toBeNull();
    expect(beatsPerBar([])).toBeNull();
    expect(beatsPerBar([ev({ durationHint: "8" }), ev({ durationHint: "q" }), bar()])).toBeNull();
  });
});

describe("partHeading", () => {
  it("never a fraction, tempo left out when unusable", () => {
    expect(partHeading(bars(2), 120).text).toBe("120 bpm · 4 beats a bar");
    expect(partHeading(bars(2, 1), 90).text).toBe("90 bpm · 1 beat a bar");
    expect(partHeading(bars(2), null).text).toBe("4 beats a bar");
    expect(partHeading(bars(2), 0).text).toBe("4 beats a bar");
    expect(partHeading([ev({ durationHint: null })], null).text).toBeNull();
    expect(partHeading(bars(2, 3), 100).text).not.toContain("/");
  });
});

describe("section visits", () => {
  const part = (entryId: string, repeat = 1): ArrangementNode => ({
    kind: "part", entryId, partId: "p", repeat, fromBar: null, toBar: null, lastRepeatPartId: null, label: null,
  });
  const section = (label: string | null, repeat: number, children: ArrangementNode[]): ArrangementNode => ({
    kind: "section", entryId: `s-${label}`, label, repeat, children,
  });
  const read = (nodes: ArrangementNode[]) => expandArrangement(nodes).map((s) => s.visits.map((v) => `${v.label}#${v.time}${v.opens ? "*" : ""}`));

  it("each pass of Verse x2 is a visit, opens on its first step only", () => {
    expect(read([section("Verse", 2, [part("a", 2)])])).toEqual([["Verse#1*"], ["Verse#1"], ["Verse#2*"], ["Verse#2"]]);
  });
  it("names compare trimmed and case-folded, across non-adjacent sections", () => {
    expect(read([section("Verse", 1, [part("a")]), section("Chorus", 1, [part("b")]), section("verse ", 1, [part("c")])])).toEqual([
      ["Verse#1*"], ["Chorus#1*"], ["verse #2*"],
    ]);
  });
  it("empty visits do not count; unnamed sections have none; sections is unchanged", () => {
    const steps = expandArrangement([section("Verse", 1, []), section("Verse", 1, [part("a")]), section(null, 1, [part("b")])]);
    expect(steps.map((s) => s.visits.map((v) => v.time))).toEqual([[1], []]);
    expect(steps.map((s) => s.sections)).toEqual([["Verse"], []]);
  });
  it("nested sections give one visit each, outermost first", () => {
    expect(read([section("Song", 1, [section("Verse", 1, [part("a")]), section("Verse", 1, [part("b")])])])).toEqual([
      ["Song#1*", "Verse#1*"], ["Song#1", "Verse#2*"],
    ]);
  });
  it("ordinal", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd"]);
  });
});

describe("notationColumns", () => {
  it("lists timed columns by tick across passes, stopping before an untimed bar", () => {
    const cols = notationColumns([pass(bars(1)), pass([...quarters(2), bar(), ...quarters(1), ev({ durationHint: null })])]);
    const T = TICKS_PER_BEAT;
    expect(cols.map((c) => [c.pass, c.tick / T])).toEqual([[0, 0], [0, 1], [0, 2], [0, 3], [1, 4], [1, 5]]);
  });
  it("a repeat gives a column per repetition", () => {
    const e = ev({ repeat: 3, durationHint: "8" });
    expect(notationColumns([pass([e])]).map((c) => [c.eventId, c.repetition])).toEqual([[e.id, 0], [e.id, 1], [e.id, 2]]);
  });
});
