/**
 * Round 5. INV-006: never is a row with anything on it dropped or moved. INV-009: never does a line
 * that may be a damaged staff row become commentary.
 *
 * `INV-006-009-every-notation-string` walks strings of the notation's own alphabet, which T078's
 * `isNotationOnly` now claims outright. This walks the same strings with the characters the spec's
 * refused list names mixed in (`s`, `r`, `^`) and the marks a damaged row picks up (`?`, `.`, `=`),
 * and with a note-name label in front of them. Each holds a note and a rail or pipe, so none can be
 * prose: a line with those on it and no word is a row, and S5's second test is all that can claim it.
 *
 * The oracle is the spec's: one row more than the song has strings cannot be `ready` unless a row
 * went missing.
 */
import { describe, expect, it } from "vitest";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const ALPHABET = [..."-|5x()<>~hp/\\tbmsr^?.="];
const ctx = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };
const PLAIN = ["---5---7---", "---5---7---", "---3---5---", "---3---5---"];
const TIDY = ["G|---5---|", "D|---5---|", "A|---3---|", "E|---3---|"];

const holdsNote = (s: string) => /[5x]/.test(s);
const holdsRail = (s: string) => /[-|]/.test(s);
const damaged = (s: string) => /[sr^?.=]/.test(s);
/** A run of two letters or more is a word, unless the line opens or closes on a rail or pipe. */
const prose = (s: string) => !/^[-|]|[-|]$/.test(s) && /(?<![a-z0-9])[a-z]{2,}(?![a-z0-9])/.test(s);

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
  const random = seeded(5005);
  const out: string[] = [];
  while (out.length < count) {
    const length = 5 + Math.floor(random() * 8);
    const s = Array.from({ length }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join("");
    if (holdsNote(s) && holdsRail(s) && damaged(s) && !prose(s)) out.push(s);
  }
  return out;
}

const candidates = () =>
  [...short(4)].filter((s) => holdsNote(s) && holdsRail(s) && damaged(s) && !prose(s));

function report(rows: Iterable<string>, block: readonly string[], where: "top" | "bottom") {
  const lost: string[] = [];
  let seen = 0;
  for (const row of rows) {
    seen += 1;
    const lines = where === "top" ? [row, ...block] : [...block, row];
    if (readTab(lines.join("\n"), ctx).kind === "ready") lost.push(row);
  }
  return { seen, lost: lost.length, first: lost.slice(0, 16) };
}

describe("INV-006 INV-009 every damaged string of the notation", () => {
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
      });
    }
  }
});

/** Rows that open on a note name with no pipe and no rail after it. The alphabet cannot spell these. */
const LABELS = ["C", "Cb", "c", "C#", "C2"];
const GAPS = ["", " ", "  ", ":", ": "];
const BODIES = [
  "(5)-(7)-",
  "(5)-(7)",
  "(5)--(7)--",
  "(x)-(x)-",
  "t5b-t7b-",
  "t5b-t7b",
  "t5-t7",
  "<5>-<7>-",
  "5-7-5",
  "5h7-",
  "5-7",
];

describe("INV-006 INV-009 a label, then a body with no opening rail", () => {
  for (const [name, block] of [
    ["unlabelled", PLAIN],
    ["labelled", TIDY],
  ] as const) {
    for (const where of ["top", "bottom"] as const) {
      it(`${where} of a ${name} block`, () => {
        const rows = LABELS.flatMap((l) => GAPS.flatMap((g) => BODIES.map((b) => `${l}${g}${b}`)));
        const r = report(rows, block, where);
        expect(r).toEqual({ seen: rows.length, lost: 0, first: [] });
      });
    }
  }
});
