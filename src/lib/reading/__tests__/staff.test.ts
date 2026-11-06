/** INV-016 (arithmetic half): chord rooms, bar runs and bar starts, against hand tables. */
import { describe, expect, it } from "vitest";
import type { TabColumn } from "@/lib/tab/layout";
import { barRuns, barStarts, chordRooms } from "../staff";

/** "n3" = a note of width 3; "|" = a barline; "Em:1" = a chord on a width-1 note. */
function cols(spec: string): TabColumn[] {
  return spec.split(" ").map((token) => {
    const [head, chord] = token.split(":");
    const barline = head === "|";
    return {
      eventId: token,
      kind: barline ? "barline" : "note",
      cells: [],
      width: barline ? 1 : Number(head),
      barNumber: 1,
      chord: chord ?? null,
      tupletId: null,
      tupletCount: null,
      bracketNumber: null,
      repetition: 0,
      repeat: 1,
      duration: null,
      connectors: [],
      description: "",
    } as TabColumn;
  });
}

describe("chordRooms", () => {
  it("owns its column and those after it up to the next chord", () => {
    const rooms = chordRooms(cols("1:Em7 2 1 1:C 1"));
    expect(rooms.get(0)).toEqual({ chars: 3, roomChars: 4, roomColumns: 3 });
    expect(rooms.get(3)).toEqual({ chars: 1, roomChars: 2, roomColumns: 2 });
    expect(rooms.size).toBe(2);
  });

  it("stops at the barline that closes the bar, including it", () => {
    const rooms = chordRooms(cols("1:Cmaj7 2 | 1 1"));
    expect(rooms.get(0)).toEqual({ chars: 5, roomChars: 4, roomColumns: 3 });
  });

  it("runs to the last column when nothing ends it", () => {
    expect(chordRooms(cols("2 1:F#m7b5"))).toEqual(new Map([[1, { chars: 6, roomChars: 1, roomColumns: 1 }]]));
  });

  it("counts characters, not UTF-16 units", () => {
    expect(chordRooms(cols("1:A♭"))).toEqual(new Map([[0, { chars: 2, roomChars: 1, roomColumns: 1 }]]));
  });
});

describe("barRuns and barStarts", () => {
  it("splits at barlines, each run ending with its barline", () => {
    expect(barRuns(cols("1 1 | 1 | 1 1"))).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 4 },
      { start: 5, end: 6 },
    ]);
  });

  it("puts every column in exactly one run", () => {
    const columns = cols("1 | | 1");
    const covered = barRuns(columns).flatMap((r) => Array.from({ length: r.end - r.start + 1 }, (_, i) => r.start + i));
    expect(covered).toEqual([0, 1, 2, 3]);
  });

  it("finds columns that open a bar, never a barline, and none for an empty bar", () => {
    expect([...barStarts(cols("1 1 | | 1 | 1"))]).toEqual([0, 4, 6]);
    expect(barRuns([])).toEqual([]);
  });
});
