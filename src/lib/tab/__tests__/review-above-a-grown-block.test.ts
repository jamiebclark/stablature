/**
 * Round 4. INV-015: never does a chord land on the wrong column. INV-016: never does a group differ
 * from its bracket. INV-010: never is commentary read as something else. FR-007, FR-008, FR-013.
 *
 * The chord and bracket tests run on the way up, when the line below is already a staff row. S5 runs
 * after that, so a block's top row can join late, and the line above it has already had its only
 * chance of being a chord or a bracket row. S5 then asks whether that line is a row.
 *
 * The oracle needs no opinion about tab. The same chord or bracket line above the same notes must
 * read the same whether the top row spells its rails `---5---` or `-5-7-5-`.
 */
import { describe, expect, it } from "vitest";
import { readTab, type TabReading } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const ctx = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };

const REST = ["---3---5---", "---3---5---", "---3---5---"];

const held = (r: TabReading) =>
  r.kind === "ready"
    ? {
        chords: r.clipboard.annotations.map((a) => a.value),
        groups: r.clipboard.columns.filter((c) => c.tupletGroup !== null).length,
      }
    : r.kind === "refused"
      ? r.refusals.map((x) => `${x.line} ${x.code}`)
      : r.kind;

/** Top rows that S1 to S4 do not claim, each with the same notes as the long form beside it. */
const TOPS: [string, string][] = [
  ["a busy top row", "-5-7-5-7-5-"],
  ["a row of rails", "-----------"],
];

const CHORDS = ["  C#7", "  F#7   A7", "  G7/B", "  D7/F#", "  A7#9", "  F#5"];

describe("INV-015 a chord row with a mark beside a digit, above a top row S5 grew", () => {
  for (const [name, top] of TOPS) {
    for (const chord of CHORDS) {
      it(`${JSON.stringify(chord)} above ${name}`, () => {
        const r = held(readTab([chord, top, ...REST].join("\n"), ctx));
        expect(r).toMatchObject({ chords: chord.trim().split(/\s+/) });
      });
    }
  }
});

const BRACKETS = [" ,-3-,", " ,---3---,", " 3,"];

/** Placed or refused for placement: a bracket line is never a staff row. */
const asRow = (r: TabReading) =>
  r.kind === "refused" ? r.refusals.map((x) => x.code).filter((c) => c !== "bracket-placement") : [];

describe("INV-016 a bracket row above a top row S5 grew", () => {
  it.each(BRACKETS)("%s", (bracket) => {
    const rows = ["-5-7-5-7-5-", ...REST];
    expect(asRow(readTab([bracket, ...rows].join("\n"), ctx))).toEqual([]);
  });
});

describe("INV-010 a chord line under a block is still not a note row", () => {
  it.each(["Am7/G", "D7/F#", "C#7 F#7"])("%s under four labelled rows", (line) => {
    const rows = ["G|---5---|", "D|---5---|", "A|---3---|", "E|---3---|"];
    const r = readTab([...rows, line].join("\n"), ctx);
    expect(r.kind === "ready" ? r.ignored.map((n) => n.text) : held(r)).toEqual([line]);
  });
});
