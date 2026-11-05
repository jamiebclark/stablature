/**
 * Round 10. T091 made a row of wrapped cells claimed, so F78's paste no longer loses a system. Every
 * round 9 probe accepts a refusal as a fix, so none says whether valid notation now reads. This
 * asserts what the spec owes: valid cells on a staff read, and every note reaches the clipboard.
 * F78's own paste sets an unlabelled system beside a labelled one, which is `systems-differ` for
 * any cell at all, bare digits included, so the second system here is unlabelled.
 */
import { describe, expect, it } from "vitest";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const context = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };
const RAILS = "------------";
const UNLABELLED = ["---5---7---", "-----------", "-----------", "---9-------"].join("\n");

const notes = (r: ReturnType<typeof readTab>) =>
  r.kind === "ready" ? r.clipboard.columns.reduce((n, c) => n + Object.keys(c.frets).length, 0) : null;
const say = (r: ReturnType<typeof readTab>) =>
  r.kind === "refused" ? r.refusals.map((f) => `${f.line}:${f.code}`).join(" ") : `${r.kind} notes=${notes(r)}`;

const system = (row: string) => [row, RAILS, RAILS, RAILS].join("\n");

const PASTES: [string, string, number][] = [
  ["the wrapped system alone", system("--(5)--(7)--"), 2],
  ["ghost notes beside an unlabelled system", `${system("--(5)--(7)--")}\n\n${UNLABELLED}`, 5],
  ["harmonics beside an unlabelled system", `${system("--<5>--<7>--")}\n\n${UNLABELLED}`, 5],
  ["tapped and bent beside an unlabelled system", `${system("--t5b--t7b--")}\n\n${UNLABELLED}`, 5],
];

describe("INV-006 wrapped rows read", () => {
  it.each(PASTES)("%s", (name, text, expected) => {
    const r = readTab(text, context);
    process.stderr.write(`${name}: ${say(r)}\n`);
    expect(notes(r)).toBe(expected);
  });

  it("an unlabelled system beside a labelled one refuses for any cell, so F78's paste is not about cells", () => {
    const labelled = "G |---5---7---|\nD |-----------|\nA |-----------|\nE |---9-------|";
    for (const row of ["--(5)--(7)--", "--5--7--"]) {
      const r = readTab(`${system(row)}\n\n${labelled}`, context);
      expect(r.kind).toBe("refused");
      expect(say(r)).toContain("systems-differ");
    }
  });
});
