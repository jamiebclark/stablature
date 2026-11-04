import { describe, expect, it } from "vitest";
import type { EventRow } from "../../model";
import { toAscii } from "../ascii";
import type { Density } from "../layout";
import { barline, bass5, ev } from "./helpers";

const counted = (id: string, n: number | null) =>
  ({ tupletId: id, tupletCount: n, groupKind: "tuplet" }) as Partial<EventRow>;
const plain = (id: string) =>
  ({ tupletId: id, tupletCount: null, groupKind: "plain" }) as Partial<EventRow>;

/** The bracket row alone, without its gutter. */
function bracketRow(events: EventRow[], density: Density = "expanded", showTuplets = true) {
  const text = toAscii({ events, tuning: bass5, density, showTuplets });
  const lines = text.split("\n");
  const staff = lines[lines.length - bass5.strings.length];
  const gutter = staff.indexOf("|") + 1;
  return lines.length > bass5.strings.length ? lines[0].slice(gutter) : null;
}

const cols = (n: number, group: Partial<EventRow> | null, fret = 5) =>
  Array.from({ length: n }, () => ev({ "2": fret }, {}, group ?? {}));

describe("INV-021: exact bracket strings", () => {
  it.each([
    [2, ",-,"],
    [3, ",---,"],
    [4, ",-----,"],
  ])("a plain group of %i columns is %s", (n, text) => {
    expect(bracketRow(cols(n, plain("g")))?.trim()).toBe(text);
  });

  it.each([
    [2, ",2,"],
    [3, ",-3-,"],
    [4, ",--4--,"],
  ])("a counted tuplet of %i columns is %s", (n, text) => {
    expect(bracketRow(cols(n, counted("g", n)))?.trim()).toBe(text);
  });

  it("separates adjacent plain pairs by the gap", () => {
    const events = [...cols(2, plain("a")), ...cols(2, plain("b"))];
    expect(bracketRow(events)?.trim()).toBe(",-, ,-,");
  });

  it("showTuplets: false hides both kinds", () => {
    expect(bracketRow(cols(3, plain("g")), "expanded", false)).toBeNull();
    expect(bracketRow(cols(3, counted("g", 3)), "expanded", false)).toBeNull();
  });

  it("draws a plain group beside a counted one", () => {
    const events = [...cols(2, plain("a")), ...cols(3, counted("b", 3))];
    expect(bracketRow(events)?.trim()).toBe(",-, ,-3-,");
  });

  it("draws a one-column remnant as a bare comma, or the label alone", () => {
    expect(bracketRow(cols(1, plain("g")))?.trim()).toBe(",");
    expect(bracketRow(cols(1, counted("g", 3)))?.trim()).toBe("3");
  });
});

describe("INV-023: plain and counted share extents", () => {
  const frets = {
    single: (i: number) => (i % 9) + 1,
    double: (i: number) => 10 + (i % 9),
    mixed: (i: number) => (i % 2 ? 12 : 3),
  };
  const densities: Density[] = ["expanded", "compact"];

  for (const [name, fret] of Object.entries(frets)) {
    for (const density of densities) {
      it(`n = 2 to 20, ${name} frets, ${density}`, () => {
        for (let n = 2; n <= 20; n += 1) {
          const make = (group: Partial<EventRow>) =>
            Array.from({ length: n }, (_, i) => ev({ "2": fret(i) }, {}, group));
          const c = bracketRow(make(counted("g", n)), density)!;
          const p = bracketRow(make(plain("g")), density)!;
          expect(p).toBe(c.replace(/\d/g, "-"));
          expect(p.trimEnd().length).toBe(c.trimEnd().length);
        }
      });
    }
  }
});

describe("INV-020/INV-023: the number counts stored columns", () => {
  const build = (position: "first" | "middle" | "last", group: (n: number) => Partial<EventRow>) => {
    const repeat = (at: string) => (position === at ? 8 : 1);
    return [
      ev({ "2": 5 }, {}, { ...group(3), repeat: repeat("first") }),
      ev({ "2": 5 }, {}, { ...group(3), repeat: repeat("middle") }),
      ev({ "2": 5 }, {}, { ...group(3), repeat: repeat("last") }),
    ];
  };

  it("reads ,--------3--------, over ten drawn columns when the repeat is in the middle", () => {
    const events = build("middle", (n) => counted("g", n));
    expect(bracketRow(events, "expanded")?.trim()).toBe(",--------3--------,");
    expect(bracketRow(events, "compact")?.trim()).toBe(",--3--,");
  });

  it.each(["first", "middle", "last"] as const)("repeat at %s keeps plain = counted without digits", (at) => {
    for (const density of ["expanded", "compact"] as Density[]) {
      const c = bracketRow(build(at, (n) => counted("g", n)), density)!;
      const p = bracketRow(build(at, () => plain("g")), density)!;
      expect(c).toContain("3");
      expect(p).toBe(c.replace(/\d/g, "-"));
    }
  });
});

describe("a barline between plain groups", () => {
  it("never merges two groups across it", () => {
    const events = [...cols(2, plain("a")), barline(), ...cols(2, plain("b"))];
    const row = bracketRow(events)!.trim();
    expect(row.startsWith(",-,")).toBe(true);
    expect(row.endsWith(",-,")).toBe(true);
  });
});
