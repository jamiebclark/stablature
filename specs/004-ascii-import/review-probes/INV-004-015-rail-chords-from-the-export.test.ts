/**
 * Round 2. INV-004: never does drawing the parsed result give a different string.
 *          INV-015: `D-7` and `A-` are named chords. Spec: everything the text export emits comes back.
 *
 * Round 1's F3 fix reads a chord row only when every token is a whole chord. The export overwrites a
 * chord when the next one starts inside it, so `D-7` beside `G-7` is drawn `D-G-7`. The contract
 * (reader.md section 4) splits such a symbol at the columns. Classification must let it get there.
 */
import { describe, expect, it } from "vitest";
import { draftPart } from "@/lib/local/clipboard";
import type { AnnotationRow, EventRow } from "@/lib/model";
import { toAscii } from "@/lib/tab/ascii";
import { parseTab } from "@/lib/tab/parse";
import { presetById } from "@/lib/tunings";

const tuning = presetById("bass4-e")!;
let next = 0;

const event = (fret: number) =>
  ({
    id: `e${(next += 1)}`,
    bandId: "b",
    partId: "p",
    rank: `a${next}`,
    kind: "notes",
    frets: { "0": fret },
    techniques: {},
    repeat: 1,
    durationHint: null,
    tupletId: null,
    tupletCount: null,
    groupKind: null,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
  }) as unknown as EventRow;

const chord = (anchor: EventRow, value: string) =>
  ({
    id: `c${(next += 1)}`,
    bandId: "b",
    partId: "p",
    anchorEventId: anchor.id,
    kind: "chord",
    value,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
  }) as unknown as AnnotationRow;

const SYMBOLS = ["D-7", "G-7", "F#-7", "Bb-7", "A-", "E-", "C-9"];

/**
 * The oracle is the ledger's. Text the export wrote is never refused. It comes back as the same
 * text, or a chord row that cannot be split is commentary, listed, and missing from the redraw
 * (`chord-not-a-symbol`, and F17 in review.md). A refusal is neither.
 */
describe("every pair of rail chords on neighbouring columns comes back from the export", () => {
  for (const first of SYMBOLS) {
    for (const second of SYMBOLS) {
      for (const density of ["expanded", "compact"] as const) {
        it(`${first} then ${second}, ${density}`, () => {
          const events = [event(5), event(7), event(9)];
          const annotations = [chord(events[0], first), chord(events[1], second)];
          const text = toAscii({ events, annotations, tuning, density });
          const parsed = parseTab(text);
          expect(
            parsed.ok ? "ok" : parsed.refusals.map((r) => `${r.line}:${r.code}`).join(" "),
            text,
          ).toBe("ok");
          if (!parsed.ok) return;
          const rows = draftPart(parsed.clipboard);
          const redraw = toAscii({ ...rows, tuning, density: parsed.density });
          if (redraw !== text) {
            const chordRow = text.split("\n")[0];
            expect(parsed.ignored.map((i) => i.text)).toEqual([chordRow]);
            expect(redraw).toBe(text.split("\n").slice(1).join("\n"));
          }
        });
      }
    }
  }
});

/** reader.md section 4: a symbol that fails whole is split at the columns, before any staff test. */
describe("a symbol that passes once split is a chord row, not a staff row", () => {
  const twoColumns = "G |-5-7-|\nD |-----|\nA |-----|\nE |-----|";
  it.each([
    ["    D-G-7", ["D-", "G-7"]],
    ["    A-E-", ["A-", "E-"]],
    ["    G-D-", ["G-", "D-"]],
  ])("%s", (row, values) => {
    const parsed = parseTab(`${row}\n${twoColumns}`);
    expect(parsed.ok ? "ok" : parsed.refusals.map((r) => r.code).join(" ")).toBe("ok");
    expect(parsed.ok && parsed.clipboard.annotations.map((a) => a.value)).toEqual(values);
  });
});
