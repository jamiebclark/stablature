import "fake-indexeddb/auto";

/**
 * INV-016: a group stores its three fields, never crosses a barline, never shares an id, and
 *          always matches its bracket.
 * INV-017: a technique is stored only if the staff draws it, and drawn only if stored.
 */
import { describe, expect, it } from "vitest";
import { draftPart } from "@/lib/local/clipboard";
import type { Technique } from "@/lib/model";
import { toAscii } from "@/lib/tab/ascii";
import { layoutPart } from "@/lib/tab/layout";
import { DECORATIONS, TRANSITIONS } from "@/lib/tab/techniques";
import { presetById } from "@/lib/tunings";
import { clip, codes, four, staff } from "./unit-helpers";

const tuning = presetById("bass4-e")!;
const rows = (text: string) => draftPart(clip(text).clipboard).events;
const fields = (text: string) =>
  rows(text).map((e) => [e.kind, e.tupletCount, e.groupKind ?? null]);
const redraw = (text: string) => {
  const r = clip(text);
  return toAscii({ ...draftPart(r.clipboard), tuning, density: r.density });
};

describe("INV-016 every row of spec 003's notation tables comes back", () => {
  const cases: [string, string, string, (number | null)[], string][] = [
    ["counted of 2", ",2,", "-5-7-", [2, 2], "tuplet"],
    ["counted of 3", ",-3-,", "-5-7-9-", [3, 3, 3], "tuplet"],
    ["counted of 4", ",--4--,", "-5-7-9-3-", [4, 4, 4, 4], "tuplet"],
    ["plain of 2", ",-,", "-5-7-", [null, null], "plain"],
    ["plain of 3", ",---,", "-5-7-9-", [null, null, null], "plain"],
    ["plain of 4", ",-----,", "-5-7-9-3-", [null, null, null, null], "plain"],
  ];

  it.each(cases)("%s", (_name, bracket, body, counts, kind) => {
    const text = `    ${bracket}\n${four(body)}`;
    const events = rows(text);
    expect(events.map((e) => e.tupletCount)).toEqual(counts);
    expect(new Set(events.map((e) => e.groupKind))).toEqual(new Set([kind]));
    expect(new Set(events.map((e) => e.tupletId)).size).toBe(1);
    expect(events[0].tupletId).not.toBeNull();
    expect(redraw(text)).toBe(text);
  });

  it("short spans: 3 and , over one column, 3, and ,, over a two-digit column", () => {
    expect(fields(`    3\n${four("-5-7-")}`)[0]).toEqual(["notes", 3, "tuplet"]);
    expect(fields(`    ,\n${four("-5-7-")}`)[0]).toEqual(["notes", null, "plain"]);
    expect(fields(`    3,\n${four("-12-7-")}`)[0]).toEqual(["notes", 3, "tuplet"]);
    expect(fields(`    ,,\n${four("-12-7-")}`)[0]).toEqual(["notes", null, "plain"]);
  });

  it("16 overrunning a one-column group", () => {
    expect(fields(`    16\n${four("-5-7-")}`)[0]).toEqual(["notes", 16, "tuplet"]);
  });

  it(",-, ,-, is two groups with two ids", () => {
    const events = rows(`    ,-, ,-,\n${four("-5-7-9-3-")}`);
    expect(new Set(events.map((e) => e.tupletId)).size).toBe(2);
  });

  it("a counted beside a plain", () => {
    const events = rows(`    ,2, ,-,\n${four("-5-7-9-3-")}`);
    expect(events.map((e) => e.groupKind)).toEqual(["tuplet", "tuplet", "plain", "plain"]);
    expect(new Set(events.map((e) => e.tupletId)).size).toBe(2);
  });

  it("a group per system, each with its own id", () => {
    const one = `    ,-3-,\n${four("-5-7-9-")}`;
    const events = rows(`${one}\n\n${one}`).filter((e) => e.kind === "notes");
    expect(new Set(events.map((e) => e.tupletId)).size).toBe(2);
  });

  it("a rest inside a span", () => {
    const text = `    ,--3--,\n${four("-5---7-9-")}`;
    const events = rows(text);
    expect(events.map((e) => e.kind)).toEqual(["notes", "rest", "notes", "notes"]);
    expect(new Set(events.map((e) => e.tupletId)).size).toBe(1);
  });

  it("a barline never holds a group", () => {
    for (const e of rows(`    ,-,\n${staff("GDAE", ["-5-7-|-9-", "-----|---", "-----|---", "-----|---"])}`)) {
      if (e.kind === "barline") expect([e.tupletId, e.tupletCount, e.groupKind]).toEqual([null, null, null]);
    }
  });
});

describe("INV-016 refusals", () => {
  it("a bracket across a barline", () => {
    const body = staff("GDAE", ["-5-|-7-", "---|---", "---|---", "---|---"]);
    expect(codes(`    ,--3--,\n${body}`)).toContain("bracket-placement");
  });

  it("ending between columns", () => {
    expect(codes(`    ,--,\n${four("-5-7-9-")}`)).toContain("bracket-placement");
  });

  it.each([",-1-,", ",-17-,", ",1,", ",17,"])("number out of range in %s", (b) => {
    expect(codes(`    ${b}\n${four("-5-7-9-")}`).length).toBeGreaterThan(0);
  });
});

describe("INV-017 the staff draws what is stored, and only that", () => {
  /** Every stored transition has its connector, and every connector its stored transition. */
  function expectAgreement(text: string) {
    const r = clip(text);
    const { events } = draftPart(r.clipboard);
    const layout = layoutPart({ events, tuning, density: r.density });
    const byEvent = new Map(events.map((e) => [e.id, e]));
    for (const column of layout.columns) {
      const source = byEvent.get(column.eventId)!;
      column.connectors.forEach((glyph, i) => {
        const stored = (source.techniques[String(i)] ?? []).filter((t) =>
          TRANSITIONS.some((x) => x.id === t),
        );
        if (glyph) expect(stored.length, text).toBe(1);
        else if (column.repetition === 0) expect(stored, text).toEqual([]);
      });
    }
  }

  for (const t of TRANSITIONS) {
    const g = t.glyph;
    it(`${t.id}: adjacent, widened, across a space, a barline, a join, separated by rails`, () => {
      const shapes = [
        four(`-5${g}7-`),
        staff("GDAE", [`-5-${g}7-`, "-12---", "------", "------"]),
        four(`-5--${g}7-`),
        staff("GDAE", [`-5-|${g}7-`, "---|---", "---|---", "---|---"]),
        `${four("-5-")}\n\n${four(`${g}7-`).replace("-|", "-|")}`,
        `G|-5${g}---7-|\nD|--------|\nA|--------|\nE|--------|`,
      ];
      for (const text of shapes) {
        expect(codes(text), text).toEqual([]);
        expectAgreement(text);
        const stored = rows(text).flatMap((e) => e.techniques["0"] ?? []);
        expect(stored, text).toEqual([t.id]);
      }
    });

    it(`${t.id}: with no source, no arrival, and two in one gap, refuses`, () => {
      expect(codes(four(`-${g}7-`))).toContain("connector-unjoined");
      expect(codes(four(`-7${g}-`))).toContain("connector-unjoined");
      const other = TRANSITIONS.find((x) => x.id !== t.id)!.glyph;
      expect(codes(four(`-5${g}${other}7-`))).toContain("connector-double");
    });

    it(`${t.id}: onto and from a dead note`, () => {
      for (const body of [`-5${g}x-`, `-x${g}5-`, `-x${g}x-`]) expectAgreement(four(body));
    });
  }

  const subsets: Technique[][] = Array.from({ length: 1 << DECORATIONS.length }, (_, mask) =>
    DECORATIONS.filter((_, i) => (mask >> i) & 1).map((d) => d.id),
  );

  it.each(["7", "12", "x"])("all 63 subsets on %s, drawn then read, are stored whole", (fret) => {
    const value = fret === "x" ? ("x" as const) : Number(fret);
    for (const ids of subsets.slice(1)) {
      const events = [
        {
          id: "e",
          bandId: "b",
          partId: "p",
          rank: "a",
          kind: "notes",
          frets: { "0": value },
          techniques: { "0": ids },
          repeat: 1,
          durationHint: null,
          tupletId: null,
          tupletCount: null,
          updatedAt: "x",
          deletedAt: null,
          fieldClocks: {},
          serverSeq: 0,
        },
      ];
      const text = toAscii({ events: events as never, tuning });
      const back = rows(text)[0];
      expect(new Set(back.techniques["0"] ?? []), text).toEqual(new Set(ids));
      expect(back.frets).toEqual({ 0: value });
      expect(redraw(text)).toBe(text);
    }
  });

  it.each([
    ["7~b"],
    ["7mb"],
    ["7m~"],
    ["(t7)"],
    ["<(7)>"],
  ])("wrong order %s refuses", (cell) => {
    expect(codes(four(`-${cell}-`))).toContain("decoration-order");
  });

  it("H, P and X are read, and x stores no dead_note", () => {
    const events = rows(four("-5H7P5-X-"));
    expect(events.map((e) => e.techniques["0"] ?? [])).toEqual([[], ["hammer_on"], ["pull_off"], []]);
    expect(events[3].frets).toEqual({ 0: "x" });
  });

  it.each(["s", "r", "^"])("%s refuses as a character the notation lacks", (ch) => {
    expect(codes(four(`-5${ch}7-`))).toContain("bad-character");
  });

  it.each(["5ht7", "t12p5", "7~h9b"])("%s reads and redraws", (body) => {
    const text = four(`-${body}-`);
    expect(codes(text)).toEqual([]);
    expect(redraw(text)).toBe(text);
    expectAgreement(text);
  });

  it("the whole grammar on one row", () => {
    const text = four("-5h7-7p5-5/7-7\\5-");
    expect(redraw(text)).toBe(text);
  });
});
