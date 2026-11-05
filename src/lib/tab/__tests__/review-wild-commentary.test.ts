/**
 * Round 5. INV-010, FR-016. The other side of the row test, so a rule that widens one side is run
 * against this one in the same pass. Round 4 said its guards were "the lines I thought of". These
 * are the lines wild tab carries, by family, each above and below a labelled and an unlabelled
 * block. None is S1 to S4, so the spec calls each commentary: it must be listed, and must not
 * refuse.
 *
 * Lines with no word that the rule still refuses, such as `#1`, `q=120` and `(0:32)`, are not here.
 * Refusing them is safe, and review.md lists them as a MINOR.
 */
import { describe, expect, it } from "vitest";
import { readTab, type TabReading } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";

const ctx = { tuning: presetById("bass4-e")!, bandTunings: [], songEvents: [] };

const verdict = (r: TabReading) =>
  r.kind === "ready"
    ? r.ignored.map((n) => n.text)
    : r.kind === "refused"
      ? r.refusals.map((x) => `${x.line} ${x.code}`)
      : r.kind;

const BLOCKS: [string, string[]][] = [
  ["labelled", ["G|---5---|", "D|---5---|", "A|---3---|", "E|---3---|"]],
  ["unlabelled", ["---5---", "---5---", "---3---", "---3---"]],
];

const MUST_LIST = [
  // Sections.
  "Intro",
  "Verse",
  "Verse 1",
  "Verse 1:",
  "Verse 2 (x2)",
  "Chorus x2",
  "Chorus (x2)",
  "[Chorus]",
  "[Verse 1]",
  "(Verse 1)",
  "Bridge:",
  "Part 1",
  "Part A",
  "Riff 1",
  "Riff A:",
  "Main riff (x4)",
  "Fill 1",
  "Pre-chorus",
  "Pre-Chorus 2",
  "D.S. al Coda",
  "To Coda",
  // Repeats.
  "x2",
  "x4",
  "(x2)",
  "(x4)",
  "[x2]",
  "2x",
  "4x",
  "(2x)",
  "repeat x2",
  "repeat 4 times",
  "Repeat 3x",
  "4 times",
  // Time and tempo.
  "4/4",
  "Tempo: 120",
  "BPM: 120",
  "120 bpm",
  "q = 120",
  "Tempo=120",
  "Capo 3",
  "Capo: 3rd fret",
  "1 2 3 4",
  "1 + 2 + 3 + 4 +",
  "1 & 2 & 3 & 4 &",
  "1e+a2e+a3e+a4e+a",
  "1 e & a 2 e & a",
  "1234",
  "12341234",
  // Marks over the music.
  "PM",
  "P.M.",
  "P.M.----|",
  "let ring",
  "let ring---------|",
  "~~~~~",
  "w/ distortion",
  "w/ pick",
  "slap",
  "T  P  T  P",
  "1/2",
  "1/4",
  "1/2 step down",
  // Tuning and instrument.
  "Drop D",
  "Tuning: EADG",
  "Tuning: E A D G",
  "Standard tuning",
  "Tuned down 1/2 step",
  "Bass 1",
  "Bass 2",
  "Gtr 1",
  "Gtr. 1",
  "Guitar 2:",
  "Rhy. Fig. 1",
  "End Rhy. Fig. 1",
  "2nd time only",
  "1st ending",
  "1.",
  "2.",
  "1st time",
  // Credits and times.
  "0:32",
  "Tabbed by Sam",
  "tab by sam 2019",
  "Page 1/2",
  "Artist: Blink-182",
  "Blink-182",
  "Sum 41",
  "Maroon 5",
  // Lyrics.
  "And I'm 19 now",
  "I've got 99 problems",
  "5 more minutes",
  "one, two, three, four",
  "la la la",
  "oh-oh-oh",
  "na-na-na",
  "na na na-na-na",
  "yeah-yeah-yeah",
  "hey!",
  // Rules.
  "==========",
  "__________",
  "**********",
  "...",
  "Bars 1-4",
  "bars 1-2",
  "(bars 5-8)",
];

function refusedOf(line: string) {
  const out: string[] = [];
  for (const [name, rows] of BLOCKS) {
    for (const [where, lines] of [
      ["above", [line, ...rows]],
      ["below", [...rows, line]],
    ] as const) {
      const r = readTab(lines.join("\n"), ctx);
      if (r.kind !== "ready" || !r.ignored.some((n) => n.text === line)) {
        out.push(`${where} ${name}: ${JSON.stringify(verdict(r))}`);
      }
    }
  }
  return out;
}

describe("INV-010 wild commentary stays commentary", () => {
  it.each(MUST_LIST)("%s", (line) => {
    expect(refusedOf(line)).toEqual([]);
  });
});
