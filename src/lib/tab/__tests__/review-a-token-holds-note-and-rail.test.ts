/**
 * Round 9. The two every-line sweeps filter on "a note touches a rail", which is S6's own test, so
 * they cannot find what S6 misses. This filter borrows nothing from the rule: a run of characters
 * with no space in it holds both a note and a rail or pipe. That keeps `Am7 - D7` and `x2 -` out, as
 * NOTE F73 requires, since the rail stands apart there, and it lets `--(5)--` in.
 *
 * The declared edge is the same as the other sweeps: a word with no rail at either end (NOTE F62), a
 * line of only chord symbols, and, alone, a line of only numbers. What is left may not be ignored
 * while the paste reads.
 *
 * TOKEN_LONGEST sets the exhaustive depth. The review ran 5. TOKEN_SAMPLE is the random part.
 */
import { describe, expect, it } from "vitest";
import { parseChord } from "@/lib/chords";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const context = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };
const LONGEST = Number(process.env.TOKEN_LONGEST ?? 4);
const SAMPLE = Number(process.env.TOKEN_SAMPLE ?? 20_000);
const GOOD = "G |---5---7---|\nD |-----------|\nA |-----------|\nE |---9-------|";
const ALPHABET = [..."-—|5x:E ()<>t"];
const WIDE = [..."-—–−|-—–−|0157912xX0157912:.()[]<>=~*+#,;/\\'\"EGADBeshpbmtr "];

const rimmed = (t: string) => /^[-—–−|]|[-—–−|]$/.test(t);
const word = (t: string) => /(?<![\p{L}\p{N}])\p{L}{2,}(?![\p{L}\p{N}])/u.test(t);
const numbers = (t: string) => /^[\dxX\s./:-]+$/.test(t);
const chords = (t: string) => t.split(/\s+/).every((k) => parseChord(k) !== null);
const note = (t: string) => /\d|(?<!\p{L})[xX](?!\p{L})/u.test(t);
const holdsBoth = (t: string) => t.split(/\s+/).some((k) => /[-—–−|]/.test(k) && note(k));

function* lines(length: number, prefix = ""): Generator<string> {
  if (prefix.length === length) {
    yield prefix;
    return;
  }
  for (const c of ALPHABET) yield* lines(length, prefix + c);
}

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

function* corpus(seed: number): Generator<string> {
  for (let length = 1; length <= LONGEST; length += 1) yield* lines(length);
  const next = random(seed);
  for (let n = 0; n < SAMPLE; n += 1) {
    const length = 3 + Math.floor(next() * 10);
    let line = "";
    for (let k = 0; k < length; k += 1) line += WIDE[Math.floor(next() * WIDE.length)];
    yield line;
  }
}

function sweep(seed: number, paste: (line: string) => string, alone: boolean) {
  const lost = new Set<string>();
  let tried = 0;
  for (const raw of corpus(seed)) {
    const line = raw.trim();
    if (line !== raw || line === "" || !holdsBoth(line)) continue;
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
  process.stderr.write(`${name}: ${r.tried} lines, ${r.lost.length} ignored, as ${r.lost.slice(0, 18).join("   ")}\n`);

describe("INV-006 INV-009 no run of characters holding a note and a rail is ignored", () => {
  it("four deep, as a system of its own", () => {
    const r = sweep(9101, (l) => `${[l, l, l, l].join("\n")}\n\n${GOOD}`, false);
    report("four deep", r);
    expect(r.lost.slice(0, 10)).toEqual([]);
  });

  it("alone, between two systems", () => {
    const r = sweep(9102, (l) => `${GOOD}\n\n${l}\n\n${GOOD}`, true);
    report("alone", r);
    expect(r.lost.slice(0, 10)).toEqual([]);
  });
});
