/**
 * Round 9. INV-006's "moved to another position". T089 made all four rail spellings agree in the
 * edge test of prose, but `isNotationOnly` and `HOLDS_RAIL` name three. A rails-only row keeps a
 * block's row count, so a row that goes uncounted moves every row below it up one string.
 *
 * Every spelling of an empty row × every position × 5 and 6 rows, read on a song with one string
 * fewer than the paste has rows, which is where a dropped row fits and nothing says so. The first
 * describe is the defect, review F74. The second is the boundary: lines the spec never called rails
 * stay commentary, as a divider above a staff should.
 */
import { describe, expect, it } from "vitest";
import { parseTab } from "@/lib/tab/parse";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";
import { eventsOf, imported, world } from "./unit-helpers";

const SPELLINGS: [string, string][] = [
  ["hyphen", "-"],
  ["em dash", "—"],
  ["en dash", "–"],
  ["minus sign", "−"],
];

const SONGS: [number, string][] = [
  [5, "bass4-e"],
  [6, "bass5-b"],
];

const NOTE = "---5---7---";
const WIDTH = NOTE.length;

/** `rows` unlabelled rows, the one at `at` spelled `rail`, and a note on the row after it. */
function paste(rows: number, at: number, rail: string) {
  const noted = at === 0 ? 1 : 0;
  const lines: string[] = [];
  for (let k = 0; k < rows; k += 1) {
    lines.push(k === at ? rail.repeat(WIDTH) : k === noted ? NOTE : "-".repeat(WIDTH));
  }
  return lines.join("\n");
}

const contextFor = (preset: string) => ({ tuning: presetById(preset)!, bandTunings: [], songEvents: [] });

describe("INV-006 an empty row is counted however it is spelled", () => {
  for (const [rows, preset] of SONGS) {
    for (const [name, rail] of SPELLINGS) {
      for (let at = 0; at < rows; at += 1) {
        it(`${rows} rows on ${preset}, ${name} at row ${at + 1}`, () => {
          const text = paste(rows, at, rail);
          const reading = readTab(text, contextFor(preset));
          const parsed = parseTab(text);
          const counted = reading.kind === "ready" && parsed.ok ? parsed.rows.length : rows;
          // Reading on fewer rows than were pasted means a row has gone, and the rest have moved.
          expect({ text, counted }).toEqual({ text, counted: rows });
        });
      }
    }
  }

  it("through the write: the note on the paste's second row is stored on the second string", async () => {
    const w = await world("bass4-e");
    const text = paste(5, 0, "−");
    const reading = readTab(text, contextFor("bass4-e"));
    if (reading.kind !== "ready") return; // Refused, which is a fix.
    const { part } = await imported(w, text);
    const keys = (await eventsOf(w, part.id)).flatMap((e) => Object.keys(e.frets));
    expect(new Set(keys)).toEqual(new Set(["1"]));
  });
});

describe("what is not a rail stays commentary, so a divider above a staff still reads", () => {
  it.each(["===========", "___________", "...........", "~~~~~~~~~~~", "***********", "- - - - - -"])("%s", (line) => {
    const rows = ["---5---7---", "-----------", "-----------", "-----------"].join("\n");
    const reading = readTab(`${line}\n${rows}`, contextFor("bass4-e"));
    expect(reading.kind).toBe("ready");
    if (reading.kind === "ready") expect(reading.ignored.map((l) => l.text)).toEqual([line]);
  });
});
