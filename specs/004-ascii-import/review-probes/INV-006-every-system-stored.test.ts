/**
 * Round 7. INV-006 by system. Six rounds asked of one block: is this line a row of it, and does each
 * note on the row reach the store? Nobody asked whether every block is found. A block only starts
 * from a line S1 to S4 claims, and S5 only grows one. A system none of whose lines is claimed never
 * starts, so in a paste with another system it is commentary, and the paste reads without it.
 *
 * Every row shape × every rail spacing × rows with and without outer rails × which rows are busy ×
 * separator × which system of two or three, through the real `readTab`. Each paste must either
 * refuse, or store every note of every system. The ledger counts notes, so it needs no second reader.
 */
import { describe, expect, it } from "vitest";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const context = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };
const LABELS = ["G", "D", "A", "E"];

const SHAPES: [string, (label: string, body: string) => string][] = [
  ["the app's", (l, b) => `${l} |${b}|`],
  ["flush label and pipes", (l, b) => `${l}|${b}|`],
  ["flush label, opening pipe only", (l, b) => `${l}|${b}`],
  ["pipes, no label", (_l, b) => `|${b}|`],
  ["opening pipe only", (_l, b) => `|${b}`],
  ["closing pipe only", (_l, b) => `${b}|`],
  ["label, then the body", (l, b) => `${l}${b}`],
  ["label, a rail, the body", (l, b) => `${l}-${b}`],
  ["label, a space, the body", (l, b) => `${l} ${b}`],
  ["label, a space, a rail, the body", (l, b) => `${l} -${b}`],
  ["bare rails", (_l, b) => b],
  ["bare rails in a gutter", (_l, b) => `   ${b}`],
];

/** A note every `gap + 1` characters, with `outer` rails at each end. */
const busy = (gap: number, outer: number, notes: readonly string[]) => {
  const edge = "-".repeat(outer);
  return `${edge}${notes.join("-".repeat(gap))}${edge}`;
};

const GAPS = [1, 2, 3, 4];
/** Whether a row opens and closes on rails, as most do, or on its first and last notes. */
const OUTER = [true, false];
const WHICH: [string, number[]][] = [
  ["one row busy, top", [0]],
  ["one row busy, bottom", [3]],
  ["two rows busy", [1, 2]],
  ["every row busy", [0, 1, 2, 3]],
];
const SEPARATORS: [string, string[]][] = [
  ["a blank line", [""]],
  ["two blank lines", ["", ""]],
  ["a lyric", ["we were never here at all"]],
  ["a blank, a lyric, a blank", ["", "we were never here at all", ""]],
];

function system(
  shape: (l: string, b: string) => string,
  gap: number,
  outer: number,
  rows: number[],
  notes: string[],
) {
  const body = busy(gap, outer, notes);
  return LABELS.map((l, i) => shape(l, rows.includes(i) ? body : "-".repeat(body.length)));
}

/** The notes a reading stores, each merged pass counted as the column it was drawn from. */
function count(reading: Extract<ReturnType<typeof readTab>, { kind: "ready" }>) {
  let notes = 0;
  for (const column of reading.clipboard.columns) notes += Object.keys(column.frets).length * column.repeat;
  return notes;
}

describe("INV-006 every system of a paste is stored, or the paste refuses", () => {
  it.each(SHAPES)("%s, beside every other shape", (name, shape) => {
    const lost: string[] = [];
    let read = 0;
    let refused = 0;
    for (const [, other] of SHAPES) {
      for (const gap of GAPS) {
        for (const outer of OUTER) {
          for (const [which, rows] of WHICH) {
            for (const [between, separator] of SEPARATORS) {
              for (const total of [2, 3]) {
                for (let place = 0; place < total; place += 1) {
                  const systems = Array.from({ length: total }, (_, k) =>
                    k === place
                      ? system(shape, gap, outer ? gap : 0, rows, ["3", "5", "3", "7"])
                      : system(other, 3, 3, [0, 2], ["5", "7", "9"]),
                  );
                  const text = systems.map((s) => s.join("\n")).join(`\n${separator.join("\n")}\n`);
                  const reading = readTab(text, context);
                  if (reading.kind !== "ready") {
                    refused += 1;
                    continue;
                  }
                  read += 1;
                  const want = rows.length * 4 + (total - 1) * 2 * 3;
                  if (count(reading) !== want) {
                    lost.push(
                      `[${which}, gap ${gap}, outer ${outer}, ${between}, system ${place + 1} of ${total}, stored ${count(reading)} of ${want}]\n${text}`,
                    );
                  }
                }
              }
            }
          }
        }
      }
    }
    process.stderr.write(`${name}: ${read} read, ${refused} refused, ${lost.length} lost notes\n`);
    if (lost.length > 0) process.stderr.write(`${lost[0]}\n`);
    expect(read + refused).toBeGreaterThan(100);
    expect(lost.slice(0, 5)).toEqual([]);
  });
});

const SYSTEM = "---5---7---5---\n---------------\n---------------\n---------------";

describe("INV-006 the shape as a person types it", () => {
  // A refusal is safe and reading every note is better. Reading some of them is the defect.
  const outcome = (text: string, notes: number) => {
    const reading = readTab(text, context);
    if (reading.kind !== "ready") return "safe";
    return count(reading) === notes ? "safe" : `stored ${count(reading)} of ${notes}`;
  };

  it.each<[string, string, number]>([
    ["a bass line on one row, second", `${SYSTEM}\n\n-----------\n-----------\n-----------\n-3-3-5-5-3-`, 8],
    ["the same, first, so the part opens late", `-----------\n-----------\n-----------\n-3-3-5-5-3-\n\n${SYSTEM}`, 8],
    ["two rails between notes", `${SYSTEM}\n\n--------------\n--------------\n--------------\n--3--3--5--5--`, 7],
    ["every row busy", `${SYSTEM}\n\n-5-7-5-7-\n-5-7-5-7-\n-3-5-3-5-\n-3-5-3-5-`, 19],
    ["dead notes", `${SYSTEM}\n\n-------\n-------\n-------\n-x-x-x-`, 6],
    ["no rail at either end of the row", `${SYSTEM}\n\n-------\n-------\n-------\n3-5-3-7`, 7],
    ["only such a system", "-----------\n-----------\n-----------\n-3-3-5-5-3-", 5],
  ])("%s", (_name, text, notes) => {
    expect(outcome(text, notes)).toBe("safe");
  });
});

describe("INV-010 a line that holds no staff stays commentary beside one", () => {
  it.each(["1-2-3-4", "3-4", "12-16", "1-4", "2/4", "x2", "4/4", "1 - 4"])("%s, on its own line", (line) => {
    const reading = readTab(`${SYSTEM}\n\n${line}\n\n${SYSTEM}`, context);
    expect(reading.kind === "ready" ? reading.ignored.map((n) => n.text) : reading.kind).toEqual([line]);
  });
});
