/**
 * Round 8. INV-006 and INV-009 by system, on what opens a row and what its rails are. Round 7's
 * matrix held the row shapes to twelve, all spelled with a plain hyphen and a bare note name, and
 * T087's rule closed exactly those. This asks the same question of every way a row can open, every
 * character it can use for a rail, and a double-spaced paste: does a system go missing while the
 * paste reads?
 *
 * Each paste must refuse, or store every note. Counting notes needs no second reader.
 */
import { describe, expect, it } from "vitest";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const context = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };
const NAMES = ["G", "D", "A", "E"];

/** How a row opens, from its string's name and its number. */
const OPENINGS: [string, (name: string, number: number) => string][] = [
  ["nothing", () => ""],
  ["a gutter", () => "   "],
  ["name", (n) => n],
  ["name, space", (n) => `${n} `],
  ["name, colon", (n) => `${n}:`],
  ["name, colon, space", (n) => `${n}: `],
  ["name, close bracket", (n) => `${n})`],
  ["name, close bracket, space", (n) => `${n}) `],
  ["name, full stop", (n) => `${n}.`],
  ["name, full stop, space", (n) => `${n}. `],
  ["name, equals", (n) => `${n}=`],
  ["name, greater than", (n) => `${n}>`],
  ["name in brackets", (n) => `(${n})`],
  ["name in square brackets", (n) => `[${n}]`],
  ["name in square brackets, space", (n) => `[${n}] `],
  ["number", (_n, k) => `${k}`],
  ["number, space", (_n, k) => `${k} `],
  ["number, colon", (_n, k) => `${k}:`],
  ["number, colon, space", (_n, k) => `${k}: `],
  ["number, close bracket", (_n, k) => `${k})`],
  ["number, close bracket, space", (_n, k) => `${k}) `],
  ["number, full stop", (_n, k) => `${k}.`],
  ["number, full stop, space", (_n, k) => `${k}. `],
  ["s and number, space", (_n, k) => `s${k} `],
  ["s and number, colon", (_n, k) => `s${k}:`],
  ["a long word", () => "Guitar"],
  ["the word string", (n) => `${n} string `],
  ["the word string, colon", (n) => `${n} string: `],
];

/** The character a row uses for its rails. */
const RAILS: [string, string][] = [
  ["hyphen", "-"],
  ["em dash", "—"],
  ["en dash", "–"],
  ["minus sign", "−"],
];

const CLOSINGS: [string, string][] = [
  ["nothing", ""],
  ["a pipe", "|"],
];

/** A pipe between whatever opens the row and its body. */
const PIPES: [string, string][] = [
  ["no pipe", ""],
  ["a pipe", "|"],
];

/** Rows on touching lines, or a blank line between each, as a double-spaced paste has. */
const SPACINGS: [string, string][] = [
  ["single", "\n"],
  ["double", "\n\n"],
];

const GAPS = [1, 2, 3, 4];
const WHICH: [string, number[]][] = [
  ["top row busy", [0]],
  ["bottom row busy", [3]],
  ["every row busy", [0, 1, 2, 3]],
];
const SEPARATORS: [string, string[]][] = [
  ["a blank line", [""]],
  ["a lyric", ["we were never here at all"]],
];

const GOOD = "G |---5---7---|\nD |-----------|\nA |-----------|\nE |---9-------|";
const GOOD_NOTES = 3;
const NOTES = ["3", "5", "3", "7"];

function count(reading: Extract<ReturnType<typeof readTab>, { kind: "ready" }>) {
  let notes = 0;
  for (const column of reading.clipboard.columns) notes += Object.keys(column.frets).length * column.repeat;
  return notes;
}

/**
 * The two shapes no rule can claim without refusing commentary the spec keeps. A row holding a word
 * with a note at both ends reads as prose (review NOTE F62), as `Verse 2 - 3` does. A lone line of
 * only numbers and hyphens is `1-2-3-4`, which round 7 pinned as commentary, so it needs a line
 * touching it that holds a rail too.
 */
function declaredEdge(row: string, alone: boolean) {
  const t = row.trim();
  const pipeTouches = /\|[-—–−0-9xX]|[-—–−0-9xX]\|/.test(t);
  const rimmed = /^[-—–−|]|[-—–−|]$/.test(t);
  const word = /(?<![\p{L}\p{N}])\p{L}{2,}(?![\p{L}\p{N}])/u.test(t);
  if (word && !rimmed && !pipeTouches) return true;
  return alone && !rimmed && /^[\dx\s./:-]+$/.test(t);
}

function sweep() {
  const lost = new Map<string, { n: number; sample: string }>();
  let pastes = 0;
  let read = 0;
  for (const [opening, open] of OPENINGS) {
    for (const [rail, r] of RAILS) {
      for (const [closing, close] of CLOSINGS) {
        for (const [piped, pipe] of PIPES) {
          for (const [spacing, between] of SPACINGS) {
            for (const gap of GAPS) {
              for (const outer of [0, gap]) {
                for (const [which, rows] of WHICH) {
                  const edge = r.repeat(outer);
                  const body = `${edge}${NOTES.join(r.repeat(gap))}${edge}`;
                  const empty = r.repeat(body.length);
                  const mine = NAMES.map(
                    (name, k) => `${open(name, k + 1)}${pipe}${rows.includes(k) ? body : empty}${close}`,
                  ).join(between);
                  for (const [, separator] of SEPARATORS) {
                    for (const first of [true, false]) {
                      const middle = `\n${separator.join("\n")}\n`;
                      const text = first ? `${mine}${middle}${GOOD}` : `${GOOD}${middle}${mine}`;
                      if (declaredEdge(mine.split(between)[rows[0]], spacing === "double")) continue;
                      pastes += 1;
                      const reading = readTab(text, context);
                      if (reading.kind !== "ready") continue;
                      read += 1;
                      const want = rows.length * NOTES.length + GOOD_NOTES;
                      if (count(reading) === want) continue;
                      const key = `${opening} / ${rail} / ${piped} / closing on ${closing} / ${spacing}`;
                      const seen = lost.get(key);
                      if (seen) seen.n += 1;
                      else lost.set(key, { n: 1, sample: `[${which}, stored ${count(reading)} of ${want}]\n${text}` });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return { lost, pastes, read };
}

describe("INV-006 every system of a paste is stored, whatever opens its rows", () => {
  it("no paste reads with a system missing", () => {
    const { lost, pastes, read } = sweep();
    const total = [...lost.values()].reduce((n, l) => n + l.n, 0);
    process.stderr.write(`${pastes} pastes, ${read} read, ${total} lost notes, in ${lost.size} shapes\n`);
    for (const [key, { n }] of [...lost].sort((a, b) => b[1].n - a[1].n)) {
      process.stderr.write(`  ${String(n).padStart(4)}  ${key}\n`);
    }
    const first = [...lost.values()][0];
    if (first) process.stderr.write(`${first.sample}\n`);
    expect([...lost.keys()].slice(0, 12)).toEqual([]);
  }, 120_000);
});

const SYSTEM = "G |---5---7---|\nD |-----------|\nA |-----------|\nE |---9-------|";

describe("INV-006 the shape as a person types it", () => {
  // A refusal is safe and reading every note is better. Reading some of them is the defect.
  const outcome = (text: string, notes: number) => {
    const reading = readTab(text, context);
    if (reading.kind !== "ready") return "safe";
    return count(reading) === notes ? "safe" : `stored ${count(reading)} of ${notes}`;
  };

  it.each<[string, string, number]>([
    ["colons, two rails", `e:--3--5--3--\nB:------------\nG:------------\nD:------------\n\n${SYSTEM}`, 6],
    ["colons and both pipes", `E:|--3--5--3--7--|\nE:|--------------|\nE:|--------------|\nE:|--------------|\n\n${SYSTEM}`, 7],
    ["a long word and both pipes", `Guitar|--3--5--3--7--|\nGuitar|--------------|\nGuitar|--------------|\nGuitar|--------------|\n\n${SYSTEM}`, 7],
    ["double spaced, colons", `G:-3-5-3-\n\nD:-------\n\nA:-------\n\nE:-------\n\n${SYSTEM}`, 6],
    ["a lone row of long dashes", `${SYSTEM}\n\n———5———7———\n`, 5],
    ["a lone row of minus signs", `${SYSTEM}\n\n−−−5−−−7−−−\n`, 5],
    ["minus signs, every row", `−−−5−−−7−−−\n−−−−−−−−−−−\n−−−−−−−−−−−\n−−−−−−−−−−−\n\n${SYSTEM}`, 5],
  ])("%s", (_name, text, notes) => {
    expect(outcome(text, notes)).toBe("safe");
  });
});

describe("INV-010 the commentary a wider rule must leave alone", () => {
  // None of these may refuse beside a system, whatever closes F70. Round 7 pinned the first eight.
  it.each([
    "1-2-3-4",
    "3-4",
    "12-16",
    "1-4",
    "2/4",
    "x2",
    "4/4",
    "1 - 4",
    "1 - 2 - 3 - 4",
    "Verse 2 - Chorus",
    "Capo 2 - tuned down",
    "BPM: 120 - 4/4",
    "Bars 1-4",
    // Lines where a rail stands apart from any note. T082 refuses these only beside a block.
    "Am7 - D7",
    "G7 - C",
    "3/4 - 6/8",
    "-- Verse 2 --",
    "Verse 1 -",
    "- 2nd time: slide up",
    "x2 -",
    "- x2",
    "(x2) -",
    "A x2 - B",
    "1st time -",
    "Capo: 2 -",
    "6/8 -",
    "x-x",
  ])("%s", (line) => {
    const reading = readTab(`${SYSTEM}\n\n${line}\n\n${SYSTEM}`, context);
    expect(reading.kind).toBe("ready");
    if (reading.kind === "ready") expect(reading.ignored.map((n) => n.text)).toContain(line);
  });
});
