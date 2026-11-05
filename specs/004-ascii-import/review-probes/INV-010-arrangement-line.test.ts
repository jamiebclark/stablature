/**
 * Round 9. INV-010 names the `Arrangement` line of one part cut from an export, and spec.md's edge
 * cases accept it as commentary. `INV-010-commentary.test.ts` calls `songToText` with `entries: []`,
 * so no arrangement line was ever drawn. T089 now asks a question of every line wherever it sits,
 * and accepts that `A 1-8` refuses, so this draws the real line from real entries, and the real meta
 * line from every preset.
 */
import { describe, expect, it } from "vitest";
import { songToText } from "@/lib/export/text";
import type { ArrangementEntryRow, EventRow, PartRow } from "@/lib/model";
import { TUNING_PRESETS, presetById } from "@/lib/tunings";
import { clip } from "./unit-helpers";

function part(id: string, label: string): PartRow {
  return { id, label, name: null, notes: null, variantOfPartId: null } as unknown as PartRow;
}

function event(id: string, fret: number): EventRow {
  return {
    id,
    kind: "notes",
    frets: { "0": fret },
    techniques: {},
    repeat: 1,
    durationHint: null,
    tupletId: null,
    tupletCount: null,
    groupKind: null,
  } as unknown as EventRow;
}

type Entry = Partial<ArrangementEntryRow> & Pick<ArrangementEntryRow, "kind">;

function entry(fields: Entry): ArrangementEntryRow {
  return {
    id: crypto.randomUUID(),
    partId: null,
    repeat: 1,
    fromBar: null,
    toBar: null,
    lastRepeatPartId: null,
    label: null,
    ...fields,
  } as ArrangementEntryRow;
}

const A = part("a", "A");
const B = part("b", "B");
const on = (partId: string, more: Partial<ArrangementEntryRow> = {}) => entry({ kind: "part", partId, ...more });

const ARRANGEMENTS: [string, ArrangementEntryRow[]][] = [
  ["one part", [on("a")]],
  ["two parts", [on("a"), on("b")]],
  ["a repeat", [on("a", { repeat: 4 }), on("b")]],
  ["a bar range", [on("a", { fromBar: 1, toBar: 2 })]],
  ["a wide bar range", [on("a", { fromBar: 1, toBar: 16 }), on("b", { fromBar: 9, toBar: 16 })]],
  ["one bar", [on("a", { fromBar: 3, toBar: 3 })]],
  ["from a bar", [on("a", { fromBar: 3 })]],
  ["to a bar", [on("a", { toBar: 3 })]],
  ["a repeat with a bar range", [on("a", { repeat: 2, fromBar: 1, toBar: 2 })]],
  ["a last pass", [on("a", { repeat: 4, lastRepeatPartId: "b" })]],
  ["a last pass with a bar range", [on("a", { repeat: 4, lastRepeatPartId: "b", fromBar: 1, toBar: 2 })]],
  [
    "a section",
    [entry({ kind: "section_start", label: "Chorus", repeat: 2 }), on("a"), on("b", { repeat: 2 }), entry({ kind: "section_end" })],
  ],
  ["an unnamed section", [entry({ kind: "section_start", repeat: 2 }), on("a", { fromBar: 1, toBar: 4 }), entry({ kind: "section_end" })]],
  ["a text entry", [on("a"), entry({ kind: "text", label: "drums only" }), on("b")]],
];

function cut(entries: ArrangementEntryRow[], fields: { band?: string; tuningName?: string; preset?: string; bpm?: number | null }) {
  const text = songToText({
    song: { title: "Dirge", bpm: fields.bpm === undefined ? 120 : fields.bpm, notes: null } as never,
    bandName: fields.band,
    tuning: presetById(fields.preset ?? "bass4-e")!,
    tuningName: fields.tuningName,
    parts: [A, B],
    eventsByPart: { a: [event("a1", 5), event("a2", 7)], b: [] },
    entries,
  });
  // One part cut from it: everything down to the end of the first staff.
  const lines = text.split("\n");
  const last = lines.findIndex((l, i) => l.includes("|") && !(lines[i + 1] ?? "").includes("|"));
  return lines.slice(0, last + 1).join("\n");
}

function expectAllListed(text: string) {
  const expected = text
    .split("\n")
    .map((l, i) => ({ line: i + 1, text: l }))
    .filter((l) => l.text.trim() !== "" && !l.text.includes("|"));
  expect(clip(text).ignored).toEqual(expected);
}

describe("INV-010 the real arrangement line, from real entries, is listed", () => {
  it.each(ARRANGEMENTS)("%s", (_name, entries) => {
    const text = cut(entries, { band: "Hollow Crown", tuningName: "E Standard" });
    expect(text).toContain("Arrangement");
    expectAllListed(text);
  });
});

describe("INV-010 the real meta line of every preset is listed", () => {
  for (const preset of TUNING_PRESETS) {
    it.each([
      ["with a band and a tempo", { band: "Hollow Crown", bpm: 120 }],
      ["with no band", { bpm: 120 }],
      ["with no tempo", { band: "Hollow Crown", bpm: null }],
      ["with neither", { bpm: null }],
    ] as const)(`${preset.id} %s`, (_name, fields) => {
      expectAllListed(cut([], { ...fields, tuningName: preset.name, preset: preset.id }));
    });
  }
});
