/**
 * Round 6. INV-006 names `E1` for `E`, and its probe only ever wrote that label before a pipe. Over
 * the other path a label can take, a note name then a rail, the same two characters are a label and
 * a first fret at once: `G5-7-` is `G5` then a 7, or `G` then a 5 and a 7. The reader takes the digit
 * as an octave, and an octave is ignored, so the 5 is stored nowhere and nothing is listed. The text
 * cannot say which it is, and spec.md line 15 refuses where reading would mean guessing at notes.
 *
 * Every row here holds a digit that may be a note, so every paste must refuse. The guards below keep
 * the labels that are not in doubt: a digit before a pipe, and a note name with no digit.
 */
import { describe, expect, it } from "vitest";
import { presetById } from "@/lib/tunings";
import { eventsOf, imported, reading, world } from "./unit-helpers";

const PRESETS = ["bass4-e", "bass5-b", "guitar6-e"];
const FIRST_FRETS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const ENDS: [string, string][] = [
  ["a rail", "-7-"],
  ["a note", "-7"],
  ["a closing pipe", "-7-|"],
];

const names = (id: string) => presetById(id)!.strings.map((s) => s.note);
const flush = (id: string, fret: number, end: string) =>
  names(id)
    .map((n) => `${n}${fret}${end}`)
    .join("\n");

describe("INV-006 a digit flush on a label, with no pipe, is not guessed at", () => {
  for (const id of PRESETS) {
    for (const [endName, end] of ENDS) {
      it.each(FIRST_FRETS)(`${id}, ending on ${endName}: fret %i`, async (fret) => {
        const w = await world(id);
        const text = flush(id, fret, end);
        expect({ text, kind: (await reading(w, text)).kind }).toEqual({ text, kind: "refused" });
      });
    }
  }

  it.each([
    ["lower case", "g5-7-\nd5-7-\na3-5-\ne3-5-"],
    ["several notes after it", "G5-7-5-7-\nD5-7-5-7-\nA3-5-3-5-\nE3-5-3-5-"],
    ["a run of rails after it", "G5---7---\nD5---7---\nA3---5---\nE3---5---"],
    ["two systems", "G5-7-\nD5-7-\nA3-5-\nE3-5-\n\nG5-7-\nD5-7-\nA3-5-\nE3-5-"],
    ["an octave label as a person might mean it", "G2---5---\nD2---5---\nA1---3---\nE1---3---"],
  ])("%s", async (_name, text) => {
    const w = await world("bass4-e");
    expect({ text, kind: (await reading(w, text)).kind }).toEqual({ text, kind: "refused" });
  });

  it("what is stored when it is not", async () => {
    const w = await world("bass4-e");
    const text = "G5-7-5-7-\nD5-7-5-7-\nA3-5-3-5-\nE3-5-3-5-";
    const r = await reading(w, text);
    if (r.kind !== "ready") return;
    const { part } = await imported(w, text);
    const frets = (await eventsOf(w, part.id)).map((e) => e.frets);
    console.log("stored:", JSON.stringify(frets), "ignored:", JSON.stringify(r.ignored), "notes:", JSON.stringify(r.notes));
    // Four notes on the top row of the paste, as a person reads it.
    expect(frets).toHaveLength(4);
  });
});

describe("INV-006 the labels that are not in doubt keep reading", () => {
  it.each([
    ["an octave before a pipe", "G2|-5-|\nD2|---|\nA1|---|\nE1|-3-|"],
    ["an octave and a space before a pipe", "G2 |-5-|\nD2 |---|\nA1 |---|\nE1 |-3-|"],
    ["a note name then a rail", "G-5-7-\nD-5-7-\nA-3-5-\nE-3-5-"],
    ["a note name, a space, then rails", "G ---5---\nD ---5---\nA ---3---\nE ---3---"],
    ["a note name then a run of rails", "G---5---\nD---5---\nA---3---\nE---3---"],
    ["a note name then a pipe", "G|-5-|\nD|-5-|\nA|-3-|\nE|-3-|"],
  ])("%s", async (_name, text) => {
    const w = await world("bass4-e");
    expect((await reading(w, text)).kind).toBe("ready");
  });
});
