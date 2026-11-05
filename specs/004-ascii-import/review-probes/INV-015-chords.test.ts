/** INV-015: never does a chord land on a barline, on the wrong column, or on two columns. */
import { describe, expect, it } from "vitest";
import { parseChord } from "@/lib/chords";
import { draftPart } from "@/lib/local/clipboard";
import type { AnnotationRow, EventRow } from "@/lib/model";
import { toAscii } from "@/lib/tab/ascii";
import { presetById } from "@/lib/tunings";
import { clip, codes } from "./unit-helpers";

/** A chord row over `G |<body>|` and a row of rails: an offset is 3 plus the place in the body. */
const over = (chords: string, body: string) =>
  `${chords}\nG |${body}|\nD |${body.replace(/[^|]/g, "-")}|`;

const anchors = (text: string) => {
  const rows = draftPart(clip(text).clipboard);
  return rows.annotations.map((a) => {
    const at = rows.events.findIndex((e) => e.id === a.anchorEventId);
    return [a.value, at, rows.events[at].kind] as const;
  });
};

describe("anchoring", () => {
  it("exact", () => expect(anchors(over("    Am", "-5-7-"))).toEqual([["Am", 0, "notes"]]));

  it("one off to the left of a column", () => {
    const r = clip(over("   Am", "-5-7-"));
    expect(r.clipboard.annotations[0].columnIndex).toBe(0);
    expect(r.moved).toHaveLength(1);
  });

  it("one off to the right of a column, in a wide gap with no spaces read", () => {
    const r = clip(["      Am", "G|---5-------7---|", "D|---------------|"].join("\n"));
    expect(r.clipboard.annotations[0].columnIndex).toBe(0);
    expect(r.moved).toHaveLength(1);
  });

  it("in the app's shape the rest column is a column, so a tie between it and a note goes right", () => {
    expect(clip(over("     Am", "-5---7-")).clipboard.columns[1].kind).toBe("rest");
    expect(clip(over("     Am", "-5---7-")).clipboard.annotations[0].columnIndex).toBe(1);
  });

  it("a tie goes right", () => {
    expect(clip(over("     Am", "-5-7-")).clipboard.annotations[0].columnIndex).toBe(1);
  });

  it("exactly over a barline moves to a column that is not one", () => {
    expect(anchors(over("     Am", "-5|7-"))[0][2]).toBe("notes");
  });

  it("AmDm splits, Am7 stays whole, AmG splits", () => {
    expect(anchors(over("    AmDm", "-5-7-")).map((a) => a[0])).toEqual(["Am", "Dm"]);
    expect(anchors(over("    Am7", "-5-7-9-")).map((a) => a[0])).toEqual(["Am7"]);
    expect(anchors(over("    AmG", "-5-7-9-")).map((a) => a[0])).toEqual(["Am", "G"]);
  });

  it("N.C. reads as a chord", () => {
    expect(anchors(over("    N.C.", "-5-7-9-"))[0][0]).toBe("N.C.");
  });

  it("a chord on the first pass of a run stays on the first column, and the run merges", () => {
    const r = clip(over("    Am", "-5-5-5-"));
    expect(r.clipboard.columns.map((c) => c.repeat)).toEqual([3]);
    expect(r.clipboard.annotations[0].columnIndex).toBe(0);
  });

  it("a chord per system", () => {
    const r = clip(`${over("    Am", "-5-7-")}\n\n${over("    G", "-5-7-")}`);
    expect(r.clipboard.annotations.map((a) => a.value)).toEqual(["Am", "G"]);
  });

  it("two on one column refuses", () => {
    expect(codes(over("    A B", "-5-"))).toContain("chord-collision");
  });

  it("a system of barlines refuses", () => {
    expect(codes(over("    Am", "-|-|-"))).toContain("chord-no-column");
  });

  it("Cmaj7 clipped reads what is drawn, and says so", () => {
    expect(clip(over("    Cm", "-5-")).clipped).toHaveLength(1);
  });
});

/** A chord spelt with a rail. reader.md section 2 tests Chord before Staff for exactly this. */
describe("chords that read like a damaged row (plan deviation 7)", () => {
  const symbols = ["D-7", "A-", "G-7", "F#-7", "Bb-7", "E-"];

  it("each is a chord the app's own reader accepts", () => {
    for (const s of symbols) expect(parseChord(s), s).not.toBeNull();
  });

  it.each(symbols)("%s above a staff is a chord", (symbol) => {
    expect(anchors(over(`    ${symbol}`, "-5-7-9-")).map((a) => a[0])).toEqual([symbol]);
  });

  it.each(["D-7   G-7", "A-    E-"])("%s, two of them on one row", (row) => {
    expect(anchors(over(`    ${row}`, "-5-----7-----9-")).length).toBe(2);
  });

  it.each(symbols)("the export's own text with %s comes back, character for character", (symbol) => {
    const event = (id: string, fret: number) =>
      ({
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
      }) as EventRow;
    const events = [event("e1", 5), event("e2", 7), event("e3", 9), event("e4", 11)];
    const annotations = [
      {
        id: "a",
        bandId: "b",
        partId: "p",
        anchorEventId: "e1",
        kind: "chord",
        value: symbol,
        updatedAt: "x",
        deletedAt: null,
        fieldClocks: {},
        serverSeq: 0,
      } as AnnotationRow,
    ];
    const tuning = presetById("bass4-e")!;
    const text = toAscii({ events, annotations, tuning });
    const rows = draftPart(clip(text).clipboard);
    expect(toAscii({ ...rows, tuning })).toBe(text);
  });
});
