/**
 * Round 4. INV-006: never is a row with anything on it dropped, moved, or put on another string.
 *          INV-009: never does a line that may be a damaged staff row become commentary.
 *
 * Round 3 widened the set to rows with one character the notation LACKS. This is the other side, and
 * the one that should be free: every row the notation CAN write, with no label and no pipes. A row
 * the reader would accept is the last thing that may become commentary.
 *
 * The oracle is the spec's. One row more than the song has strings cannot be `ready` unless a row
 * went missing, so each `ready` here is a row dropped, with every note under it moved up a string.
 *
 * Each case lists every offending row, so a failure reads as the whole set and not its first member.
 */
import { describe, expect, it } from "vitest";
import { readTab } from "@/lib/tab/reading";
import { DECORATIONS, TRANSITIONS, decorate, type Decoration } from "@/lib/tab/techniques";
import { presetById } from "@/lib/tunings";

const PRESETS: [string, number][] = [
  ["bass4-e", 4],
  ["bass5-b", 5],
  ["guitar6-e", 6],
];

const ctx = (id: string) => ({ tuning: presetById(id)!, bandTunings: [], songEvents: [] });

const SUBSETS: Decoration[][] = Array.from({ length: 1 << DECORATIONS.length }, (_, mask) =>
  DECORATIONS.filter((_, i) => (mask >> i) & 1).map((d) => d.id),
);

const SHAPES: [string, (cell: string) => string][] = [
  ["one cell, one rail each side", (c) => `-${c}-`],
  ["one cell, two rails each side", (c) => `--${c}--`],
  ["two cells, one rail apart", (c) => `-${c}-${c}-`],
  ["two cells, two rails apart", (c) => `--${c}--${c}--`],
  ["two cells, opening and closing the row", (c) => `${c}-${c}`],
  ["two cells, a closing pipe", (c) => `-${c}-${c}-|`],
  ["two cells, a barline between", (c) => `-${c}-|-${c}-`],
];

const plain = "---5---7---";

/** The rows that came back `ready`, which can only mean they were dropped. */
function dropped(rows: readonly string[], preset: string, strings: number, where: "top" | "bottom") {
  const rest = Array.from({ length: strings }, () => plain);
  return rows.filter((row) => {
    const lines = where === "top" ? [row, ...rest] : [...rest, row];
    return readTab(lines.join("\n"), ctx(preset)).kind === "ready";
  });
}

describe("INV-006 INV-009 every decorated cell, as a row with no label", () => {
  for (const core of ["7", "12", "x"]) {
    for (const [shape, draw] of SHAPES) {
      const rows = SUBSETS.map((ids) => draw(decorate(core, ids)));
      for (const [preset, strings] of PRESETS) {
        for (const where of ["top", "bottom"] as const) {
          it(`${core}, ${shape}, ${where} of ${strings} rows`, () => {
            expect(dropped(rows, preset, strings, where)).toEqual([]);
          });
        }
      }
    }
  }
});

describe("INV-006 INV-009 every transition between wrapped cells", () => {
  const CELLS = ["5", "(5)", "t5b", "(x)", "t(5)b~m"];
  const rows = TRANSITIONS.flatMap((t) =>
    CELLS.flatMap((a) => CELLS.flatMap((b) => [`-${a}${t.glyph}${b}-`, `--${a}${t.glyph}${b}--`])),
  );
  for (const [preset, strings] of PRESETS) {
    for (const where of ["top", "bottom"] as const) {
      it(`${where} of ${strings} rows`, () => {
        expect(dropped(rows, preset, strings, where)).toEqual([]);
      });
    }
  }
});

describe("INV-006 a row with no label under a labelled block is never lost", () => {
  const tidy = ["G|---5---|", "D|---5---|", "A|---3---|", "E|---3---|"];
  it.each(["-(5)-(7)-", "--(5)--(7)--", "-t5b-t7b-", "-(x)-(x)-", "(5)-(7)"])("%s", (row) => {
    expect(readTab([...tidy, row].join("\n"), ctx("bass4-e")).kind).toBe("refused");
  });
});
