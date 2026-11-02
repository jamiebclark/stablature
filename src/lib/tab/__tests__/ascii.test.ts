import { describe, expect, it } from "vitest";
import type { AnnotationRow, EventRow, FretMap } from "../../model";
import { presetById } from "../../tunings";
import { toAscii } from "../ascii";
import { eventsInBars, expandedLength, layoutPart, tupletSpans } from "../layout";

const bass5 = presetById("bass5-b")!; // G D A E B, index 0 = G
const bass4 = presetById("bass4-e")!;

let counter = 0;

/** A tab column. String indices: 0=G, 1=D, 2=A, 3=E, 4=B on a 5-string. */
function ev(frets: FretMap, overrides: Partial<EventRow> = {}): EventRow {
  counter += 1;
  return {
    id: `event-${counter}`,
    bandId: "band",
    partId: "part",
    rank: `a${counter}`,
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

const barline = () => ev({}, { kind: "barline" });

function chordOn(event: EventRow, value: string): AnnotationRow {
  return {
    id: `annotation-${value}`,
    bandId: "band",
    partId: "part",
    anchorEventId: event.id,
    kind: "chord",
    value,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
  };
}

describe("repeated notes", () => {
  it("unrolls a stored repeat into separate columns", () => {
    // How the data actually arrives: one row, repeat 4. Expanding it here is
    // what keeps the storage compact without making the page lie.
    const events = [ev({ "3": 7 }, { repeat: 4 })];
    expect(toAscii({ events, tuning: bass5 })).toBe(
      [
        "G |---------|",
        "D |---------|",
        "A |---------|",
        "E |-7-7-7-7-|",
        "B |---------|",
      ].join("\n"),
    );
  });

  it("collapses the same data in compact density", () => {
    const events = [ev({ "3": 7 }, { repeat: 8 })];
    expect(toAscii({ events, tuning: bass5, density: "compact" })).toBe(
      ["G |-----|", "D |-----|", "A |-----|", "E |-7x8-|", "B |-----|"].join("\n"),
    );
  });

  it("keeps strings aligned when a repeat label widens a column", () => {
    const events = [ev({ "3": 7 }, { repeat: 16 }), ev({ "3": 5 })];
    const lines = toAscii({ events, tuning: bass5, density: "compact" }).split("\n");
    // Every row must be the same length or the staff visibly shears.
    expect(new Set(lines.map((l) => l.length)).size).toBe(1);
    expect(lines[3]).toBe("E |-7x16-5-|");
  });
});

describe("alignment", () => {
  it("pads single-digit frets to match two-digit neighbours", () => {
    const events = [ev({ "3": 12 }), ev({ "3": 7 })];
    expect(toAscii({ events, tuning: bass5 })).toBe(
      ["G |------|", "D |------|", "A |------|", "E |-12-7-|", "B |------|"].join("\n"),
    );
  });

  it("renders a chord as one column across several strings", () => {
    const events = [ev({ "2": 5, "3": 7 })];
    expect(toAscii({ events, tuning: bass5 })).toBe(
      ["G |---|", "D |---|", "A |-5-|", "E |-7-|", "B |---|"].join("\n"),
    );
  });

  it("renders a dead note", () => {
    // Muted notes are everywhere in this music, so "x" has to be first-class.
    const events = [ev({ "3": "x" }), ev({ "3": 7 })];
    expect(toAscii({ events, tuning: bass5 }).split("\n")[3]).toBe("E |-x-7-|");
  });

  it("labels a 4-string staff with four rows", () => {
    const lines = toAscii({ events: [ev({ "3": 3 })], tuning: bass4 }).split("\n");
    expect(lines).toHaveLength(4);
    expect(lines.map((l) => l[0])).toEqual(["G", "D", "A", "E"]);
  });

  it("draws an empty part as an empty staff", () => {
    // What the capture screen shows before the first tap.
    expect(toAscii({ events: [], tuning: bass5 })).toBe(
      ["G |-|", "D |-|", "A |-|", "E |-|", "B |-|"].join("\n"),
    );
  });
});

describe("barlines", () => {
  it("draws them through every string", () => {
    const events = [ev({ "3": 7 }), barline(), ev({ "3": 5 })];
    expect(toAscii({ events, tuning: bass5 })).toBe(
      [
        "G |---|---|",
        "D |---|---|",
        "A |---|---|",
        "E |-7-|-5-|",
        "B |---|---|",
      ].join("\n"),
    );
  });

  it("numbers bars from the stored barlines, not from durations", () => {
    const events = [ev({ "3": 7 }), barline(), ev({ "3": 5 }), barline(), ev({ "3": 3 })];
    const layout = layoutPart({ events, tuning: bass5 });
    expect(layout.barCount).toBe(3);
    const notes = layout.columns.filter((c) => c.kind === "notes");
    expect(notes.map((c) => c.barNumber)).toEqual([1, 2, 3]);
  });

  it("counts a repeat's columns as all within the same bar", () => {
    const events = [ev({ "3": 7 }, { repeat: 4 }), barline(), ev({ "3": 5 })];
    const layout = layoutPart({ events, tuning: bass5 });
    const bars = layout.columns.filter((c) => c.kind === "notes").map((c) => c.barNumber);
    expect(bars).toEqual([1, 1, 1, 1, 2]);
  });
});

describe("tuplets", () => {
  it("brackets a triplet above the staff", () => {
    const triplet = "tuplet-1";
    const events = [
      ev({ "2": 5 }, { tupletId: triplet, tupletCount: 3 }),
      ev({ "2": 5 }, { tupletId: triplet, tupletCount: 3 }),
      ev({ "2": 5 }, { tupletId: triplet, tupletCount: 3 }),
    ];
    expect(toAscii({ events, tuning: bass5 })).toBe(
      [
        "    ,-3-,",
        "G |-------|",
        "D |-------|",
        "A |-5-5-5-|",
        "E |-------|",
        "B |-------|",
      ].join("\n"),
    );
  });

  it("brackets only the tuplet, not the notes around it", () => {
    const triplet = "tuplet-1";
    const events = [
      ev({ "3": 7 }),
      ev({ "2": 5 }, { tupletId: triplet, tupletCount: 3 }),
      ev({ "2": 5 }, { tupletId: triplet, tupletCount: 3 }),
      ev({ "2": 5 }, { tupletId: triplet, tupletCount: 3 }),
      ev({ "3": 7 }),
    ];
    const lines = toAscii({ events, tuning: bass5 }).split("\n");
    expect(lines[0]).toBe("      ,-3-,");
    expect(lines[4]).toBe("E |-7-------7-|");
  });

  it("finds spans as inclusive column ranges", () => {
    const triplet = "tuplet-1";
    const events = [
      ev({ "3": 7 }),
      ev({ "2": 5 }, { tupletId: triplet, tupletCount: 3 }),
      ev({ "2": 5 }, { tupletId: triplet, tupletCount: 3 }),
    ];
    expect(tupletSpans(layoutPart({ events, tuning: bass5 }))).toEqual([
      { tupletId: triplet, count: 3, start: 1, end: 2 },
    ]);
  });

  it("treats two adjacent tuplets as separate spans", () => {
    const events = [
      ev({ "3": 7 }, { tupletId: "t1", tupletCount: 3 }),
      ev({ "3": 7 }, { tupletId: "t2", tupletCount: 3 }),
    ];
    expect(tupletSpans(layoutPart({ events, tuning: bass5 }))).toHaveLength(2);
  });
});

describe("chords above the staff", () => {
  it("places a chord symbol over its column", () => {
    const first = ev({ "3": 7 });
    const events = [first, ev({ "3": 5 })];
    expect(toAscii({ events, tuning: bass5, annotations: [chordOn(first, "Am")] })).toBe(
      [
        "    Am",
        "G |-----|",
        "D |-----|",
        "A |-----|",
        "E |-7-5-|",
        "B |-----|",
      ].join("\n"),
    );
  });

  it("omits the chord row entirely when there are none", () => {
    expect(toAscii({ events: [ev({ "3": 7 })], tuning: bass5 }).split("\n")).toHaveLength(5);
  });

  it("labels only the first pass of a repeat", () => {
    // A chord belongs to the position, not to all eight hits of it.
    const first = ev({ "3": 7 }, { repeat: 4 });
    const layout = layoutPart({
      events: [first],
      tuning: bass5,
      annotations: [chordOn(first, "Am")],
    });
    expect(layout.columns.map((c) => c.chord)).toEqual(["Am", null, null, null]);
  });
});

describe("eventsInBars", () => {
  const events = [
    ev({ "3": 1 }),
    barline(),
    ev({ "3": 2 }),
    barline(),
    ev({ "3": 3 }),
    barline(),
    ev({ "3": 4 }),
  ];

  const fretsOf = (rows: EventRow[]) =>
    rows.filter((e) => e.kind === "notes").map((e) => e.frets["3"]);

  it("returns everything when both bounds are open", () => {
    expect(eventsInBars(events, null, null)).toHaveLength(events.length);
  });

  it("takes the first half of a part", () => {
    // This is "C, first half" in an arrangement.
    expect(fretsOf(eventsInBars(events, 1, 2))).toEqual([1, 2]);
  });

  it("takes a middle range", () => {
    expect(fretsOf(eventsInBars(events, 2, 3))).toEqual([2, 3]);
  });

  it("runs to the end with an open upper bound", () => {
    expect(fretsOf(eventsInBars(events, 3, null))).toEqual([3, 4]);
  });

  it("drops the barline that would trail the final bar", () => {
    // Otherwise a sliced part renders with a dangling empty bar.
    const sliced = eventsInBars(events, 1, 2);
    expect(sliced[sliced.length - 1].kind).toBe("notes");
    expect(sliced.filter((e) => e.kind === "barline")).toHaveLength(1);
  });

  it("returns nothing for a range past the end", () => {
    expect(fretsOf(eventsInBars(events, 9, 10))).toEqual([]);
  });
});

describe("expandedLength", () => {
  it("counts repeats and barlines", () => {
    const events = [ev({ "3": 7 }, { repeat: 8 }), barline(), ev({ "3": 5 }, { repeat: 2 })];
    expect(expandedLength(events)).toBe(11);
  });
});
