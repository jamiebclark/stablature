/**
 * INV-020 **NotF**, one member per test: what must not count. Each pair differs only in what the plan says is not
 * part of a column, so each reads `Same as A` with no ops. Harvest and **F** are in the harvest probe.
 */
import { describe, expect, it } from "vitest";
import type { AnnotationRow, EventRow, PartRow } from "@/lib/model";
import { compareParts } from "@/lib/reading/compare";
import { staffMarks } from "@/lib/reading/marks";
import { TUNING_PRESETS } from "@/lib/tunings";

const tuning = TUNING_PRESETS[0];
const strings = tuning.strings.length;

let serial = 0;
const col = (over: Partial<EventRow> = {}) =>
  ({
    id: `c${++serial}`, rank: `a${serial}`, kind: "notes", frets: { "0": 5 }, techniques: {}, repeat: 1, durationHint: null,
    tupletId: null, tupletCount: null, groupKind: null, ...over,
  }) as unknown as EventRow;
const ann = (anchor: string, over: Partial<AnnotationRow> = {}) =>
  ({ id: `n${++serial}`, anchorEventId: anchor, kind: "chord", value: "Am", ...over }) as unknown as AnnotationRow;

const P = { id: "p", label: "A", name: "Riff", notes: "one" } as unknown as PartRow;
const V = { id: "v", label: "B", name: "Other", notes: "two" } as unknown as PartRow;

function same(a: EventRow[], b: EventRow[], an: AnnotationRow[] = [], bn: AnnotationRow[] = []) {
  const comparison = compareParts({ part: P, events: a, annotations: an }, { part: V, events: b, annotations: bn }, strings);
  expect(comparison.ops.filter((op) => op.kind !== "same")).toEqual([]);
  expect(staffMarks(comparison, { events: b, fromBar: null, toBar: null, density: "expanded" }).line).toBe("Same as A");
}

describe("INV-020 what must not count", () => {
  it("every event id, and event rank values", () => same([col(), col()], [col(), col()]));
  it("part name, part notes and part label", () => same([col()], [col()]));
  it("every group id", () => {
    const group = (id: string) => ({ tupletId: id, tupletCount: 3, groupKind: "tuplet" }) as Partial<EventRow>;
    same([col(group("g1")), col(group("g1")), col(group("g1"))], [col(group("g2")), col(group("g2")), col(group("g2"))]);
  });
  it("every annotation id", () => {
    const a = col();
    const b = col();
    same([a], [b], [ann(a.id)], [ann(b.id)]);
  });
  it("annotation row order, one chord on each of two columns", () => {
    const [a1, a2, b1, b2] = [col(), col(), col(), col()];
    same([a1, a2], [b1, b2], [ann(a1.id, { value: "Am" }), ann(a2.id, { value: "C" })], [ann(b2.id, { value: "C" }), ann(b1.id, { value: "Am" })]);
  });
  it("a text annotation", () => {
    const a = col();
    const b = col();
    same([a], [b], [], [ann(b.id, { kind: "text", value: "slowly" } as Partial<AnnotationRow>)]);
  });
  it("a dynamic annotation", () => {
    const a = col();
    const b = col();
    same([a], [b], [], [ann(b.id, { kind: "dynamic", value: "ff" } as Partial<AnnotationRow>)]);
  });
  it("technique order", () =>
    same([col({ techniques: { "0": ["vibrato", "bend"] } } as Partial<EventRow>)], [col({ techniques: { "0": ["bend", "vibrato"] } } as Partial<EventRow>)]));
  it("a duplicate technique", () =>
    same([col({ techniques: { "0": ["bend"] } } as Partial<EventRow>)], [col({ techniques: { "0": ["bend", "bend"] } } as Partial<EventRow>)]));
  it("an empty technique list", () => same([col()], [col({ techniques: { "0": [] } } as Partial<EventRow>)]));
  it("a technique on an unplayed string", () => same([col()], [col({ techniques: { "1": ["bend"] } } as Partial<EventRow>)]));
  it("a fret on a string the tuning lacks", () =>
    same([col()], [col({ frets: { "0": 5, [String(strings + 3)]: 9 } } as Partial<EventRow>)]));
  it("chord with surrounding spaces", () => {
    const a = col();
    const b = col();
    same([a], [b], [ann(a.id, { value: "Am" })], [ann(b.id, { value: "  Am " })]);
  });
  it("7x8 against 7x4 7x4", () => same([col({ repeat: 8 })], [col({ repeat: 4 }), col({ repeat: 4 })]));
  it("legacy null kind and null count against a modern 3", () => {
    const legacy = { tupletId: "g", tupletCount: null, groupKind: null } as Partial<EventRow>;
    const modern = { tupletId: "h", tupletCount: 3, groupKind: "tuplet" } as Partial<EventRow>;
    same([col(legacy), col(legacy), col(legacy)], [col(modern), col(modern), col(modern)]);
  });
});
