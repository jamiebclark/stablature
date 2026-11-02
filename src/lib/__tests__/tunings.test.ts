import { describe, expect, it } from "vitest";
import { midiToNote, noteToMidi, parseNoteLabel, pitchClass, transposeNote } from "../pitch";
import {
  DEFAULT_PRESET_ID,
  fretToMidi,
  presetById,
  sameTuning,
  stringCount,
  stringLabels,
  transposeTuning,
  TUNING_PRESETS,
} from "../tunings";

describe("pitch", () => {
  it("anchors to scientific pitch notation", () => {
    expect(noteToMidi({ note: "C", octave: 4 })).toBe(60);
    expect(noteToMidi({ note: "E", octave: 1 })).toBe(28); // standard bass low E
    expect(noteToMidi({ note: "B", octave: 0 })).toBe(23); // 5-string low B
    expect(noteToMidi({ note: "G", octave: 2 })).toBe(43); // bass G string
  });

  it("reads accidentals in both directions", () => {
    expect(pitchClass("F#")).toBe(6);
    expect(pitchClass("Gb")).toBe(6);
    expect(noteToMidi({ note: "Bb", octave: 1 })).toBe(34);
    expect(noteToMidi({ note: "A#", octave: 1 })).toBe(34);
  });

  it("wraps double flats without going negative", () => {
    expect(pitchClass("Cbb")).toBe(10);
  });

  it("round-trips through MIDI", () => {
    for (let midi = 20; midi < 80; midi += 1) {
      expect(noteToMidi(midiToNote(midi))).toBe(midi);
    }
  });

  it("spells flats on request", () => {
    expect(midiToNote(34, "sharp").note).toBe("A#");
    expect(midiToNote(34, "flat").note).toBe("Bb");
  });

  it("parses labels, including negative octaves", () => {
    expect(parseNoteLabel("F#2")).toEqual({ note: "F#", octave: 2 });
    expect(parseNoteLabel("C-1")).toEqual({ note: "C", octave: -1 });
    expect(() => parseNoteLabel("H4")).toThrow(SyntaxError);
  });

  it("transposes across an octave boundary", () => {
    expect(transposeNote({ note: "B", octave: 0 }, 1)).toEqual({ note: "C", octave: 1 });
  });
});

describe("presets", () => {
  it("defaults to a 5-string, which is what the user plays", () => {
    const preset = presetById(DEFAULT_PRESET_ID);
    expect(preset?.family).toBe("Bass 5");
    expect(stringCount(preset!)).toBe(5);
  });

  it("stores every preset highest string first", () => {
    // String index 0 is the highest pitch. If a preset were entered backwards
    // the whole fretboard grid would render upside down.
    for (const preset of TUNING_PRESETS) {
      const midi = preset.strings.map((s) => noteToMidi(s));
      expect(midi, preset.id).toEqual([...midi].sort((a, b) => b - a));
    }
  });

  it("has unique ids", () => {
    expect(new Set(TUNING_PRESETS.map((p) => p.id)).size).toBe(TUNING_PRESETS.length);
  });

  it("labels strings in render order", () => {
    expect(stringLabels(presetById("bass5-b")!)).toEqual(["G2", "D2", "A1", "E1", "B0"]);
  });

  it("models drop tunings as only the lowest string moving", () => {
    const standard = presetById("bass5-b")!;
    const dropped = presetById("bass5-drop-a")!;
    expect(dropped.strings.slice(0, 4)).toEqual(standard.strings.slice(0, 4));
    expect(noteToMidi(dropped.strings[4])).toBe(noteToMidi(standard.strings[4]) - 2);
  });
});

describe("fretToMidi", () => {
  const bass5 = presetById("bass5-b")!;

  it("treats fret 0 as the open string", () => {
    expect(fretToMidi(bass5, 4, 0)).toBe(noteToMidi({ note: "B", octave: 0 }));
  });

  it("adds one semitone per fret", () => {
    expect(fretToMidi(bass5, 0, 5)).toBe(48); // G2 + 5 = C3
    expect(fretToMidi(bass5, 3, 7)).toBe(35); // E1 + 7 = B1
  });

  it("agrees with itself across equivalent positions", () => {
    // 5th fret of the E string is the open A string -- a real fretboard
    // invariant, and a good check that indexing runs high-to-low.
    expect(fretToMidi(bass5, 3, 5)).toBe(fretToMidi(bass5, 2, 0));
  });

  it("rejects strings and frets that do not exist", () => {
    expect(() => fretToMidi(bass5, 5, 0)).toThrow(/does not exist/);
    expect(() => fretToMidi(bass5, 0, -1)).toThrow(RangeError);
  });
});

describe("transposeTuning", () => {
  it("turns B standard into A standard a whole step down", () => {
    const down = transposeTuning(presetById("bass5-b")!, -2);
    expect(sameTuning(down, presetById("bass5-a")!)).toBe(true);
  });

  it("compares by sound, not by spelling", () => {
    // transposeTuning yields sharps; the preset is written with flats.
    expect(
      sameTuning({ strings: [{ note: "D#", octave: 2 }] }, { strings: [{ note: "Eb", octave: 2 }] }),
    ).toBe(true);
  });

  it("treats different string counts as different tunings", () => {
    expect(sameTuning(presetById("bass4-e")!, presetById("bass5-b")!)).toBe(false);
  });
});
