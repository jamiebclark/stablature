/**
 * Round 10, MINOR F80. reader.md section 2 says a pipe touching a rail or a note makes a row whatever
 * else the line holds, and T091 moved S6's unit from the digit to the cell. It kept the pipe rule on
 * the digit, as it was told to, so a pipe touching `(5)` touches nothing the rule knows. With a word
 * no S-test takes as a label and no rail at the line's far end, the line is prose. It is listed in
 * `ignored`, and it should refuse as its bare twin does. The failing cases here are expected until
 * F80 is fixed, as with the other MINOR probes.
 */
import { describe, expect, it } from "vitest";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const context = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };
const GOOD = ["---5---7---", "-----------", "-----------", "---9-------"].join("\n");

const kind = (line: string) => readTab(`${GOOD}\n\n${line}\n\n${GOOD}`, context).kind;

describe("INV-009 a pipe touching a cell is as good as a pipe touching a digit", () => {
  it.each(["Guitar|--3--5--", "Guitar|3--5", "Gtr:|3--5", "Gtr:|--(5)--(7)--"])("%s refuses today", (line) => {
    expect(kind(line)).toBe("refused");
  });

  it.each(["Guitar|(5)--(7)", "Gtr:|(5)--(7)", "Guitar|<12>-<14>", "Gtr:|t5-t7"])("%s refuses", (line) => {
    expect(kind(line)).toBe("refused");
  });

  it.each(["Guitar|(5)--(7)-", "Gtr:|(5)--(7)|", "Guitar|(5)---(7)"])("%s, with a rail at its far end or a run of three, refuses today", (line) => {
    expect(kind(line)).toBe("refused");
  });
});
