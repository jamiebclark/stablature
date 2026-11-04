import { describe, expect, it } from "vitest";
import type { EventRow } from "../../model";
import { groupOffer, runEndingAt, TRIPLET_REFUSAL } from "../grouping";

function row(id: string, kind: "note" | "rest" | "barline", tupletId: string | null = null): EventRow {
  return {
    id,
    bandId: "b",
    partId: "p",
    rank: id,
    kind,
    frets: {},
    techniques: {},
    repeat: 1,
    durationHint: null,
    tupletId,
    tupletCount: null,
    groupKind: null,
    updatedAt: "",
    deletedAt: null,
    fieldClocks: {},
  } as unknown as EventRow;
}

const notes = (n: number, tupletId: string | null = null) =>
  Array.from({ length: n }, (_, i) => row(`n${i}`, "note", tupletId));
const bar = (id = "bar") => row(id, "barline");

describe("groupOffer truth table (INV-012)", () => {
  for (const grouped of [false, true]) {
    const g = grouped ? "g" : null;
    const t = (rows: EventRow[]) => groupOffer(rows);
    const label = grouped ? "grouped" : "ungrouped";

    it(`one column, ${label}`, () => {
      const o = t(notes(1, g));
      expect([o.tuplet, o.plain.length, o.ungroup]).toEqual([null, 0, grouped]);
    });
    it(`a barline alone, ${label}`, () => {
      const o = t([bar()]);
      expect([o.tuplet, o.plain, o.ungroup]).toEqual([null, [], false]);
    });
    it(`two columns, ${label}`, () => {
      const o = t(notes(2, g));
      expect([o.tuplet?.length, o.plain.length, o.ungroup]).toEqual([2, 1, grouped]);
    });
    it(`barlines at the edges are ignored, ${label}`, () => {
      const o = t([bar("a"), ...notes(3, g), bar("b")]);
      expect([o.tuplet?.length, o.plain.length]).toEqual([3, 1]);
    });
    it(`across one barline: no tuplet, two single columns, ${label}`, () => {
      const [a, b] = notes(2, g);
      const o = t([a, bar(), b]);
      expect([o.tuplet, o.plain.length, o.ungroup]).toEqual([null, 0, grouped]);
    });
    it(`two and one across a barline, ${label}`, () => {
      const [a, b, c] = notes(3, g);
      const o = t([a, b, bar(), c]);
      expect([o.tuplet, o.plain.length]).toEqual([null, 1]);
    });
    it(`two and two across a barline, ${label}`, () => {
      const [a, b, c, d] = notes(4, g);
      const o = t([a, b, bar(), c, d]);
      expect([o.tuplet, o.plain.length, o.ungroup]).toEqual([null, 2, grouped]);
    });
  }

  it("tuplet size limits", () => {
    expect(groupOffer(notes(16)).tuplet).toHaveLength(16);
    expect(groupOffer(notes(17)).tuplet).toBeNull();
    expect(groupOffer(notes(17)).plain).toHaveLength(1);
    expect(groupOffer(notes(18)).tuplet).toBeNull();
    expect(groupOffer(notes(40)).plain[0]).toHaveLength(40);
  });

  it("the numeral follows live extension 2 to 17", () => {
    for (let n = 2; n <= 17; n++) {
      expect(groupOffer(notes(n)).tuplet?.length ?? null).toBe(n <= 16 ? n : null);
    }
  });

  it("a rest counts, and ungroup shows for any grouped column", () => {
    const rows = [row("a", "rest"), row("b", "note", "x"), row("c", "note")];
    const o = groupOffer(rows);
    expect([o.tuplet?.length, o.ungroup]).toEqual([3, true]);
  });
});

describe("runEndingAt", () => {
  const rows = [...notes(4), bar("b1"), ...notes(2).map((r) => ({ ...r, id: `m${r.id}` }))];
  it("takes the tail when endId is null", () => {
    expect(runEndingAt(rows, null, 2)?.map((r) => r.id)).toEqual(["mn0", "mn1"]);
  });
  it("refuses across a barline, too few, and out-of-range counts", () => {
    expect(runEndingAt(rows, null, 3)).toBeNull();
    expect(runEndingAt(rows, "n1", 3)).toBeNull();
    expect(runEndingAt(rows, "n3", 1)).toBeNull();
    expect(runEndingAt(rows, "n3", 17)).toBeNull();
    expect(runEndingAt(rows, "nope", 2)).toBeNull();
  });
  it("takes a mid-part run", () => {
    expect(runEndingAt(rows, "n2", 3)?.map((r) => r.id)).toEqual(["n0", "n1", "n2"]);
  });
  it("has a refusal text without a count", () => {
    expect(TRIPLET_REFUSAL).toBe("a triplet needs three columns in one bar");
  });
});
