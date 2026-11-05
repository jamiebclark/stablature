/**
 * Round 3. INV-006: never is a row with anything on it dropped, moved, or put on another string.
 *          INV-009: never does a line that may be a damaged staff row become commentary.
 *
 * Round 2 widened the row shapes to the notation's own characters. This holds the rest of what a
 * damaged row can be: one character the notation lacks, or one space, in a row with short rails.
 * `-5s7-5-7-` is the unlabelled twin of INV-009's own sample `G-5s7-`.
 *
 * The oracle is the spec's. One row more than the song has strings leaves a tidy staff behind when
 * the damaged row goes, so a `ready` here is a silent shift (top) or a lost row (bottom).
 */
import { describe, expect, it } from "vitest";
import { readTab, type TabReading } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const PRESETS: [string, number][] = [
  ["bass4-e", 4],
  ["bass5-b", 5],
  ["guitar6-e", 6],
];

const ctx = (id: string) => ({ tuning: presetById(id)!, bandTunings: [], songEvents: [] });

const plain = "---5---7---";

const verdict = (r: TabReading) =>
  r.kind === "ready" ? `ready, ignored ${JSON.stringify(r.ignored.map((n) => n.text))}` : r.kind;

/** A character the notation lacks, inside a row with no run of three rails. */
const ONE_CHARACTER: [string, string][] = [
  ["`s` for a slide", "-5s7-5-7-"],
  ["a question mark", "-5?7-5-7-"],
  ["a full stop", "-5.7-5-7-"],
  ["a comma", "-5,7-5-7-"],
  ["an asterisk", "-5*7-5-7-"],
  ["a plus", "-5+7-5-7-"],
  ["an equals", "-5=7-5-7-"],
  ["an underscore", "-5_7-5-7-"],
  ["a colon", "-5:7-5-7-"],
];

const ONE_SPACE: [string, string][] = [
  ["a space between notes", "-5 7-5-7-"],
  ["a space in two rails", "--5 7--"],
  ["a space between rails", "-5-7- -5-"],
];

const OTHER_DASHES: [string, string][] = [
  ["U+2212 minus signs", "−5−7−5−7−"],
  ["U+2011 non-breaking hyphens", "‑5‑7‑5‑7‑"],
  ["U+2500 box rules", "─5─7─5─7─"],
];

for (const [title, set] of [
  ["one character the notation lacks", ONE_CHARACTER],
  ["one space", ONE_SPACE],
  ["a dash that is neither a rail nor a long dash", OTHER_DASHES],
] as const) {
  describe(`INV-006 INV-009 ${title}, at the edge of an unlabelled block`, () => {
    for (const [name, bad] of set) {
      for (const [preset, strings] of PRESETS) {
        const rest = Array.from({ length: strings }, () => plain);
        it(`${name}, on top of ${strings} rows`, () => {
          const r = readTab([bad, ...rest].join("\n"), ctx(preset));
          expect(verdict(r)).toBe("refused");
        });
        it(`${name}, under ${strings} rows`, () => {
          const r = readTab([...rest, bad].join("\n"), ctx(preset));
          expect(verdict(r)).toBe("refused");
        });
      }
    }
  });
}

/** A labelled row whose label is damaged: the row under a tidy labelled block is the one lost. */
describe("INV-006 INV-009 a damaged label under a tidy block on a five-string song", () => {
  const LABELLED: [string, string][] = [
    ["a colon after the label", "B:-5-7-5-7-"],
    ["a bracket after the label", "B)-5-7-5-7-"],
    ["a full stop after the label", "B.-5-7-5-7-"],
    ["a space and no rail", "B 5-7-5-7-"],
  ];
  const tidy = ["G|---5---|", "D|---5---|", "A|---3---|", "E|---3---|"];
  for (const [name, bad] of LABELLED) {
    it(name, () => {
      const r = readTab([...tidy, bad].join("\n"), ctx("bass5-b"));
      expect(verdict(r)).toBe("refused");
    });
  }
});

/**
 * Two one-cell rows a note-name label leaves behind. `E-x` has no digit or second rail, so S3 passes
 * it by. `C-9` reads as a chord, and reader.md section 4 says a lone symbol at offset 0 is no chord
 * row and falls through to the staff tests, but `readsAsChords` has no such guard.
 */
describe("INV-006 INV-009 a one-cell labelled row is never commentary", () => {
  it("a dead note on the bottom row", () => {
    const text = ["G-5", "D-3", "A-3", "E-x"].join("\n");
    expect(verdict(readTab(text, ctx("bass4-e")))).toBe("refused");
  });
  it("a dead note under piped rows", () => {
    const text = ["G|---5---|", "D|-------|", "A|-------|", "E-x"].join("\n");
    expect(verdict(readTab(text, ctx("bass4-e")))).toBe("refused");
  });
  it("a top row that spells a chord, on a tuning with one string fewer", () => {
    const text = ["C-9", "G-5", "D-8", "A-4", "E-3", "B-1"].join("\n");
    expect(verdict(readTab(text, ctx("bass5-b")))).toBe("refused");
  });
});

/**
 * Guards. Refusal is the safe side, so the easy fix is to refuse everything touching a staff. These
 * are the lines Story 2 and INV-010 need to stay commentary, and a fix must keep them.
 */
describe("INV-010 guard: commentary touching a staff stays commentary", () => {
  const COMMENTARY = [
    "Verse 2",
    "Chorus x2",
    "Intro (x2)",
    "[Verse 2]",
    "Capo 2",
    "Take 5",
    "120 bpm",
    "1   2   3   4",
    "riff",
    "A-men",
    "E-Bow",
    "P.M.----|",
    "I walk alone tonight",
  ];
  const BLOCKS: [string, string[]][] = [
    ["labelled", ["G|---5---|", "D|---5---|", "A|---3---|", "E|---3---|"]],
    ["unlabelled", ["---5---", "---5---", "---3---", "---3---"]],
  ];
  for (const line of COMMENTARY) {
    for (const [name, rows] of BLOCKS) {
      for (const [where, lines] of [
        ["above", [line, ...rows]],
        ["below", [...rows, line]],
      ] as const) {
        it(`${JSON.stringify(line)} ${where} a ${name} block`, () => {
          const r = readTab(lines.join("\n"), ctx("bass4-e"));
          expect(r.kind === "ready" ? r.ignored.map((n) => n.text) : r.kind).toEqual([line]);
        });
      }
    }
  }
});
