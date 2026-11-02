import { describe, expect, it } from "vitest";
import type {
  AnnotationRow,
  ArrangementEntryRow,
  EventRow,
  FretMap,
  PartRow,
} from "../../model";
import { presetById } from "../../tunings";
import { exportFilename, songToText } from "../text";

const bass5 = presetById("bass5-b")!;

let seq = 0;
const next = () => (seq += 1);

function ev(frets: FretMap, overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: `e${next()}`,
    bandId: "band",
    partId: "pa",
    rank: `a${seq}`,
    kind: "notes",
    frets,
    techniques: {},
    repeat: 1,
    durationHint: null,
    tupletId: null,
    tupletCount: null,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
    ...overrides,
  };
}

function part(id: string, label: string, overrides: Partial<PartRow> = {}): PartRow {
  return {
    id,
    bandId: "band",
    songId: "song",
    label,
    name: null,
    rank: `a${label}`,
    variantOfPartId: null,
    notes: null,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
    ...overrides,
  };
}

function entry(overrides: Partial<ArrangementEntryRow>): ArrangementEntryRow {
  return {
    id: `x${next()}`,
    bandId: "band",
    songId: "song",
    rank: `a${seq}`,
    kind: "part",
    partId: null,
    repeat: 1,
    fromBar: null,
    toBar: null,
    lastRepeatPartId: null,
    label: null,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
    ...overrides,
  };
}

const song = { title: "Dirge", bpm: null as number | null, notes: null as string | null };

describe("songToText", () => {
  it("renders a whole song the way the screen shows it", () => {
    const a = part("pa", "A", { name: "main riff" });
    const b = part("pb", "B");

    const text = songToText({
      song: { ...song, bpm: 122 },
      bandName: "Hollow Crown",
      tuning: bass5,
      tuningName: "B Standard",
      parts: [a, b],
      eventsByPart: {
        pa: [ev({ "3": 7 }, { partId: "pa", repeat: 4 })],
        pb: [ev({ "2": 5 }, { partId: "pb" })],
      },
      entries: [
        entry({ partId: "pa", repeat: 4 }),
        entry({ partId: "pb" }),
      ],
    });

    expect(text).toBe(
      [
        "Dirge",
        "Hollow Crown  ·  B Standard (G2 D2 A1 E1 B0)  ·  122 bpm",
        "",
        "Arrangement",
        "  Ax4  B",
        "",
        "A  main riff",
        "G |---------|",
        "D |---------|",
        "A |---------|",
        "E |-7-7-7-7-|",
        "B |---------|",
        "",
        "B",
        "G |---|",
        "D |---|",
        "A |-5-|",
        "E |---|",
        "B |---|",
        "",
      ].join("\n"),
    );
  });

  it("honours compact density", () => {
    const text = songToText(
      {
        song,
        tuning: bass5,
        parts: [part("pa", "A")],
        eventsByPart: { pa: [ev({ "3": 7 }, { partId: "pa", repeat: 8 })] },
        entries: [],
      },
      { density: "compact" },
    );
    expect(text).toContain("E |-7x8-|");
  });

  it("marks a variant and what it varies from", () => {
    const a = part("pa", "A");
    const variant = part("pv", "A'", { variantOfPartId: "pa" });

    const text = songToText({
      song,
      tuning: bass5,
      parts: [a, variant],
      eventsByPart: { pa: [ev({ "3": 7 }, { partId: "pa" })], pv: [ev({ "3": 9 }, { partId: "pv" })] },
      entries: [entry({ partId: "pa", repeat: 4, lastRepeatPartId: "pv" })],
    });

    expect(text).toContain("A'   (variant of A)");
    // The arrangement line is where the variant's role is actually explained.
    expect(text).toContain("Ax4 (4th: A')");
  });

  it("includes chords above the staff", () => {
    const first = ev({ "3": 7 }, { partId: "pa" });
    const chord: AnnotationRow = {
      id: "an1",
      bandId: "band",
      partId: "pa",
      anchorEventId: first.id,
      kind: "chord",
      value: "Am",
      updatedAt: "x",
      deletedAt: null,
      fieldClocks: {},
      serverSeq: 0,
    };

    const text = songToText({
      song,
      tuning: bass5,
      parts: [part("pa", "A")],
      eventsByPart: { pa: [first] },
      annotationsByPart: { pa: [chord] },
      entries: [],
    });

    expect(text).toContain("Am");
  });

  it("includes song and part notes", () => {
    const text = songToText({
      song: { ...song, notes: "  half-step down live  " },
      tuning: bass5,
      parts: [part("pa", "A", { notes: "let the last note ring" })],
      eventsByPart: { pa: [ev({ "3": 7 }, { partId: "pa" })] },
      entries: [],
    });

    expect(text).toContain("half-step down live");
    expect(text).toContain("let the last note ring");
  });

  it("omits the arrangement section when there is none", () => {
    const text = songToText({
      song,
      tuning: bass5,
      parts: [part("pa", "A")],
      eventsByPart: { pa: [] },
      entries: [],
    });
    expect(text).not.toContain("Arrangement");
  });

  it("renders a song with no parts at all", () => {
    const text = songToText({ song, tuning: bass5, parts: [], eventsByPart: {}, entries: [] });
    expect(text.trim()).toBe("Dirge\nG2 D2 A1 E1 B0");
  });

  it("ends with a newline, because this is a file as often as a paste", () => {
    const text = songToText({ song, tuning: bass5, parts: [], eventsByPart: {}, entries: [] });
    expect(text.endsWith("\n")).toBe(true);
  });
});

describe("exportFilename", () => {
  it("makes a safe filename", () => {
    expect(exportFilename("Dirge")).toBe("dirge.txt");
    expect(exportFilename("Hollow Crown / Pt. II")).toBe("hollow-crown-pt-ii.txt");
  });

  it("falls back when a title has nothing usable", () => {
    expect(exportFilename("***")).toBe("song.txt");
    expect(exportFilename("")).toBe("song.txt");
  });
});
