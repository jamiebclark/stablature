/**
 * Round 5. INV-006, INV-009, Story 4 scenario 10. A row built the way a person or a phone damages
 * one: real cells from the notation, a real rail or pipe, and one thing the notation does not have
 * between them. The spec's refused list names `s`, `r` and `^`. Each such row must refuse, whichever
 * way the block around it would otherwise read, because it has a fret on it.
 *
 * Every member is cells × joins × ends, so this set is enumerated, not picked. The set is split by
 * cell, since T078's test asks only whether a digit touches a mark: a bare digit does, and a wrapped
 * one does not.
 */
import { describe, expect, it } from "vitest";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const ctx = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };
const PLAIN = ["---5---7---", "---5---7---", "---3---5---", "---3---5---"];
const TIDY = ["G|---5---|", "D|---5---|", "A|---3---|", "E|---3---|"];

const BARE = ["5", "12", "x", "5~", "5b", "5m", "t5"];
const WRAPPED = ["(5)", "(12)", "(x)", "<5>", "<12>", "t5b", "t5m", "t12b", "(5)b", "t(5)", "<x>"];
const JOINS = ["s", "r", "^", "?", ".", "=", " ", "  ", "-s-", "-r-", "-?-", "- -", "-.-"];
const ENDS: [string, string][] = [
  ["-", "-"],
  ["--", "--"],
  ["-", ""],
  ["", "-"],
  ["", ""],
];

function rowsOf(cells: readonly string[]) {
  const out: string[] = [];
  for (const a of cells) {
    for (const b of cells) {
      for (const join of JOINS) {
        for (const [open, close] of ENDS) out.push(`${open}${a}${join}${b}${close}`);
      }
    }
  }
  // A line with neither rail nor pipe is no staff row in the spec's table, so it claims nothing.
  return out.filter((row) => /[-|]/.test(row));
}

function lost(rows: readonly string[], block: readonly string[], where: "top" | "bottom") {
  const silent = rows.filter((row) => {
    const lines = where === "top" ? [row, ...block] : [...block, row];
    return readTab(lines.join("\n"), ctx).kind === "ready";
  });
  return { of: rows.length, lost: silent.length, first: silent.slice(0, 10) };
}

describe("INV-006 INV-009 a damaged row of real cells", () => {
  for (const [name, cells] of [
    ["bare cells", BARE],
    ["wrapped cells", WRAPPED],
  ] as const) {
    for (const [blockName, block] of [
      ["unlabelled", PLAIN],
      ["labelled", TIDY],
    ] as const) {
      for (const where of ["top", "bottom"] as const) {
        it(`${name}, ${where} of a ${blockName} block`, () => {
          const rows = rowsOf(cells);
          expect(lost(rows, block, where)).toEqual({ of: rows.length, lost: 0, first: [] });
        });
      }
    }
  }
});
