/**
 * Round 2. INV-006: never is a row with anything on it dropped, moved to another position, or
 *                   imported onto a string of another name.
 *          INV-009: never does a line that may be a damaged staff row become commentary.
 *
 * Round 1's probes held one row shape, `---5---`. This runs every unlabelled row shape a block can
 * have, an empty or damaged row at every position, on 4, 5 and 6 strings. The oracle is the spec's:
 * a reading that is `ready` must have every filled row's note on its own row's key, and no other.
 */
import { describe, expect, it } from "vitest";
import { draftPart } from "@/lib/local/clipboard";
import { readTab, type TabReading } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const PRESETS: [string, number][] = [
  ["bass4-e", 4],
  ["bass5-b", 5],
  ["guitar6-e", 6],
];

/** A row shape: how a filled row and an empty row of that shape are written. */
interface Shape {
  name: string;
  filled: (fret: number) => string;
  empty: string;
  /** What fret the row stores for `fret`. */
  stored?: (fret: number) => number;
}

const SHAPES: Shape[] = [
  { name: "rails around the note", filled: (f) => `---${f}---`, empty: "-------" },
  { name: "the note opens the row", filled: (f) => `${f}------`, empty: "-------" },
  {
    name: "a two-digit note opens the row",
    filled: (f) => `1${f}-----`,
    empty: "-------",
    stored: (f) => 10 + f,
  },
  { name: "the note closes the row", filled: (f) => `------${f}`, empty: "-------" },
  { name: "a barline in the row", filled: (f) => `---${f}---|-------`, empty: "-------|-------" },
  { name: "a closing pipe only", filled: (f) => `---${f}---|`, empty: "-------|" },
  {
    name: "barlines and a closing pipe",
    filled: (f) => `---${f}---|-------|`,
    empty: "-------|-------|",
  },
];

const ctx = (id: string) => ({ tuning: presetById(id)!, bandTunings: [], songEvents: [] });

/** The first note column's frets, or null when the reading is not ready. */
function firstFrets(r: TabReading): Record<string, unknown> | null {
  if (r.kind !== "ready") return null;
  return draftPart(r.clipboard).events.find((e) => e.kind === "notes")?.frets ?? null;
}

/** Rows top down, with the empty row at position `at` and frets 1, 2, 3... on the rest. */
function block(shape: Shape, count: number, at: number) {
  const rows: string[] = [];
  const expected: Record<string, number> = {};
  for (let k = 0; k < count; k += 1) {
    if (k === at) {
      rows.push(shape.empty);
    } else {
      rows.push(shape.filled(k + 1));
      expected[String(k)] = shape.stored ? shape.stored(k + 1) : k + 1;
    }
  }
  return { rows, expected };
}

describe("INV-006 rows equal strings, one empty row: every note on its own row", () => {
  for (const shape of SHAPES) {
    for (const [preset, count] of PRESETS) {
      for (let at = 0; at < count; at += 1) {
        it(`${shape.name}, ${count} strings, empty row ${at + 1}`, () => {
          const { rows, expected } = block(shape, count, at);
          const r = readTab(rows.join("\n"), ctx(preset));
          expect(r.kind === "refused" ? r.refusals.map((x) => x.code) : r.kind).toBe("ready");
          expect(firstFrets(r)).toEqual(expected);
        });
      }
    }
  }
});

describe("INV-006 one row more than the song has strings: refused, never shifted", () => {
  for (const shape of SHAPES) {
    for (const [preset, strings] of PRESETS) {
      for (let at = 0; at <= strings; at += 1) {
        it(`${shape.name}, ${strings + 1} rows on ${strings} strings, empty row ${at + 1}`, () => {
          const { rows } = block(shape, strings + 1, at);
          const r = readTab(rows.join("\n"), ctx(preset));
          expect(
            r.kind === "refused" ? r.refusals[0].code : `ready ${JSON.stringify(firstFrets(r))}`,
          ).toBe("unlabelled-count");
        });
      }
    }
  }
});

/**
 * A damaged or busy row at the edge of a block is the one place it can leave a tidy staff behind:
 * the remaining rows then match the string count exactly. Each must stop the import.
 */
describe("INV-009 a row with notes on it at the edge of an unlabelled block is never commentary", () => {
  const DAMAGED: [string, string][] = [
    ["em dashes for rails", "———5———7———"],
    ["en dashes for rails", "–––5–––7–––"],
    ["em dashes round one note", "—5—"],
    ["some rails some dashes", "--—5—--7---"],
    ["a busy row with no run of three rails", "-5-7-5-7-5-"],
    ["a busy row that opens on a note", "5-7-5-7-5-7"],
  ];
  const plain = "---5---7---";
  for (const [name, bad] of DAMAGED) {
    for (const [preset, strings] of PRESETS) {
      it(`${name}, on top of ${strings} rows`, () => {
        const text = [bad, ...Array.from({ length: strings }, () => plain)].join("\n");
        expect(readTab(text, ctx(preset)).kind).toBe("refused");
      });
      it(`${name}, under ${strings} rows`, () => {
        const text = [...Array.from({ length: strings }, () => plain), bad].join("\n");
        expect(readTab(text, ctx(preset)).kind).toBe("refused");
      });
    }
  }
});

/** What a fix must not do: each of these is commentary in the spec and the plan. */
describe("guard: commentary stays commentary beside a block", () => {
  const rows = ["---5---", "---7---", "---9---", "---3---"].join("\n");
  it.each([
    ["a lyric above", "and the words go here"],
    ["a beat count above", "1   2   3   4"],
    ["P.M. with rails above", "P.M.----|"],
    ["a word and a hyphen above", "A-men"],
    ["a section mark above", "[Verse]"],
  ])("%s", (_name, line) => {
    const r = readTab(`${line}\n${rows}`, ctx("bass4-e"));
    expect(r.kind).toBe("ready");
    expect(r.kind === "ready" && r.ignored.map((i) => i.line)).toEqual([1]);
    expect(firstFrets(r)).toEqual({ 0: 5, 1: 7, 2: 9, 3: 3 });
  });
});
