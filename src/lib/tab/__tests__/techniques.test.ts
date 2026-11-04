import { describe, expect, it } from "vitest";
import type { EventRow } from "../../model";
import { layoutPart, type Density } from "../layout";
import { DECORATIONS, decorate, drawnTransition, TRANSITIONS } from "../techniques";
import { allRows, barline, bass5, ev, rowOf, space } from "./helpers";

const E = 3; // the E string on a 5-string bass

type Shape = (arrive: string[]) => EventRow[];
const ARRIVE = 7;
const shapes: Record<string, Shape> = {
  alone: (t) => [ev({ [E]: ARRIVE }, { [E]: t })],
  "after a plain source": (t) => [ev({ [E]: 5 }), ev({ [E]: ARRIVE }, { [E]: t })],
  "two-digit source": (t) => [ev({ [E]: 12 }), ev({ [E]: ARRIVE }, { [E]: t })],
  "source widened to 2": (t) => [ev({ [E]: 5, 1: 10 }), ev({ [E]: ARRIVE }, { [E]: t })],
  "source widened to 3": (t) => [ev({ [E]: 5, 1: 7 }, { 1: ["bend", "vibrato"] }), ev({ [E]: ARRIVE }, { [E]: t })],
  "across a space": (t) => [ev({ [E]: 5 }), space(), ev({ [E]: ARRIVE }, { [E]: t })],
  "across a barline": (t) => [ev({ [E]: 5 }), barline(), ev({ [E]: ARRIVE }, { [E]: t })],
};
const all10 = [...TRANSITIONS.map((t) => t.id), ...DECORATIONS.map((d) => d.id)];

describe("the notation", () => {
  it("pins the exact fixture", () => {
    const events = [
      ev({ [E]: 5 }),
      ev({ [E]: 7 }, { [E]: ["hammer_on"] }),
      ev({ [E]: 7 }),
      ev({ [E]: 5 }, { [E]: ["pull_off"] }),
      ev({ [E]: 5 }),
      ev({ [E]: 7 }, { [E]: ["slide_up"] }),
      ev({ [E]: 7 }),
      ev({ [E]: 5 }, { [E]: ["slide_down"] }),
    ];
    expect(rowOf(events, E)).toBe("-5h7-7p5-5/7-7\\5-");
    const rows = allRows(events);
    expect(new Set(rows.map((r) => r.length)).size).toBe(1);
  });

  it("keeps every row the same length for 10 techniques x 2 densities x 7 shapes", () => {
    let parts = 0;
    for (const technique of all10) {
      for (const density of ["expanded", "compact"] as Density[]) {
        for (const [name, build] of Object.entries(shapes)) {
          const rows = allRows(build([technique]), density);
          expect(new Set(rows.map((r) => r.length)).size, `${technique} ${density} ${name}`).toBe(1);
          parts += 1;
        }
      }
    }
    expect(parts).toBe(140);
  });

  it("spaces the connector immediately before the arriving cell", () => {
    const h = ["hammer_on"];
    expect(rowOf(shapes["after a plain source"](h), E)).toBe("-5h7-");
    expect(rowOf(shapes["two-digit source"](h), E)).toBe("-12h7-");
    expect(rowOf(shapes["source widened to 2"](h), E)).toBe("-5-h7-");
    expect(rowOf(shapes["source widened to 3"](h), E)).toBe("-5--h7-");
    expect(rowOf(shapes["across a space"](h), E)).toBe("-5--h7-");
    expect(rowOf(shapes["across a barline"](h), E)).toBe("-5-|h7-");
    expect(rowOf(shapes.alone(h), E)).toBe("-7-");
    expect(rowOf(shapes["across a barline"](["slide_up"]), E)).toBe("-5-|/7-");
  });

  it("composes decorations and connectors", () => {
    const events = [
      ev({ [E]: 7 }, { [E]: ["vibrato"] }),
      ev({ [E]: 9 }, { [E]: ["hammer_on", "bend"] }),
    ];
    expect(rowOf(events, E)).toBe("-7~h9b-");
    expect(rowOf([ev({ [E]: 5 }), ev({ [E]: 7 }, { [E]: ["hammer_on", "tap"] })], E)).toBe(
      "-5ht7-",
    );
    expect(
      rowOf([ev({ [E]: 12 }, { [E]: ["tap"] }), ev({ [E]: 5 }, { [E]: ["pull_off"] })], E),
    ).toBe("-t12p5-");
  });

  it("draws all six on one note in the fixed order, in either stored order", () => {
    const ids = DECORATIONS.map((d) => d.id);
    expect(decorate("7", ids)).toBe("t(<7>)b~m");
    expect(decorate("7", [...ids].reverse())).toBe("t(<7>)b~m");
    expect(decorate("x", ["palm_mute"])).toBe("xm");
  });

  it("covers all 63 non-empty subsets in both orders on a fret, a two-digit fret and x", () => {
    const ids = DECORATIONS.map((d) => d.id);
    const oracle = (fret: string, set: string[]) => {
      let t = fret;
      if (set.includes("harmonic")) t = `<${t}>`;
      if (set.includes("let_ring")) t = `(${t})`;
      if (set.includes("tap")) t = `t${t}`;
      if (set.includes("bend")) t += "b";
      if (set.includes("vibrato")) t += "~";
      if (set.includes("palm_mute")) t += "m";
      return t;
    };
    let n = 0;
    for (let mask = 1; mask < 64; mask += 1) {
      const set = ids.filter((_, i) => mask & (1 << i));
      for (const stored of [set, [...set].reverse()]) {
        for (const [fret, text] of [
          [7, "7"],
          [12, "12"],
          ["x", "x"],
        ] as const) {
          const layout = layoutPart({ events: [ev({ [E]: fret }, { [E]: stored })], tuning: bass5 });
          expect(layout.columns[0].cells[E]).toBe(oracle(text, set));
          n += 1;
        }
      }
    }
    expect(n).toBe(63 * 2 * 3);
  });

  it("draws nothing for a connector without a source (INV-007 truth table)", () => {
    const h = { [E]: ["hammer_on"] };
    const cols = (events: EventRow[]) => layoutPart({ events, tuning: bass5 }).columns;
    expect(cols([ev({ [E]: 7 }, h)])[0].connectors[E]).toBeNull();
    expect(cols([ev({ 1: 5 }), ev({ [E]: 7 }, h)])[1].connectors[E]).toBeNull();
    expect(cols([ev({ [E]: 5 }), ev({}, h, { kind: "barline" })])[1].connectors.some(Boolean)).toBe(
      false,
    );
    expect(cols([ev({ [E]: 5 }), ev({}, h, { kind: "rest" })])[1].connectors.some(Boolean)).toBe(
      false,
    );
    expect(
      cols([ev({ [E]: 5 }), ev({ [E]: 7 }, { [E]: ["dead_note"] })])[1].connectors[E],
    ).toBeNull();
    expect(cols([ev({ [E]: 5 }), ev({ [E]: 7 }, { [E]: ["wobble"] })])[1].connectors[E]).toBeNull();
    expect(() => cols([ev({ [E]: 5 }), ev({ [E]: 7 }, { "9": ["hammer_on"] })])).not.toThrow();
    const pairs = [
      ["hammer_on", "slide_up"],
      ["slide_up", "hammer_on"],
      ["pull_off", "slide_down"],
      ["slide_down", "pull_off"],
      ["slide_up", "slide_down"],
      ["slide_down", "slide_up"],
    ];
    for (const pair of pairs) {
      const expected = drawnTransition(pair)!.glyph;
      expect(cols([ev({ [E]: 5 }), ev({ [E]: 7 }, { [E]: pair })])[1].connectors[E]).toBe(expected);
    }
  });

  it("draws two transitions into one column on different strings", () => {
    const events = [
      ev({ [E]: 5, 1: 3 }),
      ev({ [E]: 7, 1: 5 }, { [E]: ["hammer_on"], 1: ["slide_up"] }),
    ];
    expect(rowOf(events, E)).toBe("-5h7-");
    expect(rowOf(events, 1)).toBe("-3/5-");
  });
});
