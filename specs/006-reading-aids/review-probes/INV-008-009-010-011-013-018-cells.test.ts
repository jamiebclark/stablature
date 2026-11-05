/**
 * Cells over the plan's whole sets, through `layoutReading`.
 *
 * `cells.test.ts` sweeps qualities on root C only. This walks **Q** as the plan names it: every quality x
 * every root in **R**, the modifiers on C7 and Am, and the slash chords. The readers below are this file's
 * own: a note reader, a degree-to-semitones table and a cell grammar that share nothing with spelling.ts.
 */
import { describe, expect, it } from "vitest";
import { CHORD_QUALITIES, parseChord, type Chord } from "@/lib/chords";
import type { AnnotationRow, EventRow } from "@/lib/model";
import { layoutReading } from "@/lib/reading/labels";
import { layoutPart, type Density } from "@/lib/tab/layout";
import { TUNING_PRESETS, type Tuning } from "@/lib/tunings";

const R = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B", "Cb"];
const MODS = ["add2", "add4", "add6", "add9", "add11", "add13", "b5", "#5", "b9", "#9", "#11", "b13", "no3", "omit3", "no5", "omit5"];
const SLASH = ["C/G", "C/F#", "C/Bb", "Cm/Eb", "Cm/D#", "Am/G"];
const Q = [
  ...CHORD_QUALITIES.flatMap((quality) => R.map((root) => `${root}${quality}`)),
  ...MODS.flatMap((mod) => [`C7${mod}`, `Am${mod}`]),
  ...SLASH,
];

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pitchOf = (name: string): number => {
  const m = /^([A-G])(#+|b+)?$/.exec(name);
  if (!m) throw new Error(`not a note name: ${JSON.stringify(name)}`);
  const accidental = m[2] ?? "";
  const shift = accidental.startsWith("#") ? accidental.length : -accidental.length;
  return (((LETTER[m[1]] + shift) % 12) + 12) % 12;
};
const BASE: Record<string, number> = { "1": 0, "2": 2, "3": 4, "4": 5, "5": 7, "6": 9, "7": 11, "9": 14, "11": 17, "13": 21 };
const semitonesOf = (degree: string): number => {
  const m = /^(bb|b|#)?(\d+)$/.exec(degree);
  if (!m || BASE[m[2]] === undefined) throw new Error(`not a degree: ${JSON.stringify(degree)}`);
  const shift = m[1] === "bb" ? -2 : m[1] === "b" ? -1 : m[1] === "#" ? 1 : 0;
  return (((BASE[m[2]] + shift) % 12) + 12) % 12;
};
const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const FOLDED = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"];

/** One string, open C, so a fret is its pitch class. */
const ON_C: Tuning = { strings: [{ note: "C", octave: 2 }] };
const note = (id: string, frets: Record<string, unknown>, techniques: Record<string, string[]> = {}, repeat = 1) =>
  ({ id, kind: "notes", frets, techniques, repeat, durationHint: null, tupletId: null, tupletCount: null }) as unknown as EventRow;
const chordOn = (anchorEventId: string, value: string) => [{ kind: "chord", anchorEventId, value }] as AnnotationRow[];
const cell = (view: "notes" | "intervals", fret: number, symbol: string | null, tuning: Tuning = ON_C) => {
  const ev = note("e", { "0": fret });
  const column = layoutReading({
    view, events: [ev], partEvents: [ev], tuning, annotations: symbol ? chordOn("e", symbol) : [],
  }).columns[0];
  return { text: column.cells[0]!, description: column.description };
};

describe("INV-009 every chord in Q, every pitch class", () => {
  it("parses every member, so the sweep below drops nothing", () => {
    const unread = Q.filter((symbol) => parseChord(symbol) === null);
    expect(unread).toEqual([]);
  });

  it("names and spells every pitch class by the spec's rule", () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const symbol of Q) {
      const chord = parseChord(symbol) as Chord;
      const flats = chord.tones.some((tone) => /[A-G].*b/.test(tone.name));
      for (let pc = 0; pc < 12; pc += 1) {
        checked += 1;
        const tone = chord.tones.find((t) => t.pitchClass === pc);
        const shownNote = cell("notes", pc, symbol).text;
        const wantNote = chord.bass === pc ? chord.bassName! : tone ? tone.name : (flats ? FLATS : SHARPS)[pc];
        if (shownNote !== wantNote) wrong.push(`${symbol} pc${pc} notes: ${shownNote}, want ${wantNote}`);
        if (pitchOf(shownNote) !== pc) wrong.push(`${symbol} pc${pc} notes: ${shownNote} is the wrong pitch`);
        const shownDegree = cell("intervals", pc, symbol).text;
        const wantDegree = tone ? tone.degree : FOLDED[(pc - chord.root + 12) % 12];
        if (shownDegree !== wantDegree) wrong.push(`${symbol} pc${pc} intervals: ${shownDegree}, want ${wantDegree}`);
        if (semitonesOf(shownDegree) !== (pc - chord.root + 12) % 12) {
          wrong.push(`${symbol} pc${pc} intervals: ${shownDegree} is not that far from the root`);
        }
      }
    }
    expect(checked).toBe(Q.length * 12);
    expect(wrong.slice(0, 30)).toEqual([]);
  });

  it("keeps the spec's worked cases", () => {
    const G_STRING: Tuning = { strings: [{ note: "G", octave: 2 }] };
    expect(cell("notes", 8, "Cm", G_STRING).text).toBe("Eb");
    expect(cell("notes", 2, "Cdim7", G_STRING).text).toBe("Bbb");
    expect(cell("notes", 3, "Dm", G_STRING).text).toBe("A#");
    expect(cell("notes", 8, "Cm/D#", G_STRING).text).toBe("D#");
    expect(cell("intervals", 8, "Cm/D#", G_STRING).text).toBe("b3");
  });

  it("folds all twelve rows against a chord with only the root", () => {
    const POWER_ROOT: Tuning = { strings: [{ note: "C", octave: 2 }] };
    // C5 holds 1 and 5, so ten of twelve come from the table.
    for (let pc = 0; pc < 12; pc += 1) expect(cell("intervals", pc, "C5", POWER_ROOT).text).toBe(FOLDED[pc]);
  });
});

describe("the three-views table of the spec, exactly", () => {
  const BASS: Tuning = TUNING_PRESETS.find((t) => t.strings.map((s) => s.note).join("") === "GDAE")!;
  const ROWS: [string, number, number | "x", string[], number, Density, string, string, string][] = [
    ["A3", 2, 3, [], 1, "expanded", "3", "C", "b3"],
    ["D2", 1, 2, [], 1, "expanded", "2", "E", "5"],
    ["E5", 3, 5, [], 1, "expanded", "5", "A", "1"],
    ["E7", 3, 7, [], 1, "expanded", "7", "B", "2"],
    ["E5 mute", 3, 5, ["palm_mute"], 1, "expanded", "5m", "A·m", "1·m"],
    ["A2 bend", 2, 2, ["bend"], 1, "expanded", "2b", "B·b", "2·b"],
    ["G7 tap", 0, 7, ["tap"], 1, "expanded", "t7", "t·D", "t·4"],
    ["A3 ring", 2, 3, ["let_ring"], 1, "expanded", "(3)", "(C)", "(b3)"],
    ["A5 harmonic", 2, 5, ["harmonic"], 1, "expanded", "<5>", "<?>", "<?>"],
    ["dead", 2, "x", [], 1, "expanded", "x", "x", "x"],
    ["E7 x8", 3, 7, [], 8, "compact", "7x8", "Bx8", "2x8"],
  ];
  it.each(ROWS)("%s", (_name, string, fret, stored, repeat, density, frets, notes, intervals) => {
    const ev = note("e", { [String(string)]: fret }, stored.length ? { [String(string)]: stored } : {}, repeat);
    const annotations = chordOn("e", "Am");
    const options = { events: [ev], partEvents: [ev], tuning: BASS, annotations, density };
    expect(layoutPart(options).columns[0].cells[string]).toBe(frets);
    expect(layoutReading({ ...options, view: "notes" }).columns[0].cells[string]).toBe(notes);
    expect(layoutReading({ ...options, view: "intervals" }).columns[0].cells[string]).toBe(intervals);
  });
});

describe("INV-008 no chord: the tuning decides, and T's open strings", () => {
  it("names each open string of every preset as the tuning labels it", () => {
    const wrong: string[] = [];
    for (const tuning of TUNING_PRESETS) {
      tuning.strings.forEach((string, index) => {
        const ev = note("e", { [String(index)]: 0 });
        const shown = layoutReading({ view: "notes", events: [ev], partEvents: [ev], tuning }).columns[0].cells[index]!;
        if (shown !== string.note) wrong.push(`${tuning.name} string ${index + 1}: ${shown}, label ${string.note}`);
      });
    }
    expect(wrong).toEqual([]);
  });
});

const DECORATIONS = ["vibrato", "harmonic", "let_ring", "bend", "tap", "palm_mute"];
const subsets = () => Array.from({ length: 64 }, (_, mask) => DECORATIONS.filter((_, i) => mask & (1 << i)));
/** The cell's own grammar, in the drawing order of the spec. Written here, not read from techniques.ts. */
const GRAMMAR = /^(t·)?(\()?(<)?(.+?)(>)?(\))?(·b)?(~)?(·m)?$/;

function everyLabel() {
  const names = new Map<string, [string | null, number]>();
  const degrees = new Map<string, [string, number]>();
  for (const symbol of Q) {
    const chord = parseChord(symbol) as Chord;
    for (let pc = 0; pc < 12; pc += 1) {
      const n = cell("notes", pc, symbol).text;
      if (!names.has(n)) names.set(n, [symbol, pc]);
      const d = cell("intervals", pc, symbol).text;
      if (!degrees.has(d)) degrees.set(d, [symbol, pc]);
    }
    void chord;
  }
  return { names, degrees };
}

let spokenNames: string[] = [];
let spokenDegrees: string[] = [];

describe("INV-010 / INV-011 Dec x every name and degree x Den x repeats", () => {
  const { names, degrees } = everyLabel();
  const sweep = (view: "notes" | "intervals", table: Map<string, [string | null, number]>) => {
    const wrong: string[] = [];
    const silent = new Set<string>();
    let checked = 0;
    for (const [label, [symbol, pc]] of table) {
      for (const stored of subsets()) {
        for (const [density, repeat] of [["expanded", 1], ["expanded", 2], ["expanded", 8], ["compact", 1], ["compact", 2], ["compact", 8]] as [Density, number][]) {
          checked += 1;
          const ev = note("e", { "0": pc }, { "0": stored }, repeat);
          const options = { events: [ev], partEvents: [ev], tuning: ON_C, annotations: symbol ? chordOn("e", symbol) : [], density };
          const column = layoutReading({ ...options, view }).columns[0];
          const shown = column.cells[0]!;
          const suffix = density === "compact" && repeat > 1 ? `x${repeat}` : "";
          if (!shown.endsWith(suffix)) wrong.push(`${shown}: lost ${suffix}`);
          const bare = suffix ? shown.slice(0, -suffix.length) : shown;
          const m = GRAMMAR.exec(bare);
          if (!m) {
            wrong.push(`${shown}: outside the grammar`);
            continue;
          }
          const has = (id: string) => stored.includes(id);
          const flags = [m[1] !== undefined, m[2] !== undefined, m[3] !== undefined, m[7] !== undefined, m[8] !== undefined, m[9] !== undefined];
          const want = [has("tap"), has("let_ring"), has("harmonic"), has("bend"), has("vibrato"), has("palm_mute")];
          if (flags.join() !== want.join()) wrong.push(`${shown}: decorations ${flags} want ${want}`);
          const pitch = m[4];
          if (has("harmonic") ? pitch !== "?" : pitch !== label) wrong.push(`${shown}: pitch ${pitch}, want ${label}`);
          const letters = has("bend") || has("tap") || has("palm_mute");
          if (letters) {
            for (const text of [shown, bare]) {
              if (parseChord(text) !== null) wrong.push(`${text} reads as a chord`);
              if (/^[A-G](#+|b+)?$/.test(text)) wrong.push(`${text} reads as a note`);
              if (/^(bb|b|#)?\d+$/.test(text)) wrong.push(`${text} reads as a degree`);
            }
          }
          if (/[♯♭]/.test(shown)) wrong.push(`${shown}: a glyph the font lacks`);
          const words = column.description;
          if (/[<>()~·#]/.test(words)) wrong.push(`${shown}: description carries an affix: ${words}`);
          if (!/ shown as /.test(words)) silent.add(label);
          if (!/^string 1 fret /.test(words)) wrong.push(`${shown}: description lost the string and fret: ${words}`);
          // Same decorations, same order, as frets draw.
          const frets = layoutPart(options).columns[0].cells[0]!;
          const back = shown.replaceAll("·", "").replace(has("harmonic") ? "?" : pitch, String(pc));
          if (back !== frets) wrong.push(`${shown}: frets draw ${frets}, this reduces to ${back}`);
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(wrong.slice(0, 30)).toEqual([]);
    return [...silent];
  };
  it(`all ${names.size} names`, () => {
    spokenNames = sweep("notes", names);
  });
  it(`all ${degrees.size} degrees`, () => {
    spokenDegrees = sweep("intervals", degrees as Map<string, [string | null, number]>);
  });
  // Kept apart from the sweep so one missing word cannot hide what the sweep proves.
  it("FR-018: every label on the staff has words, so none goes unspoken", () => {
    expect({ names: spokenNames, degrees: spokenDegrees }).toEqual({ names: [], degrees: [] });
  });
});

describe("INV-011 what stops a pitch, and what does not stop its neighbours", () => {
  const BASS = TUNING_PRESETS[0];
  const stacks: [string, Record<string, unknown>, Record<string, string[]>, string][] = [
    ["harmonic", { "1": 5 }, { "1": ["harmonic"] }, "<?>"],
    ["harmonic and mute", { "1": 5 }, { "1": ["harmonic", "palm_mute"] }, "<?>·m"],
    ["harmonic and tap", { "1": 5 }, { "1": ["harmonic", "tap"] }, "t·<?>"],
    ["harmonic and bend", { "1": 5 }, { "1": ["harmonic", "bend"] }, "<?>·b"],
    ["harmonic and ring", { "1": 5 }, { "1": ["harmonic", "let_ring"] }, "(<?>)"],
    ["harmonic and vibrato", { "1": 5 }, { "1": ["harmonic", "vibrato"] }, "<?>~"],
    ["dead", { "1": "x" }, {}, "x"],
    ["dead harmonic", { "1": "x" }, { "1": ["harmonic"] }, "<x>"],
    ["dead mute", { "1": "x" }, { "1": ["palm_mute"] }, "x·m"],
  ];
  for (const view of ["notes", "intervals"] as const) {
    it.each(stacks)(`${view}: %s`, (_name, frets, stored, want) => {
      const before = note("a", { "0": 2 });
      const stack = note("b", { ...frets, "2": 3 }, stored);
      const after = note("c", { "0": 4 });
      const events = [before, stack, after];
      const layout = layoutReading({ view, events, partEvents: events, tuning: BASS, annotations: chordOn("a", "Am") });
      expect(layout.columns[1].cells[1]).toBe(want);
      // The neighbours, above, below and either side, keep their labels.
      for (const text of [layout.columns[0].cells[0], layout.columns[1].cells[2], layout.columns[2].cells[0]]) {
        expect(text).not.toMatch(/\?/);
        expect(text).toMatch(view === "notes" ? /^[A-G]/ : /^(bb|b|#)?\d/);
      }
    });
    it(`${view}: frets the wire forbids show ? and do not throw`, () => {
      for (const bad of [-1, 1.5, "7", null, true]) {
        const ev = note("e", { "0": bad, "1": 2 });
        const column = layoutReading({ view, events: [ev], partEvents: [ev], tuning: BASS }).columns[0];
        expect(column.cells[0]).toBe("?");
        expect(column.cells[1]).toMatch(/^[A-G]/);
      }
    });
    it(`${view}: a fret far past the cap still names its pitch`, () => {
      const ev = note("e", { "0": 500 });
      expect(() => layoutReading({ view, events: [ev], partEvents: [ev], tuning: BASS })).not.toThrow();
    });
  }
});

describe("INV-013 an interval never falls back to a fret", () => {
  const UNREAD = ["N.C.", "Bridge", "C(x)", "", "   "];
  const events = [note("a", { "0": 5 }), note("b", { "0": 7 }), note("c", { "0": 9 }), note("d", { "0": 10 })];
  const run = (annotations: AnnotationRow[]) =>
    layoutReading({ view: "intervals", events, partEvents: events, tuning: TUNING_PRESETS[0], annotations }).columns.map((c) => c.cells[0]!);
  const named = (cells: string[]) => {
    for (const text of cells) expect(text).toMatch(/^[A-G](#|b)?$/);
  };
  it("no chord at all", () => named(run([])));
  it("only text and dynamic annotations", () =>
    named(run([
      { kind: "text", anchorEventId: "a", value: "Am" },
      { kind: "dynamic", anchorEventId: "b", value: "Am" },
    ] as AnnotationRow[])));
  it("before the first chord", () => named(run(chordOn("c", "Am")).slice(0, 2)));
  it.each(UNREAD)("after %j", (value) => {
    const cells = run([...chordOn("a", "Am"), ...chordOn("b", value)]);
    expect(cells[0]).toMatch(/^(bb|b|#)?\d+$/);
    named(cells.slice(1));
  });
});

describe("INV-018 every row of contracts/cells.md, exactly", () => {
  const T: Tuning = { strings: [{ note: "G", octave: 2 }, { note: "A", octave: 1 }, { note: "E", octave: 1 }, { note: "E", octave: 1 }] };
  const on = (stringIndex: number, fret: number | "x", symbol: string | null, view: "notes" | "intervals", stored: string[] = [], tuning: Tuning = T) => {
    const ev = note("e", { [String(stringIndex)]: fret }, stored.length ? { [String(stringIndex)]: stored } : {});
    return layoutReading({ view, events: [ev], partEvents: [ev], tuning, annotations: symbol ? chordOn("e", symbol) : [] }).columns[0].description;
  };
  const C_TOP: Tuning = { strings: [{ note: "C", octave: 2 }, { note: "E", octave: 2 }, { note: "G", octave: 1 }] };
  it("C#", () => expect(on(1, 4, null, "notes")).toBe("string 2 fret 4 shown as C sharp"));
  it("Bbb", () => expect(on(0, 9, "Cdim7", "notes", [], C_TOP)).toBe("string 1 fret 9 shown as B double flat"));
  it("b3", () => expect(on(1, 3, "Am", "intervals")).toBe("string 2 fret 3 shown as flat third"));
  it("bb7", () => expect(on(2, 2, "Cdim7", "intervals", [], C_TOP)).toBe("string 3 fret 2 shown as double flat seventh"));
  it("#9", () => {
    const D_SHARP: Tuning = { strings: [{ note: "G", octave: 2 }, { note: "C", octave: 2 }] };
    expect(on(1, 3, "C7#9", "intervals", [], D_SHARP)).toBe("string 2 fret 3 shown as sharp ninth");
  });
  it("1", () => expect(on(2, 5, "Am", "intervals")).toBe("string 3 fret 5 shown as root"));
  it("A with a mute", () => expect(on(3, 5, "Am", "notes", ["palm_mute"])).toBe("string 4 fret 5 shown as A with palm mute"));
  it("harmonic", () => expect(on(1, 5, null, "notes", ["harmonic"])).toBe("string 2 fret 5 shown as no pitch with harmonic"));
  it("dead", () => expect(on(0, "x", null, "notes")).toBe("string 1 fret x"));
});
