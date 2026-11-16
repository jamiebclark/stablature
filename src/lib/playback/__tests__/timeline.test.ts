import { describe, expect, it } from "vitest";
import { drawnPasses, partPass } from "@/lib/arrangement/passes";
import { noteToMidi } from "@/lib/pitch";
import { readingStops, columnKey } from "@/lib/reading/position";
import { presetById, TUNING_PRESETS } from "@/lib/tunings";
import { HARMONIC_NODES, lengthRule, playTimeline } from "../timeline";
import { LEN, partT, passesOf } from "./fixtures";
import { ev } from "@/lib/tab/__tests__/helpers";

const bass = presetById("bass4-e")!;

describe("INV-003 length corpus", () => {
  it.each(LEN)("$id", (row) => {
    const t = playTimeline(passesOf(row.passes), bass);
    expect(t.hits.map((h) => h.tick)).toEqual(row.starts);
    expect(t.hits.map((h) => h.ticks)).toEqual(row.lengths);
    expect(t.lengthTicks).toBe(row.total);
    expect(t.rule).toBe(row.rule);
    expect(lengthRule(passesOf(row.passes))).toBe(row.rule);
  });

  it("writes nothing back to the rows", () => {
    const passes = passesOf(["3:5@8 3:5"]);
    const before = JSON.stringify(passes);
    playTimeline(passes, bass);
    expect(JSON.stringify(passes)).toBe(before);
  });

  it("L6: a looped L5 starts round two at its own length", () => {
    const first = playTimeline(passesOf(["3:5@8 3:5", "3:5"]), bass);
    const later = playTimeline(passesOf(["3:5@8 3:5", "3:5"]), bass, { after: first });
    expect(later.hits.map((h) => h.tick)).toEqual(first.hits.map((h) => h.tick));
    expect(later.lengthTicks).toBe(first.lengthTicks);
  });
});

describe("INV-002 pitch corpus", () => {
  const open = (label: string) => noteToMidi({ note: /^[A-G][#b]?/.exec(label)![0], octave: Number(/-?\d+$/.exec(label)![0]) });
  it("every preset × string × fret", () => {
    for (const preset of TUNING_PRESETS) {
      preset.strings.forEach((string, s) => {
        for (const fret of [0, 1, 5, 12, 24]) {
          const t = playTimeline(passesOf([`${s}:${fret}@q`]), preset);
          expect(t.voices).toHaveLength(1);
          // Hand table: C=0 … from the label's letter and octave.
          const letter = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[string.note[0] as "C"];
          const acc = string.note.includes("#") ? 1 : string.note.includes("b") ? -1 : 0;
          expect(t.voices[0].voice.midi).toBe((string.octave + 1) * 12 + letter + acc + fret);
        }
      });
    }
    void open;
  });

  it("the lowest note of all is F0, MIDI 17", () => {
    const f = TUNING_PRESETS.find((p) => p.id === "bass5-drop-f");
    if (!f) return;
    const t = playTimeline(passesOf([`${f.strings.length - 1}:0@q`]), f);
    expect(t.voices[0].voice.midi).toBe(17);
  });

  it("harmonic nodes", () => {
    expect(HARMONIC_NODES).toEqual({ 12: 12, 7: 19, 19: 19, 5: 24, 24: 24, 4: 28, 9: 28, 16: 28 });
  });

  it("T19: bad strings and frets are silent, the rest of the column is kept, nothing throws", () => {
    const events = [ev({ "9": 3, "3": 5, "a": 2, "3.5": 1 as never }), ev({ "3": -1 as never }), ev({ "3": 2.5 as never })];
    const t = playTimeline([{ step: passesOf([""])[0].step, events }], bass);
    expect(t.voices.map((v) => [v.string, v.voice.midi])).toEqual([[3, 33]]);
    expect(t.hits).toHaveLength(3);
  });
});

describe("INV-006 hits equal the reading stops", () => {
  it("via drawnPasses and via partPass", () => {
    const events = partT();
    const part = { id: "t" };
    const viaPart = [partPass(part, events)];
    const viaDrawn = drawnPasses([viaPart[0].step, viaPart[0].step], { t: events });
    for (const passes of [viaPart, viaDrawn]) {
      const t = playTimeline(passes, bass);
      const bars = new Set(passes.flatMap((p) => p.events.filter((e) => e.kind === "barline").map((e) => columnKey(e.id, 0))));
      const want = readingStops(passes, passes.map(() => 0))
        .filter((s) => !bars.has(s.key))
        .map((s) => [s.pass, s.key]);
      const got = t.hits.map((h) => [h.pass, columnKey(h.eventId, h.repetition)]);
      expect(got).toEqual(want);
    }
  });
});
