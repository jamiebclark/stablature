/** Performance guard for INV-030: a large paste reads in a bounded time. */
import { describe, expect, it } from "vitest";
import { draftPart } from "../../local/clipboard";
import { TUNING_PRESETS, fretToMidi, presetById } from "../../tunings";
import { pitchClass } from "../parse";
import { toAscii } from "../ascii";
import { readTab } from "../reading";
import { ev } from "./helpers";

const tuning = presetById("bass4-e")!;
const context = { tuning, bandTunings: [], songEvents: [] };

describe("readTab at size", () => {
  for (const density of ["expanded", "compact"] as const) {
    it(`reads 2,000 columns (${density}) within a generous bound`, () => {
      const events = Array.from({ length: 2000 }, (_, i) => ev({ [String(i % 4)]: (i % 9) + 1 }));
      const text = toAscii({ events, tuning, density });
      const start = performance.now();
      const reading = readTab(text, context);
      expect(performance.now() - start).toBeLessThan(2000);
      expect(reading.kind).toBe("ready");
    });
  }

  it("reads 5,000 lines of lyrics without trouble", () => {
    const text = Array.from({ length: 5000 }, (_, i) => `la la la ${i}`).join("\n");
    const start = performance.now();
    const reading = readTab(text, context);
    expect(performance.now() - start).toBeLessThan(2000);
    expect(["refused", "idle"]).toContain(reading.kind);
  });
});

/** INV-006 and INV-018: a note never changes pitch or string, whatever tuning the paste names. */
describe("readTab fits and offers across tunings", () => {

  const onEvery = (count: number) =>
    Array.from({ length: count }, (_, i) => ev({ [String(i)]: 3 + i }));
  const noteOn = (stringIndex: number) => ev({ [String(stringIndex)]: 3 });

  it("offers the paste's exact tuning to an empty song, and draws in it", () => {
    const b5 = presetById("bass5-b")!;
    const reading = readTab(toAscii({ events: onEvery(5), tuning: b5, density: "expanded" }), context);
    if (reading.kind !== "ready") throw new Error(reading.kind);
    expect(reading.fit.kind).toBe("offer");
    expect(reading.fitKey).toBe("preset:bass5-b");
    expect(reading.tuning.strings.map((s) => s.note)).toEqual(b5.strings.map((s) => s.note));
  });

  it("matches Eb Bb F C with D# A# F C by name, so the song's tuning fits", () => {
    const c = presetById("bass4-c")!;
    const sharp = { strings: ["D#", "A#", "F", "C"].map((note, i) => ({ ...c.strings[i], note })) };
    const reading = readTab(toAscii({ events: onEvery(4), tuning: sharp, density: "expanded" }), {
      tuning: c,
      bandTunings: [],
      songEvents: [],
    });
    expect(reading.kind === "ready" && reading.fit.kind).toBe("fits");
  });

  it("refuses six rows on a five-string song that holds notes", () => {
    const g6 = presetById("guitar6-e")!;
    const reading = readTab(toAscii({ events: onEvery(6), tuning: g6, density: "expanded" }), {
      tuning: presetById("bass5-b")!,
      bandTunings: [],
      songEvents: [noteOn(0)],
    });
    expect(reading.kind).toBe("refused");
  });

  it("offered names equal the paste's exactly", () => {
    for (const preset of TUNING_PRESETS) {
      const text = toAscii({ events: onEvery(preset.strings.length), tuning: preset, density: "expanded" });
      const reading = readTab(text, { tuning: null, bandTunings: [], songEvents: [] });
      if (reading.kind !== "ready") continue;
      const labels = text.split("\n").filter((l) => l.includes("|")).map((l) => l.slice(0, l.indexOf("|")).trim());
      expect(reading.tuning.strings.map((s) => pitchClass(s.note))).toEqual(labels.map((l) => pitchClass(l)));
    }
  });

  it("never moves a note or changes its pitch: every preset pair, a note on each string in turn", () => {
    for (const song of TUNING_PRESETS) {
      for (const paste of TUNING_PRESETS) {
        const text = toAscii({ events: onEvery(paste.strings.length), tuning: paste, density: "expanded" });
        for (let used = -1; used < song.strings.length; used += 1) {
          const songEvents = used < 0 ? [] : [noteOn(used)];
          const reading = readTab(text, { tuning: song, bandTunings: [], songEvents });
          if (reading.kind !== "ready") continue;
          for (const [key, fret] of songEvents.flatMap((e) => Object.entries(e.frets))) {
            expect(fretToMidi(reading.tuning, Number(key), fret as number)).toBe(
              fretToMidi(song, Number(key), fret as number),
            );
          }
          for (const e of draftPart(reading.clipboard).events) {
            for (const key of Object.keys(e.frets)) {
              const at = reading.tuning.strings[Number(key)];
              expect(at).toBeDefined();
              expect(pitchClass(at.note)).toBe(pitchClass(paste.strings[Number(key)].note));
            }
          }
        }
      }
    }
  });
});
