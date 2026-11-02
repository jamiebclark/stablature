import { describe, expect, it } from "vitest";
import {
  chordInForceAt,
  chordToneMap,
  chordToneNames,
  parseChord,
  type ChordRole,
} from "../chords";
import type { AnnotationRow, EventRow } from "../model";

/** The notes of a chord as a chart would write them, for compact assertions. */
const notes = (symbol: string): string => {
  const chord = parseChord(symbol);
  if (!chord) throw new Error(`Expected ${symbol} to parse`);
  return chordToneNames(chord).join(" ");
};

const roleOf = (symbol: string, degree: string): ChordRole | undefined =>
  parseChord(symbol)?.tones.find((tone) => tone.degree === degree)?.role;

describe("parseChord", () => {
  it("reads the triads", () => {
    expect(notes("C")).toBe("C E G");
    expect(notes("Cm")).toBe("C Eb G");
    expect(notes("Cdim")).toBe("C Eb Gb");
    expect(notes("Caug")).toBe("C E G#");
    expect(notes("Csus4")).toBe("C F G");
    expect(notes("Csus2")).toBe("C D G");
  });

  it("reads a power chord, which is root and fifth only", () => {
    expect(notes("E5")).toBe("E B");
    expect(parseChord("E5")?.tones).toHaveLength(2);
  });

  it("reads the sevenths", () => {
    expect(notes("C7")).toBe("C E G Bb");
    expect(notes("Cmaj7")).toBe("C E G B");
    expect(notes("Cm7")).toBe("C Eb G Bb");
    expect(notes("Cm7b5")).toBe("C Eb Gb Bb");
    expect(notes("Cdim7")).toBe("C Eb Gb Bbb");
    expect(notes("Cmmaj7")).toBe("C Eb G B");
  });

  it("reads sixths, ninths and the stacked extensions", () => {
    expect(notes("C6")).toBe("C E G A");
    expect(notes("Cm6")).toBe("C Eb G A");
    expect(notes("C69")).toBe("C D E G A");
    expect(notes("C9")).toBe("C D E G Bb");
    expect(notes("Cm9")).toBe("C D Eb G Bb");
    expect(notes("Cmaj9")).toBe("C D E G B");
    expect(notes("C13")).toBe("C D E G A Bb");
  });

  it("separates add9 from 9 by whether there is a seventh", () => {
    expect(notes("Cadd9")).toBe("C D E G");
    expect(notes("C9")).toBe("C D E G Bb");
  });

  it("applies alterations after the quality, in any order", () => {
    expect(notes("C7b9")).toBe("C Db E G Bb");
    expect(notes("C7#9")).toBe("C D# E G Bb"); // the Hendrix chord
    expect(notes("C7b5")).toBe("C E Gb Bb");
    expect(notes("C7#11")).toBe("C E F# G Bb");
    expect(notes("Csus4add9")).toBe("C D F G");
  });

  it("drops tones on request", () => {
    expect(notes("C7no3")).toBe("C G Bb");
    expect(notes("Cno5")).toBe("C E");
  });

  it("spells by letter rather than by preference", () => {
    // A third above C is always some E, so the b3 of Cm cannot be a D#.
    expect(notes("Cm")).toBe("C Eb G");
    expect(notes("Gm")).toBe("G Bb D");
    expect(notes("F7")).toBe("F A C Eb");
    expect(notes("Bb")).toBe("Bb D F");
    expect(notes("C#")).toBe("C# E# G#");
    expect(notes("Ebm7")).toBe("Eb Gb Bb Db");
  });

  it("accepts the aliases people actually type", () => {
    expect(notes("Cmin7")).toBe(notes("Cm7"));
    expect(notes("C-7")).toBe(notes("Cm7"));
    expect(notes("CM7")).toBe(notes("Cmaj7"));
    expect(notes("Cmajor")).toBe(notes("C"));
    expect(notes("C(add9)")).toBe(notes("Cadd9"));
    expect(notes("C add9")).toBe(notes("Cadd9"));
    expect(notes("C♯m")).toBe(notes("C#m"));
    expect(notes("Bb7")).toBe(notes("B♭7"));
    expect(notes("Cø")).toBe(notes("Cm7b5"));
    expect(notes("C°7")).toBe(notes("Cdim7"));
    expect(notes("am7")).toBe(notes("Am7"));
  });

  it("keeps m and M apart, since that is the one case where case means something", () => {
    expect(notes("Cm7")).toBe("C Eb G Bb");
    expect(notes("CM7")).toBe("C E G B");
  });

  it("reads a slash bass without mistaking 6/9 for one", () => {
    expect(parseChord("C/E")?.bass).toBe(4);
    expect(parseChord("C/E")?.quality).toBe("");
    expect(parseChord("D/F#")?.bass).toBe(6);
    expect(parseChord("C6/9")?.bass).toBeNull();
    expect(notes("C6/9")).toBe("C D E G A");
  });

  it("tags each tone with what it is doing", () => {
    expect(roleOf("Cm7", "1")).toBe("root");
    expect(roleOf("Cm7", "b3")).toBe("third");
    expect(roleOf("Cm7", "5")).toBe("fifth");
    expect(roleOf("Cm7", "b7")).toBe("seventh");
    expect(roleOf("C9", "9")).toBe("extension");
    // A flat five is still the chord's fifth, which is why b5 replaces it
    // rather than stacking beside it.
    expect(roleOf("C7b5", "b5")).toBe("fifth");
    expect(parseChord("C7b5")?.tones.filter((t) => t.role === "fifth")).toHaveLength(1);
  });

  it("calls a diminished seventh a seventh and a sixth an extension", () => {
    // Both are nine semitones up, and only the degree tells them apart.
    expect(roleOf("Cdim7", "bb7")).toBe("seventh");
    expect(roleOf("C6", "6")).toBe("extension");
  });

  it("returns null rather than guessing", () => {
    expect(parseChord("")).toBeNull();
    expect(parseChord("   ")).toBeNull();
    expect(parseChord("N.C.")).toBeNull();
    expect(parseChord("Am7 then G")).toBeNull();
    expect(parseChord("Cwhatever")).toBeNull();
    expect(parseChord("H7")).toBeNull(); // not a note name here
    expect(parseChord("riff A")).toBeNull();
  });

  it("keeps the symbol as typed", () => {
    expect(parseChord("  Am7  ")?.symbol).toBe("Am7");
  });
});

describe("chordToneMap", () => {
  it("maps pitch class to role, which is what the fretboard matches on", () => {
    const chord = parseChord("Am7")!;
    const map = chordToneMap(chord);
    expect(map.get(9)).toBe("root"); // A
    expect(map.get(0)).toBe("third"); // C
    expect(map.get(4)).toBe("fifth"); // E
    expect(map.get(7)).toBe("seventh"); // G
    expect(map.size).toBe(4);
  });

  it("includes a slash bass that is not otherwise in the chord", () => {
    const map = chordToneMap(parseChord("C/F#")!);
    expect(map.get(6)).toBe("bass");
    expect(map.size).toBe(4);
  });

  it("leaves a slash bass that is already a chord tone in its harmonic role", () => {
    const map = chordToneMap(parseChord("C/E")!);
    expect(map.get(4)).toBe("third");
    expect(map.size).toBe(3);
  });
});

/* ---------- chordInForceAt ---------- */

const event = (id: string, kind: EventRow["kind"] = "notes"): EventRow =>
  ({ id, kind }) as EventRow;

const chordAt = (anchorEventId: string | null, value: string): AnnotationRow =>
  ({ kind: "chord", anchorEventId, value }) as AnnotationRow;

describe("chordInForceAt", () => {
  const events = [event("a"), event("b"), event("bar", "barline"), event("c"), event("d")];

  it("carries a chord forward until the next one", () => {
    const annotations = [chordAt("a", "Am"), chordAt("c", "F")];
    expect(chordInForceAt(events, annotations, "a")).toBe("Am");
    expect(chordInForceAt(events, annotations, "b")).toBe("Am");
    expect(chordInForceAt(events, annotations, "c")).toBe("F");
    expect(chordInForceAt(events, annotations, "d")).toBe("F");
  });

  it("carries a chord across a barline", () => {
    expect(chordInForceAt(events, [chordAt("a", "Am")], "d")).toBe("Am");
  });

  it("does not let a later chord leak backwards", () => {
    expect(chordInForceAt(events, [chordAt("c", "F")], "a")).toBeNull();
  });

  it("has nothing in force before the first chord, or with no chords at all", () => {
    expect(chordInForceAt(events, [], "a")).toBeNull();
    expect(chordInForceAt(events, [chordAt("b", "Am")], "a")).toBeNull();
  });

  it("has nothing in force at the start of a part", () => {
    expect(chordInForceAt(events, [chordAt("a", "Am")], null)).toBeNull();
  });

  it("skips annotations that are not anchored to a column", () => {
    const annotations = [chordAt(null, "Am"), chordAt("c", "F")];
    expect(chordInForceAt(events, annotations, "a")).toBeNull();
    expect(chordInForceAt(events, annotations, "c")).toBe("F");
  });

  it("ignores annotations that are not chords", () => {
    const text = { kind: "text", anchorEventId: "a", value: "let ring" } as AnnotationRow;
    expect(chordInForceAt(events, [text], "b")).toBeNull();
  });

  it("claims nothing for a column the part does not have", () => {
    expect(chordInForceAt(events, [chordAt("a", "Am")], "gone")).toBeNull();
  });
});
