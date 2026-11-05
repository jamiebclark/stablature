/**
 * Round 4. INV-006: never is a row with anything on it dropped or moved. INV-009: never does a line
 * that may be a damaged staff row become commentary.
 *
 * `INV-006-009-every-written-row` walks the cells the notation names. This walks the strings: every
 * line up to 4 characters over the notation's own alphabet, and 60,000 seeded longer ones, that
 * holds a note and a rail or pipe. Rounds 1 to 4 each found the next row shape by hand, so this does
 * not pick shapes. It also takes label-first rows the alphabet cannot spell.
 *
 * The oracle is the spec's: one row more than the song has strings cannot be `ready` unless a row
 * went missing. Each failure lists how many dropped and the first few, so it reads as the whole set.
 */
import { describe, expect, it } from "vitest";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const ALPHABET = [..."-|5x()<>~hp/\\tbm"];
const ctx = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };
const PLAIN = ["---5---7---", "---5---7---", "---3---5---", "---3---5---"];
const TIDY = ["G|---5---|", "D|---5---|", "A|---3---|", "E|---3---|"];

const holdsNote = (s: string) => /[5x]/.test(s);
const holdsRail = (s: string) => /[-|]/.test(s);

function* short(limit: number): Generator<string> {
  const walk = function* (prefix: string): Generator<string> {
    if (prefix.length > 0) yield prefix;
    if (prefix.length === limit) return;
    for (const c of ALPHABET) yield* walk(prefix + c);
  };
  yield* walk("");
}

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function longer(count: number): string[] {
  const random = seeded(4004);
  const out: string[] = [];
  while (out.length < count) {
    const length = 5 + Math.floor(random() * 8);
    const s = Array.from({ length }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join("");
    if (holdsNote(s) && holdsRail(s)) out.push(s);
  }
  return out;
}

const candidates = () => [...short(4)].filter((s) => holdsNote(s) && holdsRail(s));

function report(rows: Iterable<string>, block: readonly string[], where: "top" | "bottom") {
  const lost: string[] = [];
  let seen = 0;
  for (const row of rows) {
    seen += 1;
    const lines = where === "top" ? [row, ...block] : [...block, row];
    if (readTab(lines.join("\n"), ctx).kind === "ready") lost.push(row);
  }
  return { seen, lost: lost.length, first: lost.slice(0, 12) };
}

describe("INV-006 INV-009 every string of the notation's own characters", () => {
  for (const [name, block] of [
    ["unlabelled", PLAIN],
    ["labelled", TIDY],
  ] as const) {
    for (const where of ["top", "bottom"] as const) {
      it(`up to 4 characters, ${where} of a ${name} block`, () => {
        const r = report(candidates(), block, where);
        expect(r.seen).toBeGreaterThan(5_000);
        expect(r).toEqual({ seen: r.seen, lost: 0, first: [] });
      });
      it(`60,000 seeded longer lines, ${where} of a ${name} block`, () => {
        const r = report(longer(60_000), block, where);
        expect(r).toEqual({ seen: 60_000, lost: 0, first: [] });
      }, 60_000);
    }
  }
});

/** Rows that open on a note name and lose the rail after it. S3 needs that rail. */
const LABEL_FIRST = ["Eb 5-7-5", "Bb 5-7-5", "F# 5-7-5", "E  5-7-5", "E 5-7-5", "Db  5-7-5-7"];

describe("INV-006 INV-009 a label, spaces, then a body with no opening rail", () => {
  it.each(LABEL_FIRST)("%s above four rows", (row) => {
    expect(readTab([row, ...PLAIN].join("\n"), ctx).kind).toBe("refused");
  });
  it.each(LABEL_FIRST)("%s under four rows", (row) => {
    expect(readTab([...PLAIN, row].join("\n"), ctx).kind).toBe("refused");
  });
});
