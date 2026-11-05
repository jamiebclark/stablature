/**
 * Round 8. What contracts/reader.md's S6 row says, against what the reader does (review F71). Each
 * case pins the behaviour, and each passes today: the defect is the contract's words, not the code.
 *
 * Stacked lines of only the notation are said to refuse. They do when their count or width gives
 * them away. Four of one width on a four-string song have nothing to give away: they are the same
 * text as `3-5-3-7` rows, which F66 said must read. The preview draws them.
 */
import { describe, expect, it } from "vitest";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const context = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };

function notes(text: string) {
  const reading = readTab(text, context);
  if (reading.kind !== "ready") return reading.kind;
  let total = 0;
  for (const column of reading.clipboard.columns) total += Object.keys(column.frets).length * column.repeat;
  return total;
}

function codes(text: string) {
  const reading = readTab(text, context);
  return reading.kind === "refused" ? reading.refusals.map((r) => r.code) : [reading.kind];
}

describe("INV-010 stacked lines of only the notation", () => {
  it("two refuse, on a four-string song", () => {
    expect(codes("1-4\n5-8")).toEqual(["unlabelled-count"]);
  });

  it("four of one width read, as rows do", () => {
    expect(notes("1-2\n3-4\n5-6\n7-8")).toBe(8);
  });

  it("and join an unlabelled system beside them", () => {
    expect(notes("1-2\n3-4\n5-6\n7-8\n\n|---5---|\n|-------|\n|-------|\n|---7---|")).toBe(10);
  });
});

describe("INV-006 rows with a note name, a space and no rail after it", () => {
  it("refuse on every line, though the contract says such a system reads", () => {
    expect(codes("G 3-5-3-7\nD 3-5-3-7\nA 3-5-3-7\nE 3-5-3-7")).toEqual([
      "bad-character",
      "bad-character",
      "bad-character",
      "bad-character",
    ]);
  });
});
