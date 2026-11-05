/**
 * Round 9. INV-006 and INV-009 over every cell the notation can write, on a row that has nothing
 * else to claim it: no label, no pipe, no run of three rails.
 *
 * Both every-line sweeps filter on "a note touches a rail", which is S6's own test, so neither can
 * see a note that does not touch one. `(5)` and `<7>` are cells of this notation, and spec.md's
 * accepted list names `(7)` as common in wild tab. T087's rule took such a row through
 * `isNotationOnly`; T089 asked what a note touches instead, so a digit inside its own brackets
 * touches no rail, and a row of only such cells is claimed by nothing.
 *
 * Each paste must refuse, or store every note. Counting notes needs no second reader.
 */
import { describe, expect, it } from "vitest";
import { parseTab } from "@/lib/tab/parse";
import { readTab } from "@/lib/tab/reading";
import { DECORATIONS, decorate } from "@/lib/tab/techniques";
import { presetById } from "@/lib/tunings";

const context = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };
const GOOD = "G |---5---7---|\nD |-----------|\nA |-----------|\nE |---9-------|";
const GOOD_NOTES = 3;

const SUBSETS = Array.from({ length: 1 << DECORATIONS.length }, (_, mask) =>
  DECORATIONS.filter((_, i) => (mask >> i) & 1).map((d) => d.id),
);
const CELLS = SUBSETS.flatMap((ids) => ["5", "12", "x"].map((fret) => decorate(fret, ids)));

/** How the cells of a row are spaced and closed. None holds three rails in a row. */
const LAYOUTS: [string, (cell: string) => string][] = [
  ["one note, two rails each side", (c) => `--${c}--`],
  ["two notes, two rails", (c) => `--${c}--${c}--`],
  ["two notes, one rail", (c) => `-${c}-${c}-`],
  ["three notes, one rail", (c) => `-${c}-${c}-${c}-`],
  ["opening on the note", (c) => `${c}--${c}--`],
  ["closing on the note", (c) => `--${c}--${c}`],
  ["note, rail, note", (c) => `${c}-${c}`],
];

const stored = (reading: ReturnType<typeof readTab>) =>
  reading.kind === "ready"
    ? reading.clipboard.columns.reduce((n, c) => n + Object.keys(c.frets).length, 0)
    : null;

/** NOTE F62's edge: a word of two letters or more with no rail at either end, as `xb-xb` is. */
function declaredEdge(row: string) {
  return !/^-|-$/.test(row) && /(?<![\p{L}\p{N}])\p{L}{2,}(?![\p{L}\p{N}])/u.test(row);
}

function sweep(system: (row: string) => string, notes: (row: string) => number) {
  const lost: string[] = [];
  let tried = 0;
  for (const cell of CELLS) {
    for (const [, layout] of LAYOUTS) {
      const row = layout(cell);
      if (row.includes("---") || declaredEdge(row)) continue;
      tried += 1;
      const total = stored(readTab(`${system(row)}\n\n${GOOD}`, context));
      if (total !== null && total < notes(row) + GOOD_NOTES) lost.push(row);
    }
  }
  return { lost, tried };
}

const cellsIn = (row: string) => row.split(/-+/).filter((s) => s !== "").length;

describe("INV-006 INV-009 no cell of the notation is lost with its row", () => {
  it("a note row over three rails-only rows", () => {
    const { lost, tried } = sweep((row) => {
      const rails = "-".repeat(row.length);
      return [row, rails, rails, rails].join("\n");
    }, cellsIn);
    process.stderr.write(`over rails: ${tried} rows, ${lost.length} lost, as ${lost.slice(0, 14).join("   ")}\n`);
    expect(tried).toBeGreaterThan(500);
    expect(lost.slice(0, 12)).toEqual([]);
  });

  it("the same row four deep", () => {
    const { lost, tried } = sweep((row) => [row, row, row, row].join("\n"), (row) => cellsIn(row) * 4);
    process.stderr.write(`four deep: ${tried} rows, ${lost.length} lost, as ${lost.slice(0, 14).join("   ")}\n`);
    expect(tried).toBeGreaterThan(500);
    expect(lost.slice(0, 12)).toEqual([]);
  });

  it("alone, such a system is a staff, and is not told no tab was found", () => {
    const parsed = parseTab("--(5)--(7)--\n------------\n------------\n------------");
    const codes = parsed.ok ? [] : parsed.refusals.map((r) => r.code);
    expect(codes).not.toContain("no-staff");
  });

  it("the wild tab spec.md names: ghost notes in brackets", () => {
    const paste = `--(5)--(7)--\n------------\n------------\n------------\n\n${GOOD}`;
    const reading = readTab(paste, context);
    const total = stored(reading);
    // Refused, or all five notes.
    expect({ total: total === null ? 5 : total }).toEqual({ total: 5 });
  });
});
