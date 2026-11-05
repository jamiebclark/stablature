/**
 * Round 4. INV-010: never is commentary lost, read as notes or refused as a row. FR-016.
 *
 * `INV-010-touching-a-staff` holds prose. These hold no word at all, so a test for words cannot save
 * them: a time signature, an ending mark, a timestamp. None is S1 to S4, so the spec calls each one
 * commentary. `4/4` is the sharpest: it spells a legal slide, and only the absence of a rail says it
 * is not a row. A row with no rail and no pipe is no staff row in the spec's table.
 */
import { describe, expect, it } from "vitest";
import { readTab, type TabReading } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const ctx = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };

const verdict = (r: TabReading) =>
  r.kind === "ready"
    ? r.ignored.map((n) => n.text)
    : r.kind === "refused"
      ? r.refusals.map((x) => `${x.line} ${x.code}`)
      : r.kind;

const BLOCKS: [string, string[]][] = [
  ["labelled", ["G|---5---|", "D|---5---|", "A|---3---|", "E|---3---|"]],
  ["unlabelled", ["---5---", "---5---", "---3---", "---3---"]],
];

const MARKS = ["4/4", "3/4", "6/8", "12/8", "1.", "2.", "0:32", "1:05"];

describe("INV-010 a mark with no word in it stays commentary", () => {
  for (const line of MARKS) {
    for (const [name, rows] of BLOCKS) {
      it(`${line} above a ${name} block`, () => {
        expect(verdict(readTab([line, ...rows].join("\n"), ctx))).toEqual([line]);
      });
      it(`${line} below a ${name} block`, () => {
        expect(verdict(readTab([...rows, line].join("\n"), ctx))).toEqual([line]);
      });
    }
  }
});
