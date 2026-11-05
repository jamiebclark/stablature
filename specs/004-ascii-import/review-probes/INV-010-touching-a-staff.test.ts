/**
 * Round 4. INV-010: never is commentary lost silently, read as notes, or read as chords. Its set
 *          names "headings for unnamed, named and variant parts" and the lines of "one part cut
 *          from an export". FR-016: commentary MUST be ignored under the rule in the spec.
 *
 * The other side of INV-006. T073 made a line touching a staff a row when a digit or free `x` touches
 * a mark, so refusing is now the default for anything with punctuation beside a number. Refusing is
 * safe for a line that might be a row. These might not: each is prose, or the app's own text.
 *
 * The app's own text comes through the real `songToText`. It writes the heading directly above the
 * staff and `part.notes` directly under it, so both always touch a staff row.
 */
import { describe, expect, it } from "vitest";
import { songToText } from "@/lib/export/text";
import type { EventRow, PartRow } from "@/lib/model";
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

/** Lines the spec calls commentary: none starts a staff row or holds a run of rails and a fret. */
const PROSE = [
  "Verse 1:",
  "Chorus 2:",
  "Riff 1:",
  "Riff 2.",
  "Riff #1",
  "Solo 2:",
  "Repeat 2x.",
  "Repeat x4,",
  "Play 4x.",
  "Capo 2.",
  "Time: 4/4",
  "BPM=120",
  "Page 2/3",
  "Tabbed by Sam, 2019.",
  "www.example.com/tab/123",
  "Take 5, now",
  "Route 66!",
  "It's 5:00 somewhere",
];

describe("INV-010 prose with punctuation beside a number stays commentary", () => {
  for (const line of PROSE) {
    for (const [name, rows] of BLOCKS) {
      it(`${JSON.stringify(line)} above a ${name} block`, () => {
        expect(verdict(readTab([line, ...rows].join("\n"), ctx))).toEqual([line]);
      });
      it(`${JSON.stringify(line)} below a ${name} block`, () => {
        expect(verdict(readTab([...rows, line].join("\n"), ctx))).toEqual([line]);
      });
    }
  }
});

/** Spec, Accepted: "A wild chord row holding one symbol flush left is ... listed as ignored". */
const LONE_CHORDS = ["F#7", "C#7", "F#5", "A7#9", "E7#9", "Am7/G", "D7/F#", "Am7", "A7", "G5", "C#m7"];

describe("INV-010 one chord symbol flush left above a staff is listed, not refused", () => {
  for (const chord of LONE_CHORDS) {
    for (const [name, rows] of BLOCKS) {
      it(`${chord} above a ${name} block`, () => {
        expect(verdict(readTab([chord, ...rows].join("\n"), ctx))).toEqual([chord]);
      });
    }
  }
});

const event = (id: string, partId: string, fret: number) =>
  ({
    id,
    bandId: "b",
    partId,
    rank: `a${id}`,
    kind: "notes",
    frets: { "0": fret },
    techniques: {},
    repeat: 1,
    durationHint: null,
    tupletId: null,
    tupletCount: null,
    groupKind: null,
    updatedAt: "",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
  }) as unknown as EventRow;

const part = (id: string, label: string, name: string | null, notes: string | null, base?: string) =>
  ({ id, label, name, notes, variantOfPartId: base ?? null }) as unknown as PartRow;

function exported(parts: PartRow[]) {
  return songToText({
    song: { title: "Dirge", bpm: 120, notes: null },
    bandName: "Hollow Crown",
    tuning: presetById("bass4-e")!,
    tuningName: "Standard",
    parts,
    eventsByPart: Object.fromEntries(parts.map((p) => [p.id, [event("1", p.id, 5), event("2", p.id, 7)]])),
    entries: [],
  });
}

const NAMES = ["Verse-2", "12-bar", "Take 2.", "Intro 1:", "Riff #1", "Part 2/3"];

describe("INV-010 the heading of a named part, from the real export", () => {
  it.each(NAMES)("a part named %s", (name) => {
    const r = readTab(exported([part("a", "A", name, null)]), ctx);
    expect(verdict(r)).toContain(`A  ${name}`);
  });
  it.each(NAMES)("a variant named %s, cut from its song", (name) => {
    const whole = exported([part("base", "A", null, null), part("a", "A'", name, null, "base")]);
    const blocks = whole.split("\n\n");
    const text = blocks.filter((block) => !block.startsWith("A\n")).join("\n\n");
    expect(verdict(readTab(text, ctx))).toContain(`A'  ${name}   (variant of A)`);
  });
});

const NOTES = [
  "Play 4x.",
  "Repeat x2, then stop",
  "8-bar intro",
  "Capo 2.",
  "Palm mute bars 3-4",
  "Lyrics: Take 5, now",
];

describe("INV-010 a part's notes, written under the staff by the real export", () => {
  it.each(NOTES)("notes: %s", (notes) => {
    expect(verdict(readTab(exported([part("a", "A", null, notes)]), ctx))).toContain(notes);
  });
  it("notes over several lines list every line", () => {
    const r = readTab(exported([part("a", "A", null, "bars 1-2\nbars 3-4\nand on")]), ctx);
    const ignored = verdict(r);
    for (const line of ["bars 1-2", "bars 3-4", "and on"]) expect(ignored).toContain(line);
  });
});

describe("INV-010 a song of several parts refuses as several-parts, whatever they are named", () => {
  it.each(NAMES)("a second part named %s", (name) => {
    const r = readTab(exported([part("a", "A", null, null), part("b", "B", name, null)]), ctx);
    expect(r.kind === "refused" ? r.refusals.map((x) => x.code) : r.kind).toEqual(["several-parts"]);
  });
});
