/**
 * INV-027..029 (spec 007, contracts/reader.md): chords joined by hyphens beside a good system are
 * commentary when a letter follows a root; the rest stay refused, and a refusal says so truthfully.
 */
import { describe, expect, it } from "vitest";
import { parseTab } from "@/lib/tab/parse";

const SYSTEM = ["G|-5-7-|", "D|-----|", "A|-----|", "E|-----|"].join("\n");

/** [name, text, 1-indexed line of the probe line] */
const POS: [string, (l: string) => string, number][] = [
  ["directly above", (l) => `${l}\n${SYSTEM}`, 1],
  ["apart above", (l) => `${l}\n\n${SYSTEM}`, 1],
  ["directly below", (l) => `${SYSTEM}\n${l}`, 5],
  ["apart below", (l) => `${SYSTEM}\n\n${l}`, 6],
  ["between two systems", (l) => `${SYSTEM}\n\n${l}\n\n${SYSTEM}`, 6],
];

const JOINED = ["Am7-D7", "Am7-D7-G", "Cmaj7-Fmaj7", "Dm7-G7-Cmaj7", "F#m7-B7", "Dsus4-A7", "Cadd9-G", "Bbm7-Eb7", "Am-G7"];

/** Literal oracle, recorded from unedited parse.ts: the code each line was refused with, directly above a staff. */
const STAYS: [string, string][] = [
  ["A7-D7", "run-together"],
  ["E5-A5", "run-together"],
  ["C-G7", "row-length"],
  ["A7-D7-E7", "run-together"],
  ["E5-G5-A5", "run-together"],
  ["D-7-G-7", "bad-character"],
  ["Am7-b7", "bad-character"],
  ["Am7-7", "bad-character"],
  ["Am7-5", "bad-character"],
  ["Bm7-5", "bad-character"],
  ["Am7-D7-", "bad-character"],
  ["-Am7-D7", "bad-character"],
  ["Am7--D7", "bad-character"],
  ["G5-7", "run-together"],
  ["E-5-7", "row-length"],
  ["(c) 1999-2004", "bad-character"],
  ["1-2-3-4-", "labels-mixed"],
];
/** Lines whose refusal is re-worded `chords-joined`. */
const REWORDED = new Set(["A7-D7", "E5-A5", "D-7-G-7", "C-G7", "A7-D7-E7", "E5-G5-A5"]);

const refusalsOf = (text: string) => {
  const p = parseTab(text);
  return p.ok ? null : p.refusals;
};

describe("INV-027 joined chords beside a good system are listed as ignored", () => {
  for (const preset of ["bass4-e", "guitar6"]) {
    for (const [pos, build, at] of POS) {
      it.each(JOINED)(`%s, ${pos}, ${preset}`, (line) => {
        const base = parseTab(SYSTEM);
        const r = parseTab(build(line));
        expect(r.ok).toBe(true);
        if (!r.ok || !base.ok) return;
        expect(r.ignored).toContainEqual({ line: at, text: line });
        expect(r.clipboard.columns.length).toBeGreaterThanOrEqual(base.clipboard.columns.length);
      });
    }
  }

  it("a chord row set over the columns, spaced, still reads as chords", () => {
    const r = parseTab(`   Am7 D7
${SYSTEM}`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ignored).toEqual([]);
      expect(r.clipboard.annotations.length).toBeGreaterThan(0);
    }
  });
});

describe("INV-028 the rest still refuse", () => {
  for (const [pos, build, at] of POS) {
    it.each(STAYS)(`%s, ${pos}`, (line) => {
      const refs = refusalsOf(build(line));
      expect(refs).not.toBeNull();
      expect(refs!.map((x) => x.line)).toContain(at);
    });
  }
});

describe("INV-029 a refusal says what it is", () => {
  it.each(STAYS)("%s keeps its line and kind, re-worded only where named", (line, was) => {
    const refs = refusalsOf(`${line}\n${SYSTEM}`)!;
    expect(refs.map((x) => x.line)).toEqual([1]);
    expect(refs[0].code).toBe(REWORDED.has(line) ? "chords-joined" : was);
  });

  it("`Am7 - D7` keeps today's code", () => {
    expect(refusalsOf(`Am7 - D7\n${SYSTEM}`)![0].code).toBe("bad-character");
  });

  for (const [pos, build] of POS) {
    it.each([...REWORDED])(`following the advice reads: %s, ${pos}`, (line) => {
      // Spaces, set apart on a line of its own (a blank line each side, so no staff touches it).
      const spaced = line.replace(/-/g, " ");
      expect(parseTab(build(`
${spaced}
`)).ok, "spaces").toBe(true);
      // Deleted: the staff alone reads.
      expect(parseTab(build("")).ok, "deleted").toBe(true);
    });
  }
});
