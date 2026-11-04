/**
 * INV-009 / FR-006 / FR-007: rows and clipboards from before this entry, through the real
 * pushRequestSchema, mergeRow, layoutPart, pasteClipboard and readClipboard.
 * INV-010 / FR-004: the wire's accepted and refused values.
 */
import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";
import { pasteClipboard, readClipboard, writeClipboard } from "@/lib/local/clipboard";
import { groupSelection, ungroupTuplet } from "@/lib/local/editing";
import { newId } from "@/lib/ids";
import type { EventRow } from "@/lib/model";
import { mergeRow } from "@/lib/sync/merge";
import { eventRowSchema, pushRequestSchema } from "@/lib/sync/protocol";
import { toAscii } from "@/lib/tab/ascii";
import { layoutPart, tupletSpans } from "@/lib/tab/layout";
import { bass5, build, makeLegacy, NONE, rows, triple, world } from "./unit-helpers";

const spans = (events: EventRow[]) => tupletSpans(layoutPart({ events, tuning: bass5 }));

describe("INV-009", () => {
  it("a local row with no key pushes, and a queued outbox row with no key pushes", async () => {
    const w = await world();
    const [a] = await build(w, "n");
    const legacy = await makeLegacy(w, a.id, null, null);
    expect("groupKind" in legacy).toBe(false);
    expect(eventRowSchema.safeParse(legacy).success).toBe(true);
    await w.db.outbox.add({
      table: "events",
      rowId: a.id,
      row: legacy,
      hlc: legacy.updatedAt,
      attempts: 0,
    });
    const entries = await w.db.outbox.orderBy("seq").toArray();
    const mutations = entries.map((e) => ({ table: e.table, row: e.row }));
    // The queued row does not block the batch it rides in.
    expect(pushRequestSchema.parse({ mutations }).mutations).toHaveLength(entries.length);
  });

  it("merge: no key on either side, no clock on either side, a pulled null", async () => {
    const w = await world();
    const [a] = await build(w, "n");
    const legacy = await makeLegacy(w, a.id, null, null);
    const pulled = { ...legacy, groupKind: null } as EventRow;
    for (const [local, remote] of [
      [legacy, legacy],
      [legacy, pulled],
      [pulled, legacy],
    ] as const) {
      const merged = mergeRow("events", local, remote);
      expect(merged.groupKind ?? null).toBeNull();
      expect(merged.fieldClocks.groupKind).toBeUndefined();
    }
    expect(mergeRow("events", undefined, legacy).groupKind ?? null).toBeNull();
  });

  it("a remote write with a clock beats a legacy row that has none", async () => {
    const w = await world();
    const [a] = await build(w, "n");
    const legacy = await makeLegacy(w, a.id, null, null);
    const later = "999999999999999:0000:zz";
    const remote = {
      ...legacy,
      tupletId: "g",
      groupKind: "plain",
      fieldClocks: { ...legacy.fieldClocks, groupKind: later, tupletId: later, tupletCount: later },
    } as EventRow;
    const want = { tupletId: "g", tupletCount: null, groupKind: "plain" };
    expect(triple(mergeRow("events", legacy, remote))).toEqual(want);
    expect(triple(mergeRow("events", remote, legacy))).toEqual(want);
  });

  it("reads: null count prints 3, a stale (id, 3, plain) prints 3, no key prints its count", async () => {
    const w = await world();
    const all = await build(w, "nnn");
    const g = (over: Partial<EventRow>) =>
      all.map((r) => ({ ...r, tupletId: "g", ...over }) as EventRow);
    expect(spans(g({ tupletCount: null, groupKind: undefined })).map((s) => s.count)).toEqual([3]);
    expect(spans(g({ tupletCount: null, groupKind: null })).map((s) => s.count)).toEqual([3]);
    expect(spans(g({ tupletCount: 5, groupKind: undefined })).map((s) => s.count)).toEqual([5]);
    expect(spans(g({ tupletCount: 3, groupKind: "plain" })).map((s) => s.count)).toEqual([3]);
    expect(spans(g({ tupletCount: null, groupKind: "plain" })).map((s) => s.count)).toEqual([null]);
  });

  it("a clipboard with no key pastes, grouped and ungrouped", async () => {
    const w = await world();
    const column = (tupletGroup: number | null, tupletCount: number | null) => ({
      kind: "notes" as const,
      frets: { "3": 5 },
      techniques: {},
      repeat: 1,
      durationHint: null,
      tupletGroup,
      tupletCount,
    });
    await writeClipboard(
      { columns: [column(0, 3), column(0, 3), column(0, 3), column(null, null)], annotations: [] },
      w.db,
    );
    await pasteClipboard(w.part, [], null, (await readClipboard(w.db))!, w.ctx);
    const pasted = await rows(w);
    expect(pasted.slice(0, 3).every((r) => r.tupletCount === 3 && r.groupKind === null)).toBe(true);
    expect(triple(pasted[3])).toEqual(NONE);
    expect(spans(pasted).map((s) => s.count)).toEqual([3]);
  });

  it("a legacy cross-bar group draws as it did, and both halves ungroup", async () => {
    const w = await world();
    const all = await build(w, "nn|nn");
    const id = newId();
    for (const i of [0, 1, 3, 4]) await makeLegacy(w, all[i].id, id, 4);
    const legacy = await rows(w);
    expect(toAscii({ events: legacy, tuning: bass5 }).split("\n")[0].trim()).toBe(",4,   ,4,");
    await ungroupTuplet([legacy[0]], w.ctx);
    for (const r of (await rows(w)).filter((x) => x.kind !== "barline")) {
      expect(triple(r)).toEqual(NONE);
    }
  });

  it("regrouping a legacy row writes all three fields with one clock", async () => {
    const w = await world();
    const all = await build(w, "nnn");
    const id = newId();
    for (const r of all) await makeLegacy(w, r.id, id, 3);
    await groupSelection(w.part.id, all[0].id, all[2].id, "plain", w.ctx);
    for (const r of await rows(w)) {
      expect(r.fieldClocks.groupKind).toBe(r.fieldClocks.tupletId);
      expect(r.tupletCount).toBeNull();
    }
  });
});

describe("INV-010", () => {
  const good = async () => {
    const w = await world();
    const [a] = await build(w, "n");
    return a;
  };
  it("refuses every value outside FR-001, and counts outside 2 to 16", async () => {
    const row = await good();
    for (const groupKind of ["beat", "", "Tuplet", 0, true, {}, []]) {
      expect(eventRowSchema.safeParse({ ...row, groupKind }).success).toBe(false);
    }
    for (const tupletCount of [1, 17, 2.5]) {
      expect(eventRowSchema.safeParse({ ...row, tupletCount }).success).toBe(false);
    }
  });
  it("accepts tuplet, plain, null, absent, 2 and 16", async () => {
    const row = await good();
    for (const groupKind of ["tuplet", "plain", null]) {
      expect(eventRowSchema.safeParse({ ...row, groupKind }).success).toBe(true);
    }
    const absent: Partial<EventRow> = { ...row };
    delete absent.groupKind;
    expect(eventRowSchema.safeParse(absent).success).toBe(true);
    for (const tupletCount of [2, 16]) {
      expect(eventRowSchema.safeParse({ ...row, tupletCount }).success).toBe(true);
    }
  });
});
