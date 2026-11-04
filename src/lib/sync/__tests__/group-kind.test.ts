import { describe, expect, it } from "vitest";
import { encodeHlc, type Hlc } from "../../hlc";
import { groupNumber, MERGEABLE_FIELDS, type EventRow } from "../../model";
import { layoutPart, tupletSpans } from "../../tab/layout";
import { presetById } from "../../tunings";
import { mergeRow, stampNewRow } from "../merge";
import { eventRowSchema, pushRequestSchema } from "../protocol";

const at = (ms: number, node = "a"): Hlc => encodeHlc({ wallMs: ms, counter: 0, nodeId: node });
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const bass5 = presetById("bass5-b")!;

function wireRow(overrides: Record<string, unknown> = {}) {
  const row = stampNewRow(
    "events",
    {
      id: uuid(1),
      bandId: uuid(2),
      partId: uuid(3),
      rank: "a0",
      kind: "notes",
      frets: { "0": 3 },
      techniques: {},
      repeat: 1,
      durationHint: null,
      tupletId: null,
      tupletCount: null,
      groupKind: null,
      deletedAt: null,
    },
    at(1),
  );
  return { ...row, ...overrides } as Record<string, unknown>;
}

describe("INV-009/010: groupKind on the wire", () => {
  it.each(["beat", "", "Tuplet", 0, true, {}, []])("rejects groupKind %j", (bad) => {
    expect(eventRowSchema.safeParse(wireRow({ groupKind: bad })).success).toBe(false);
  });

  it.each([1, 17, 2.5])("rejects tupletCount %j", (bad) => {
    expect(eventRowSchema.safeParse(wireRow({ tupletCount: bad })).success).toBe(false);
  });

  it.each(["tuplet", "plain", null])("accepts groupKind %j", (kind) => {
    expect(eventRowSchema.safeParse(wireRow({ groupKind: kind })).success).toBe(true);
  });

  it.each([2, 16, null])("accepts tupletCount %j", (count) => {
    expect(eventRowSchema.safeParse(wireRow({ tupletCount: count })).success).toBe(true);
  });

  it("accepts a row with no groupKind key, and a queued raw row", () => {
    const bare = wireRow();
    delete bare.groupKind;
    expect(eventRowSchema.safeParse(bare).success).toBe(true);
    expect(pushRequestSchema.safeParse({ mutations: [{ table: "events", row: bare }] }).success).toBe(
      true,
    );
  });
});

function event(id: string, overrides: Partial<EventRow> = {}): EventRow {
  return {
    ...(wireRow({ id }) as unknown as EventRow),
    ...overrides,
  };
}

describe("INV-010: layoutPart reads stale and legacy rows", () => {
  const spanOf = (events: EventRow[]) => tupletSpans(layoutPart({ events, tuning: bass5 }));

  it("draws a stale (id, 3, plain) row as 3", () => {
    // An older device clocked only tupletId and tupletCount over a plain group.
    const g = { tupletId: "g", tupletCount: 3, groupKind: "plain" as const };
    const spans = spanOf([event("a", g), event("b", g), event("c", g)]);
    expect(spans.map((s) => s.count)).toEqual([3]);
  });

  it("draws a null-count legacy row as a triplet", () => {
    const g = { tupletId: "g", tupletCount: null };
    const spans = spanOf([event("a", g), event("b", g), event("c", g)]);
    expect(spans.map((s) => s.count)).toEqual([3]);
    expect(groupNumber({ tupletCount: null, groupKind: undefined })).toBe(3);
  });

  it("draws a plain group with no number", () => {
    const g = { tupletId: "g", tupletCount: null, groupKind: "plain" as const };
    expect(spanOf([event("a", g), event("b", g)]).map((s) => s.count)).toEqual([null]);
  });

  it("draws a legacy cross-bar group as two spans that print the same number", () => {
    const g = { tupletId: "g", tupletCount: 4 };
    const bar = event("bar", { kind: "barline" });
    const spans = spanOf([event("a", g), event("b", g), bar, event("c", g), event("d", g)]);
    expect(spans.map((s) => s.count)).toEqual([4, 4]);
  });
});

describe("INV-006: merge keeps one write's group fields together", () => {
  const base = (): EventRow =>
    stampNewRow(
      "events",
      { ...event("x"), tupletId: null, tupletCount: null, groupKind: null } as never,
      at(1),
    ) as unknown as EventRow;

  const written = (n: number, node: string, fields: Partial<EventRow>): EventRow => {
    const clock = at(n, node);
    const row = base();
    return {
      ...row,
      ...fields,
      fieldClocks: {
        ...row.fieldClocks,
        tupletId: clock,
        tupletCount: clock,
        groupKind: clock,
      },
    };
  };

  it("lists groupKind as mergeable", () => {
    expect(MERGEABLE_FIELDS.events).toContain("groupKind");
  });

  const cases: [string, Partial<EventRow>, Partial<EventRow>][] = [
    ["tuplet vs plain", { tupletId: "p", tupletCount: 3, groupKind: "tuplet" }, { tupletId: "q", tupletCount: null, groupKind: "plain" }],
    ["group vs ungroup", { tupletId: "p", tupletCount: 3, groupKind: "tuplet" }, { tupletId: null, tupletCount: null, groupKind: null }],
    ["group vs group", { tupletId: "p", tupletCount: 5, groupKind: "tuplet" }, { tupletId: "q", tupletCount: 2, groupKind: "tuplet" }],
  ];

  it.each(cases)("%s resolves to one write, in both orders", (_name, one, two) => {
    const a = written(5, "phone", one);
    const b = written(6, "laptop", two);
    for (const [local, remote] of [[a, b], [b, a]] as const) {
      const merged = mergeRow("events", local, remote);
      expect({
        tupletId: merged.tupletId,
        tupletCount: merged.tupletCount,
        groupKind: merged.groupKind,
      }).toEqual({
        tupletId: two.tupletId,
        tupletCount: two.tupletCount,
        groupKind: two.groupKind,
      });
      const clocks = merged.fieldClocks;
      expect(clocks.tupletId).toBe(clocks.tupletCount);
      expect(clocks.tupletCount).toBe(clocks.groupKind);
    }
  });
});
