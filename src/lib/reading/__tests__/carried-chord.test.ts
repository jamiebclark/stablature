/**
 * INV-014: a slice that starts after its chord's anchor still says which chord its cells read against.
 */
import { describe, expect, it } from "vitest";
import type { AnnotationRow, EventRow } from "@/lib/model";
import { layoutReading } from "@/lib/reading/labels";
import { TUNING_PRESETS } from "@/lib/tunings";

const tuning = TUNING_PRESETS[0];
const note = (id: string, fret: number): EventRow =>
  ({ id, kind: "notes", frets: { "0": fret }, repeat: 1, durationHint: null, tupletId: null, tupletCount: null }) as unknown as EventRow;
const other = (id: string, kind: string): EventRow =>
  ({ id, kind, frets: {}, repeat: 1, durationHint: null, tupletId: null, tupletCount: null }) as unknown as EventRow;
const chord = (anchorEventId: string, value: string) => ({ kind: "chord", anchorEventId, value }) as AnnotationRow;

const all = [note("a", 5), note("b", 7), note("c", 9), note("d", 2)];
const run = (view: "notes" | "intervals", slice: EventRow[], annotations: AnnotationRow[], partEvents = all) =>
  layoutReading({ view, events: slice, partEvents, tuning, annotations });

describe("the carried chord", () => {
  it("is shown under a chord anchored before the slice", () => {
    const l = run("intervals", all.slice(2), [chord("a", "Am")]);
    expect(l.carriedChord).toBe("(Am)");
    expect(l.columns[0].chord).toBe("(Am)");
    expect(l.columns[0].width).toBeGreaterThanOrEqual("(Am)".length);
  });
  it("is absent on the anchor, before any chord, and with the whole part", () => {
    expect(run("intervals", all.slice(2), [chord("c", "Am")]).carriedChord).toBeNull();
    expect(run("intervals", all.slice(2), []).carriedChord).toBeNull();
    expect(run("intervals", all, [chord("a", "Am")]).carriedChord).toBeNull();
  });
  it("carries an unreadable chord, but not a blank one", () => {
    expect(run("intervals", all.slice(2), [chord("a", "Am"), chord("b", "N.C.")]).carriedChord).toBe("(N.C.)");
    expect(run("intervals", all.slice(2), [chord("a", "Am"), chord("b", " ")]).carriedChord).toBeNull();
  });
  it("is present only in intervals", () => {
    const l = run("notes", all.slice(2), [chord("a", "Am")]);
    expect(l.carriedChord).toBeNull();
    expect(l.columns[0].chord).toBeNull();
  });
  it("leaves a column holding its own chord alone", () => {
    const l = run("intervals", all.slice(2), [chord("a", "Am"), chord("c", "F")]);
    expect(l.carriedChord).toBeNull();
    expect(l.columns[0].chord).toBe("F");
  });
  it("lands on the first column to read when the slice opens on a barline or a space", () => {
    for (const kind of ["barline", "space"]) {
      const events = [other("x", kind), ...all.slice(2)];
      const l = run("intervals", events, [chord("a", "Am")], [...all, other("x", kind)]);
      const first = l.columns.find((c) => c.kind !== "barline")!;
      expect(l.carriedChord).toBe("(Am)");
      expect(first.chord).toBe("(Am)");
      expect(l.columns.filter((c) => c.chord === "(Am)")).toHaveLength(1);
    }
  });
});
