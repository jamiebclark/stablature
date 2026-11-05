/**
 * Round 9. What S6 costs now that it asks of every line wherever it sits. S5 only reached a line
 * touching a block, so a line standing apart from any staff could not refuse a paste. Round 8's
 * cost of 6 in 64 came from a list of one kind of line. This is every kind I expect in a pasted tab's
 * header, between systems and in its footer, each standing apart by a blank line on both sides.
 *
 * Nothing here asserts a cost is wrong: refusing is the safe side, and every refusal names its line.
 * It asserts the two things that are not safe: such a line is never read as notes, and the paste is
 * never `ready` with fewer notes than the good system holds. It prints what refuses, so the cost is a
 * number and not an impression.
 */
import { describe, expect, it } from "vitest";
import { parseTab } from "@/lib/tab/parse";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const context = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };
const GOOD = "G |---5---7---|\nD |-----------|\nA |-----------|\nE |---9-------|";

const GROUPS: Record<string, string[]> = {
  header: [
    "Song: Dirge", "Artist: Hollow Crown", "Tabbed by: someone", "Tuning: Standard (EADGBe)",
    "Tuning: E-A-D-G", "Tuning: Eb-Ab-Db-Gb", "Tuning: D-A-D-G", "E-A-D-G", "D-A-D-G", "Eb-Ab-Db-Gb",
    "Capo 2", "Capo: 3rd fret", "BPM: 112", "Tempo: 120", "120 bpm", "q = 120", "Key: Em", "Time: 4/4", "4/4", "6/8",
    "Half-step down", "1/2 step down", "-1/2 step", "Standard -1/2", "5-string", "5-string bass", "Drop-D", "7-string",
  ],
  sections: [
    "Intro", "Intro:", "[Intro]", "Verse 1", "Verse 1:", "[Verse 1]", "Chorus x2", "Chorus (x2)", "(x2)", "x2", "x4", "2x",
    "4x", "(2x)", "repeat x4", "Repeat 2x", "play 3 times", "Riff 1", "Riff 1:", "Riff 1 (x4)", "Riff 1 - 4x", "Riff #2",
    "Solo", "Bridge", "Outro", "Fill 1", "End", "1st ending", "2nd ending", "1.", "2.", "1st time", "2nd time only",
    "D.C. al Coda", "D.S. al Fine", "To Coda", "Part 1-2", "Gtr 1", "Gtr. 1", "Gtr 1-2", "Gtr.1-2", "Guitar 1:", "Bass:",
  ],
  chords: [
    "Am  F  C  G", "A5", "D5  C5", "E5 G5 A5", "Am-G-F-E", "G-D-Em-C", "C-G-Am-F", "G-D-Em7-C", "Am7-D7", "Am7-D7-Gmaj7",
    "Dm7-G7-Cmaj7", "Dm7 - G7 - Cmaj7", "E5-G5-A5", "C-G7", "G7-C", "D7-G", "A7-D7-E7", "Bm7-5", "Am7-5", "F#m7-B7",
    "Am-G7", "Dm-G7", "Em-Am7", "Bm-A7", "Gm-C7", "Am-Dm7", "Am-G-F7", "Cmaj7-Am", "Am-Fmaj7",
    "| Am | F | C | G |", "|Am|F|C|G|", "| Am7 | D7 | G |", "| G | D | x2", "|G7|C7|", "| G7 | C7 |",
  ],
  counts: [
    "1 & 2 & 3 & 4 &", "1 e & a 2 e & a", "1+2+3+4+", "1 2 3 4", "1-2-3-4", "1 - 2 - 3 - 4", "1-2-3-4-", "-1-2-3-4-",
    "1-2-3-4-1-2-3-4", "123412341234", "Count: 1-2-3-4", "3-4-5", "7-8", "12-16",
  ],
  bars: [
    "bars 1-4", "Bars 1-8", "1-4", "5-8", "1-8", "(1-4)", "[1-4]", "mm. 1-4", "m.1-4", "m1-4", "12-bar", "12 bar blues",
    "8-bar intro", "16 bars", "2-3", "2-3x", "2-3 times", "x2-3", "2 - 3", "(x2-3)", "x2-",
    "1st-2nd", "1st-", "3rd-4th", "(1st-2nd)", "V1-V2", "A1-A2",
  ],
  times: ["3:20", "0:32", "(0:32)", "[0:32]", "0:00-0:32", "0:32 - 1:04", "1:04-1:32", "@ 1:04", "(1:04-1:32)"],
  legend: [
    "h = hammer-on", "p = pull-off", "/ = slide up", "\\ = slide down", "b = bend", "x = dead note", "x - dead note", "( ) = ghost note",
    "h - hammer on", "7b9 = bend", "PM", "P.M.", "P.M.---", "P.M.----|", "PM-----|", "let ring", "let ring ---|", "l.r.---", "w/ dist",
    "harm.", "A.H.", "N.H.", "vib", "~~~~~",
  ],
  footer: [
    "-----", "=====", "*****", "_____", "* * *", "- - -", "...", "(c) 1999-2004", "1999-2004", "1999", "Copyright 1999-2004",
    "www.example.com", "http://tabs.example.com/7-11", "Page 1", "Page 1-2", "1/3", "Track 7", "Track 7-8", "CD1-07", "+2", "+1 -1", "-2",
  ],
};

const notesIn = (text: string) => {
  const parsed = parseTab(text);
  return parsed.ok ? parsed.clipboard.columns.reduce((n, c) => n + Object.keys(c.frets).length, 0) : null;
};

describe("INV-010 an ordinary line standing apart from every staff", () => {
  const all = Object.values(GROUPS).flat();
  const base = notesIn(`${GOOD}\n\n${GOOD}`)!;

  it("is never read as notes", () => {
    const wrong: string[] = [];
    for (const line of all) {
      for (const text of [`${line}\n\n${GOOD}\n\n${GOOD}`, `${GOOD}\n\n${line}\n\n${GOOD}`, `${GOOD}\n\n${GOOD}\n\n${line}`]) {
        const notes = notesIn(text);
        if (notes !== null && notes !== base) wrong.push(`${line}: ${notes}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("is listed when the paste reads", () => {
    const missing: string[] = [];
    for (const line of all) {
      const reading = readTab(`${line}\n\n${GOOD}`, context);
      if (reading.kind === "ready" && !reading.ignored.some((l) => l.text === line)) missing.push(line);
    }
    expect(missing).toEqual([]);
  });

  it("the cost, by kind", () => {
    const out: string[] = [];
    let refused = 0;
    for (const [group, lines] of Object.entries(GROUPS)) {
      const hit = lines.filter((line) => !parseTab(`${line}\n\n${GOOD}`).ok);
      refused += hit.length;
      out.push(`${group}: ${hit.length} of ${lines.length}: ${hit.join("   ")}`);
    }
    process.stderr.write(`apart from a staff, ${refused} of ${all.length} refuse\n${out.join("\n")}\n`);
    expect(all.length).toBeGreaterThan(150);
  });
});
