/**
 * INV-004, INV-007, INV-008, INV-026 through the public `layoutPart`, `toAscii`, `eventsInBars`.
 *
 * The suite's 140-part and repeat matrices assert only equal row lengths. These assert the
 * exact text, from an oracle written from spec.md's tables and not from techniques.ts.
 */
import { describe, expect, it } from "vitest";
import { toAscii } from "@/lib/tab/ascii";
import { eventsInBars, layoutPart, type Density } from "@/lib/tab/layout";
import { allRows, barline, bass5, ev, rowOf, space } from "@/lib/tab/__tests__/helpers";

const E = 3;
const TRANS: Record<string, string> = { hammer_on: "h", pull_off: "p", slide_up: "/", slide_down: "\\" };
const DECOR: Record<string, (f: string) => string> = {
  vibrato: (f) => `${f}~`,
  harmonic: (f) => `<${f}>`,
  let_ring: (f) => `(${f})`,
  bend: (f) => `${f}b`,
  tap: (f) => `t${f}`,
  palm_mute: (f) => `${f}m`,
};
const ALL = [...Object.keys(TRANS), ...Object.keys(DECOR)];

interface Shape {
  events: (t: string[]) => ReturnType<typeof ev>[];
  /** The row before the arrival, with its pad, and without the one gap character. */
  lead: string;
  source: boolean;
}

const SHAPES: Record<string, Shape> = {
  alone: { events: (t) => [ev({ [E]: 7 }, { [E]: t })], lead: "", source: false },
  "plain source": { events: (t) => [ev({ [E]: 5 }), ev({ [E]: 7 }, { [E]: t })], lead: "5", source: true },
  "two-digit source": { events: (t) => [ev({ [E]: 12 }), ev({ [E]: 7 }, { [E]: t })], lead: "12", source: true },
  "source widened to 2": {
    events: (t) => [ev({ [E]: 5, 1: 10 }), ev({ [E]: 7 }, { [E]: t })],
    lead: "5-",
    source: true,
  },
  "source widened to 3": {
    events: (t) => [ev({ [E]: 5, 1: 7 }, { 1: ["bend", "vibrato"] }), ev({ [E]: 7 }, { [E]: t })],
    lead: "5--",
    source: true,
  },
  "across a space": {
    events: (t) => [ev({ [E]: 5 }), space(), ev({ [E]: 7 }, { [E]: t })],
    lead: "5--",
    source: true,
  },
  "across a barline": {
    events: (t) => [ev({ [E]: 5 }), barline(), ev({ [E]: 7 }, { [E]: t })],
    lead: "5-|",
    source: true,
  },
};

describe("INV-004", () => {
  for (const technique of ALL) {
    for (const density of ["expanded", "compact"] as Density[]) {
      for (const [name, shape] of Object.entries(SHAPES)) {
        it(`${technique} ${density} ${name}`, () => {
          const events = shape.events([technique]);
          const arrival = DECOR[technique] ? DECOR[technique]("7") : "7";
          const gap = TRANS[technique] && shape.source ? TRANS[technique] : shape.lead ? "-" : "";
          expect(rowOf(events, E, density)).toBe(`-${shape.lead}${gap}${arrival}-`);
          expect(new Set(allRows(events, density).map((r) => r.length)).size).toBe(1);
        });
      }
    }
  }

  it("all six on one note and two transitions into one column", () => {
    const six = ["palm_mute", "tap", "vibrato", "let_ring", "bend", "harmonic"];
    expect(rowOf([ev({ [E]: 7 }, { [E]: six })], E)).toBe("-t(<7>)b~m-");
    expect(rowOf([ev({ [E]: 7 }, { [E]: six }, { repeat: 2 })], E, "compact")).toBe("-t(<7>)b~mx2-");
    const two = [ev({ [E]: 5, 1: 3 }), ev({ [E]: 7, 1: 5 }, { [E]: ["hammer_on"], 1: ["slide_down"] })];
    expect(rowOf(two, E)).toBe("-5h7-");
    expect(rowOf(two, 1)).toBe("-3\\5-");
    expect(new Set(allRows(two).map((r) => r.length)).size).toBe(1);
  });
});

describe("INV-007", () => {
  const cols = (events: ReturnType<typeof ev>[]) => layoutPart({ events, tuning: bass5 }).columns;

  // The 8 rows of note x transition x earlier note: drawn only when all three are true.
  for (const note of [true, false]) {
    for (const transition of [true, false]) {
      for (const earlier of [true, false]) {
        it(`note=${note} transition=${transition} earlier=${earlier}`, () => {
          const arrival = ev(note ? { [E]: 7 } : { 1: 3 }, transition ? { [E]: ["hammer_on"] } : {});
          const events = earlier ? [ev({ [E]: 5 }), arrival] : [arrival];
          const drawn = cols(events).at(-1)!.connectors[E];
          expect(drawn).toBe(note && transition && earlier ? "h" : null);
        });
      }
    }
  }

  it("source shapes", () => {
    const h = { [E]: ["hammer_on"] };
    expect(cols([ev({ [E]: 7 }, h)])[0].connectors[E]).toBeNull();
    expect(cols([ev({ 1: 5 }), ev({ [E]: 7 }, h)])[1].connectors[E]).toBeNull();
    expect(cols([ev({ [E]: 5 }), space(), ev({ [E]: 7 }, h)])[2].connectors[E]).toBe("h");
    expect(cols([ev({ [E]: 5 }), barline(), ev({ [E]: 7 }, h)])[2].connectors[E]).toBe("h");
  });

  it("a source cut off by eventsInBars draws nothing, and the stored transition is untouched", () => {
    const events = [
      ev({ [E]: 5 }),
      barline(),
      ev({ [E]: 7 }, { [E]: ["hammer_on"] }),
      ev({ [E]: 9 }, { [E]: ["pull_off"] }),
    ];
    expect(rowOf(events, E)).toBe("-5-|h7p9-");
    const slice = eventsInBars(events, 2, null);
    expect(rowOf(slice, E)).toBe("-7p9-");
    expect(slice[0].techniques).toEqual({ [E]: ["hammer_on"] });
  });

  it("technique on a barline, a rest, dead_note, an unknown string", () => {
    const h = { [E]: ["hammer_on"] };
    expect(cols([ev({ [E]: 5 }), ev({}, h, { kind: "barline" })])[1].connectors.some(Boolean)).toBe(false);
    expect(cols([ev({ [E]: 5 }), ev({}, h, { kind: "rest" })])[1].connectors.some(Boolean)).toBe(false);
    expect(rowOf([ev({ [E]: 5 }), ev({ [E]: 7 }, { [E]: ["dead_note"] })], E)).toBe("-5-7-");
    expect(rowOf([ev({ [E]: 5 }), ev({ [E]: 7 }, { "99": ["hammer_on"] })], E)).toBe("-5-7-");
    expect(rowOf([ev({ [E]: 5 }), ev({ [E]: 7 }, { [E]: ["wobble"] })], E)).toBe("-5-7-");
    // A technique on a string with no note in that column, then a plain note on that string.
    expect(rowOf([ev({ [E]: 5 }), ev({ 1: 3 }, h), ev({ [E]: 7 })], E)).toBe("-5---7-");
  });

  const order = ["hammer_on", "pull_off", "slide_up", "slide_down"];
  for (let a = 0; a < 4; a += 1) {
    for (let b = a + 1; b < 4; b += 1) {
      for (const stored of [[order[a], order[b]], [order[b], order[a]]]) {
        it(`two stored: ${stored.join(",")} draws ${order[a]}`, () => {
          expect(cols([ev({ [E]: 5 }), ev({ [E]: 7 }, { [E]: stored })])[1].connectors[E]).toBe(TRANS[order[a]]);
        });
      }
    }
  }
});

describe("INV-008", () => {
  for (const technique of ALL) {
    for (const repeat of [1, 3]) {
      for (const source of [true, false]) {
        const events = () => [
          ...(source ? [ev({ [E]: 5 })] : []),
          ev({ [E]: 7 }, { [E]: [technique] }, { repeat }),
        ];
        const cell = DECOR[technique] ? DECOR[technique]("7") : "7";
        const glyph = TRANS[technique];
        it(`${technique} expanded repeat ${repeat} source ${source}`, () => {
          let want = source ? "5" : "";
          for (let i = 0; i < repeat; i += 1) {
            want += want.length === 0 ? "" : (glyph ?? "-");
            want += cell;
          }
          expect(rowOf(events(), E, "expanded")).toBe(`-${want}-`);
        });
        it(`${technique} compact repeat ${repeat} source ${source}`, () => {
          const label = repeat > 1 ? `x${repeat}` : "";
          const lead = source ? `5${glyph ?? "-"}` : "";
          expect(rowOf(events(), E, "compact")).toBe(`-${lead}${cell}${label}-`);
        });
      }
    }
  }
});

describe("INV-026", () => {
  const ids = Object.keys(DECOR);
  const oracle = (fret: string, set: string[]) => {
    let inner = fret;
    if (set.includes("harmonic")) inner = `<${inner}>`;
    if (set.includes("let_ring")) inner = `(${inner})`;
    return [
      set.includes("tap") ? "t" : "",
      inner,
      set.includes("bend") ? "b" : "",
      set.includes("vibrato") ? "~" : "",
      set.includes("palm_mute") ? "m" : "",
    ].join("");
  };
  it("63 subsets x 2 orders x 3 frets through toAscii", () => {
    let n = 0;
    for (let mask = 1; mask < 64; mask += 1) {
      const set = ids.filter((_, i) => mask & (1 << i));
      for (const stored of [set, [...set].reverse()]) {
        for (const [fret, text] of [[7, "7"], [12, "12"], ["x", "x"]] as const) {
          const out = toAscii({ events: [ev({ [E]: fret }, { [E]: stored })], tuning: bass5 });
          expect(out).toContain(`|-${oracle(text, set)}-|`);
          n += 1;
        }
      }
    }
    expect(n).toBe(378);
  });
});
