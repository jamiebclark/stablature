import "fake-indexeddb/auto";

/**
 * INV-010: never is commentary lost silently, read as notes, or read as chords, and never does a
 * whole song join into one part.
 */
import { describe, expect, it } from "vitest";
import { draftPart } from "@/lib/local/clipboard";
import { isPartHeading, songToText } from "@/lib/export/text";
import type { AnnotationRow, EventRow, PartRow } from "@/lib/model";
import { presetById } from "@/lib/tunings";
import { clip, codes, four } from "./unit-helpers";

const STAFF = four("-5-7-");

const LINES = [
  "I walk the line tonight",
  "P.M.----|",
  "1   2   3   4",
  "[Verse]",
  "[A]",
  "(A)",
  "A",
  "B'",
  "A-men",
  "E-Bow",
  "-------",
];

describe("every kind of commentary is listed with its number", () => {
  it.each(LINES)("%s, a blank line above the staff", (line) => {
    expect(clip(`${line}\n\n${STAFF}`).ignored).toEqual([{ line: 1, text: line }]);
  });

  // The usual place for a comment or a heading: right on top of the staff, nothing between.
  it.each(LINES.filter((l) => l !== "-------"))("%s, directly above the staff", (line) => {
    expect(clip(`${line}\n${STAFF}`).ignored).toEqual([{ line: 1, text: line }]);
  });

  it.each(LINES)("%s, between two systems", (line) => {
    if (["A", "B'"].includes(line)) return; // A heading with a system above it refuses.
    const r = clip(`${STAFF}\n${line}\n\n${STAFF}`);
    expect(r.ignored).toEqual([{ line: 5, text: line }]);
  });

  it("riff over a column is commentary, not a chord", () => {
    const r = clip(`    riff\n${STAFF}`);
    expect(r.clipboard.annotations).toEqual([]);
    expect(r.ignored).toEqual([{ line: 1, text: "    riff" }]);
  });

  it("a beat count exactly on the columns is commentary", () => {
    const text = `    1 2\n${STAFF}`;
    const r = clip(text);
    expect(r.clipboard.columns.every((c) => c.tupletGroup === null)).toBe(true);
    expect(r.ignored.map((l) => l.line)).toEqual([1]);
  });

  it("commentary is never read as notes", () => {
    for (const line of LINES) {
      if (line === "-------") continue;
      const r = clip(`${line}\n${STAFF}`);
      expect(draftPart(r.clipboard).events.filter((e) => e.kind === "notes")).toHaveLength(2);
    }
  });
});

function event(id: string, fret: number): EventRow {
  return {
    id,
    bandId: "b",
    partId: "p",
    rank: id,
    kind: "notes",
    frets: { "0": fret },
    techniques: {},
    repeat: 1,
    durationHint: null,
    tupletId: null,
    tupletCount: null,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
  } as EventRow;
}

function part(id: string, label: string, name: string | null = null, variantOf: string | null = null) {
  return { id, label, name, variantOfPartId: variantOf, notes: null } as unknown as PartRow;
}

function chord(anchor: string, value: string): AnnotationRow {
  return {
    id: `c-${anchor}`,
    bandId: "b",
    partId: "p",
    anchorEventId: anchor,
    kind: "chord",
    value,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
  } as AnnotationRow;
}

const song = { title: "Dirge", bpm: 120, notes: null };
const tuning = presetById("bass4-e")!;

function exportOf(parts: PartRow[], annotationsByPart: Record<string, AnnotationRow[]> = {}) {
  const eventsByPart = Object.fromEntries(
    parts.map((p, i) => [p.id, [event(`${p.id}-1`, 5 + i), event(`${p.id}-2`, 7 + i), event(`${p.id}-3`, 9 + i)]]),
  );
  return songToText({
    song: song as never,
    bandName: "Hollow Crown",
    tuning,
    tuningName: "E Standard",
    parts,
    eventsByPart,
    annotationsByPart,
    entries: [],
  });
}

describe("one part cut from an export", () => {
  it.each([
    ["unnamed", part("a", "A")],
    ["named", part("a", "A", "Verse riff")],
  ])("%s: title, meta and heading are all listed", (_name, p) => {
    const text = exportOf([p]);
    const r = clip(text);
    const lines = text.split("\n");
    const expected = lines
      .map((l, i) => ({ line: i + 1, text: l }))
      .filter((l) => l.text.trim() !== "" && !l.text.includes("|"));
    expect(r.ignored).toEqual(expected);
  });
});

describe("a whole song refuses rather than joining", () => {
  it.each([
    ["two parts", [part("a", "A"), part("b", "B")]],
    ["three parts", [part("a", "A"), part("b", "B"), part("c", "C")]],
    ["named", [part("a", "A", "Verse"), part("b", "B", "Chorus")]],
    ["a variant", [part("a", "A"), part("b", "A'", null, "a")]],
    ["a named variant", [part("a", "A"), part("b", "A'", "Late", "a")]],
    ["past Z", [part("a", "Z"), part("b", "AA")]],
  ])("%s", (_name, parts) => {
    const text = exportOf(parts);
    expect(codes(text)).toContain("several-parts");
    for (const line of text.split("\n")) {
      const label = parts.find((p) => line.startsWith(p.label) && !line.includes("|"));
      if (label) expect(isPartHeading(line), line).toBe(true);
    }
  });

  it("a part whose first chord is drawn above it", () => {
    const parts = [part("a", "A"), part("b", "B")];
    expect(codes(exportOf(parts, { b: [chord("b-1", "Am")] }))).toContain("several-parts");
  });

  // spec.md: "A chord value that is not a chord symbol comes back as commentary", and the same
  // file: a line that reads as a heading, with a system above it, refuses. Both hold at once.
  it.each(["riff", "tacet", "(pause)"])("a part whose first chord value is %s, which is not a symbol", (value) => {
    const parts = [part("a", "A"), part("b", "B")];
    const text = exportOf(parts, { b: [chord("b-1", value)] });
    expect(codes(text), text).toContain("several-parts");
  });
});

describe("what must not be taken for a heading", () => {
  it.each(["la la la", "[Verse]", "A-men"])("%s", (line) => {
    expect(isPartHeading(line)).toBe(false);
  });
});
