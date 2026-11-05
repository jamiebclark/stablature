/**
 * Round 8. INV-006 and INV-009 with no list of shapes at all. Every line up to LINE_LONGEST
 * characters over an alphabet of rails, pipes, notes, label marks and a letter, set beside a good
 * system two ways: four deep, as a system of its own, and alone between two systems. A line where
 * a note touches a rail or pipe may not be ignored while the paste reads.
 *
 * Three shapes are the rule's declared edge, and only those may be ignored: a word of two or more
 * letters with no rail or pipe at either end (review NOTE F62); a line whose every token is a chord
 * symbol, as `E− E5` is; and, alone, a line of only numbers, `x` and hyphens with no rail at either
 * end, which is `1-2-3-4`. A note that touches no rail, as in `5 -`, is not asked about at all: a
 * rail standing apart is how prose writes `Am7 - D7`.
 *
 * LINE_LONGEST=5 is what the review ran. The default keeps it to a few seconds.
 */
import { describe, expect, it } from "vitest";
import { parseChord } from "@/lib/chords";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const context = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };
const LONGEST = Number(process.env.LINE_LONGEST ?? 4);
const ALPHABET = [..."-—−|5x:E .()"];
const GOOD = "G |---5---7---|\nD |-----------|\nA |-----------|\nE |---9-------|";

function* lines(length: number, prefix = ""): Generator<string> {
  if (prefix.length === length) {
    yield prefix;
    return;
  }
  for (const c of ALPHABET) yield* lines(length, prefix + c);
}

const noteTouchesRail = (t: string) =>
  /[-—−|](5|x(?!\p{L}))|(5|(?<!\p{L})x)[-—−|]/u.test(t);
const rimmed = (t: string) => /^[-—−|]|[-—−|]$/.test(t);
const word = (t: string) => /(?<![\p{L}\p{N}])\p{L}{2,}(?![\p{L}\p{N}])/u.test(t);
const numbers = (t: string) => /^[\dx\s./:-]+$/.test(t);
const chords = (t: string) => t.split(/\s+/).every((k) => parseChord(k) !== null);

function sweep(paste: (line: string) => string, alone: boolean) {
  const lost: string[] = [];
  let tried = 0;
  for (let length = 1; length <= LONGEST; length += 1) {
    for (const line of lines(length)) {
      if (line !== line.trim() || !noteTouchesRail(line)) continue;
      if (word(line) && !rimmed(line)) continue;
      if (chords(line) && !rimmed(line)) continue;
      if (alone && numbers(line) && !rimmed(line)) continue;
      tried += 1;
      const reading = readTab(paste(line), context);
      if (reading.kind === "ready" && reading.ignored.some((n) => n.text === line)) lost.push(line);
    }
  }
  return { lost, tried };
}

describe("INV-006 INV-009 no line that holds a note and a rail is ignored", () => {
  it("four deep, as a system of its own", () => {
    const { lost, tried } = sweep((l) => `${[l, l, l, l].join("\n")}\n\n${GOOD}`, false);
    process.stderr.write(`four deep: ${tried} lines, ${lost.length} ignored, as ${lost.slice(0, 12).join("   ")}\n`);
    expect(tried).toBeGreaterThan(100);
    expect(lost.slice(0, 10)).toEqual([]);
  });

  it("alone, between two systems", () => {
    const { lost, tried } = sweep((l) => `${GOOD}\n\n${l}\n\n${GOOD}`, true);
    process.stderr.write(`alone: ${tried} lines, ${lost.length} ignored, as ${lost.slice(0, 12).join("   ")}\n`);
    expect(tried).toBeGreaterThan(100);
    expect(lost.slice(0, 10)).toEqual([]);
  });
});
