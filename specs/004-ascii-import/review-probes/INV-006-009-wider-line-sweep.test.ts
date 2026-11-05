/**
 * Round 9. Round 8 said its every-line sweep stopped at 5 characters over 12, with one digit and one
 * letter, so a shape needing a longer label or a second letter was reached only by named openings.
 * This is the same question over a wider alphabet and longer lines: a seeded sample, so a run is
 * repeatable, and no list of shapes.
 *
 * A line where a note touches a rail or pipe may not be ignored while the paste reads. The declared
 * edge is the same three shapes as `INV-006-009-every-line-beside-a-system.test.ts`.
 *
 * WIDE_SAMPLE sets how many lines each layout tries. The review ran 400,000.
 */
import { describe, expect, it } from "vitest";
import { parseChord } from "@/lib/chords";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const context = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };
const SAMPLE = Number(process.env.WIDE_SAMPLE ?? 20_000);
const GOOD = "G |---5---7---|\nD |-----------|\nA |-----------|\nE |---9-------|";
const UNLABELLED = "---5---7---\n-----------\n-----------\n---9-------";

const RAILS = [..."-—–−|"];
const NOTES = [..."0157912xX"];
const MARKS = [...":.()[]=>_~*+#,;/\\'\""];
const LETTERS = [..."EGADBeshpbmtr"];

/** Rails and notes weighted up, or nearly every line would be noise that holds no note. */
const ALPHABET = [...RAILS, ...RAILS, ...RAILS, ...NOTES, ...NOTES, ...MARKS, ...LETTERS, " "];

function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noteTouchesRail = (t: string) =>
  /[-—–−|](\d|[xX](?!\p{L}))|(\d|(?<!\p{L})[xX])[-—–−|]/u.test(t);
const rimmed = (t: string) => /^[-—–−|]|[-—–−|]$/.test(t);
const word = (t: string) => /(?<![\p{L}\p{N}])\p{L}{2,}(?![\p{L}\p{N}])/u.test(t);
const numbers = (t: string) => /^[\dxX\s./:-]+$/.test(t);
const chords = (t: string) => t.split(/\s+/).every((k) => parseChord(k) !== null);

function sweep(seed: number, paste: (line: string) => string, alone: boolean) {
  const next = random(seed);
  const lost = new Set<string>();
  let tried = 0;
  for (let n = 0; n < SAMPLE; n += 1) {
    const length = 3 + Math.floor(next() * 10);
    let line = "";
    for (let k = 0; k < length; k += 1) line += ALPHABET[Math.floor(next() * ALPHABET.length)];
    line = line.trim();
    if (line === "" || !noteTouchesRail(line)) continue;
    if (word(line) && !rimmed(line)) continue;
    if (chords(line) && !rimmed(line)) continue;
    if (alone && numbers(line) && !rimmed(line)) continue;
    tried += 1;
    const reading = readTab(paste(line), context);
    if (reading.kind === "ready" && reading.ignored.some((l) => l.text.trim() === line)) lost.add(line);
  }
  return { lost: [...lost], tried };
}

const report = (name: string, r: { lost: string[]; tried: number }) =>
  process.stderr.write(`${name}: ${r.tried} lines, ${r.lost.length} ignored, as ${r.lost.slice(0, 16).join("   ")}\n`);

describe("INV-006 INV-009 a wider sweep of lines holding a note and a rail", () => {
  it("four deep, as a system of its own", () => {
    const r = sweep(9001, (l) => `${[l, l, l, l].join("\n")}\n\n${GOOD}`, false);
    report("four deep", r);
    expect(r.tried).toBeGreaterThan(100);
    expect(r.lost.slice(0, 10)).toEqual([]);
  });

  it("alone, between two systems", () => {
    const r = sweep(9002, (l) => `${GOOD}\n\n${l}\n\n${GOOD}`, true);
    report("alone", r);
    expect(r.tried).toBeGreaterThan(100);
    expect(r.lost.slice(0, 10)).toEqual([]);
  });

  it("touching an unlabelled system", () => {
    const r = sweep(9003, (l) => `${UNLABELLED}\n${l}`, false);
    report("touching", r);
    expect(r.tried).toBeGreaterThan(100);
    expect(r.lost.slice(0, 10)).toEqual([]);
  });

  it("over three rails-only rows, as a system of its own", () => {
    const r = sweep(9004, (l) => {
      const rails = "-".repeat(l.length);
      return `${l}\n${rails}\n${rails}\n${rails}\n\n${GOOD}`;
    }, false);
    report("over rails", r);
    expect(r.tried).toBeGreaterThan(100);
    expect(r.lost.slice(0, 10)).toEqual([]);
  });
});
