/**
 * Round 9. `INV-006-every-label-of-a-system.test.ts` crossed every opening, rail and closing, and its
 * notes were all bare digits, which is what T089's rule asks about. This is the same matrix with the
 * notes the notation wraps: a digit in its own brackets touches no rail.
 *
 * Each paste must refuse, or store every note. Counting notes needs no second reader.
 */
import { describe, expect, it, vi } from "vitest";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

// A sweep of this size outlasts the default 5s timeout on a loaded machine; it asserts nothing about speed.
vi.setConfig({ testTimeout: 120_000 });

const context = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };
const NAMES = ["G", "D", "A", "E"];

const OPENINGS: [string, (name: string, number: number) => string][] = [
  ["nothing", () => ""],
  ["a gutter", () => "   "],
  ["name", (n) => n],
  ["name, space", (n) => `${n} `],
  ["name, colon", (n) => `${n}:`],
  ["name, colon, space", (n) => `${n}: `],
  ["name, close bracket", (n) => `${n})`],
  ["name, full stop", (n) => `${n}.`],
  ["name, equals", (n) => `${n}=`],
  ["name, greater than", (n) => `${n}>`],
  ["name in brackets", (n) => `(${n})`],
  ["name in square brackets", (n) => `[${n}]`],
  ["number", (_n, k) => `${k}`],
  ["number, colon", (_n, k) => `${k}:`],
  ["number, close bracket", (_n, k) => `${k})`],
  ["s and number, colon", (_n, k) => `s${k}:`],
];

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

const SPACINGS: [string, string][] = [
  ["single", "\n"],
  ["double", "\n\n"],
];

/** A cell from a fret: the wrappers a digit can sit inside, so no rail touches it. */
const CELLS: [string, (fret: string) => string][] = [
  ["let ring", (f) => `(${f})`],
  ["harmonic", (f) => `<${f}>`],
  ["both", (f) => `(<${f}>)`],
  ["tapped, bent", (f) => `t${f}b`],
  ["tapped, vibrato", (f) => `t${f}~`],
  ["tapped, let ring", (f) => `t(${f})`],
  ["muted, let ring", (f) => `(${f})m`],
  ["every mark", (f) => `t(<${f}>)b~m`],
];

const WHICH: [string, number[]][] = [
  ["top row busy", [0]],
  ["bottom row busy", [3]],
  ["every row busy", [0, 1, 2, 3]],
];

const GAPS = [1, 2];
const FRETS = ["3", "5", "3", "7"];
const GOOD = "G |---5---7---|\nD |-----------|\nA |-----------|\nE |---9-------|";
const GOOD_NOTES = 3;

function count(reading: Extract<ReturnType<typeof readTab>, { kind: "ready" }>) {
  let notes = 0;
  for (const column of reading.clipboard.columns) notes += Object.keys(column.frets).length * column.repeat;
  return notes;
}

/** NOTE F62's edge: a word of two letters or more with no rail at either end, as `Gt(3)-t(7)` is. */
function declaredEdge(row: string) {
  const t = row.trim();
  const rimmed = /^[-—–−|]|[-—–−|]$/.test(t);
  return !rimmed && /(?<![\p{L}\p{N}])\p{L}{2,}(?![\p{L}\p{N}])/u.test(t);
}

function sweep() {
  const lost = new Map<string, { n: number; sample: string }>();
  let pastes = 0;
  for (const [cellName, cell] of CELLS) {
    for (const [opening, open] of OPENINGS) {
      for (const [rail, r] of RAILS) {
        for (const [closing, close] of CLOSINGS) {
          for (const [spacing, between] of SPACINGS) {
            for (const gap of GAPS) {
              for (const outer of [0, gap]) {
                for (const [which, rows] of WHICH) {
                  const edge = r.repeat(outer);
                  const body = `${edge}${FRETS.map(cell).join(r.repeat(gap))}${edge}`;
                  const empty = r.repeat(body.length);
                  const mine = NAMES.map(
                    (name, k) => `${open(name, k + 1)}${rows.includes(k) ? body : empty}${close}`,
                  ).join(between);
                  if (declaredEdge(mine.split(between)[rows[0]])) continue;
                  for (const first of [true, false]) {
                    const text = first ? `${mine}\n\n${GOOD}` : `${GOOD}\n\n${mine}`;
                    pastes += 1;
                    const reading = readTab(text, context);
                    if (reading.kind !== "ready") continue;
                    const want = rows.length * FRETS.length + GOOD_NOTES;
                    if (count(reading) === want) continue;
                    const key = `${cellName} / ${opening} / ${rail} / closing on ${closing} / ${spacing}`;
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
  return { lost, pastes };
}

describe("INV-006 every system of a paste is stored, whatever its cells are", () => {
  it("no paste reads with a system missing", () => {
    const { lost, pastes } = sweep();
    const total = [...lost.values()].reduce((n, l) => n + l.n, 0);
    process.stderr.write(`${pastes} pastes, ${total} lost notes, in ${lost.size} shapes\n`);
    const byOpening = new Map<string, number>();
    for (const [key, { n }] of lost) {
      const opening = key.split(" / ")[1];
      byOpening.set(opening, (byOpening.get(opening) ?? 0) + n);
    }
    process.stderr.write(`${[...byOpening].map(([k, n]) => `${k}: ${n}`).join("; ")}\n`);
    const first = [...lost.values()][0];
    if (first) process.stderr.write(`${first.sample}\n`);
    expect([...lost.keys()].slice(0, 12)).toEqual([]);
  });
});
