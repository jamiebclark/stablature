import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";
import { HlcClock } from "../../hlc";
import { pushRequestSchema } from "../../sync/protocol";
import { layoutPart, tupletSpans } from "../../tab/layout";
import { newId } from "../../ids";
import type { EventRow } from "../../model";
import { presetById } from "../../tunings";
import {
  copyColumns,
  cutColumns,
  pasteClipboard,
  readClipboard,
  writeClipboard,
} from "../clipboard";
import { StablatureDb } from "../db";
import {
  appendBarline,
  appendColumn,
  appendNote,
  createBand,
  createPart,
  createSong,
  createTuningFromPreset,
  createVariant,
  groupRunEndingAt,
  groupSelection,
  insertBarline,
  insertColumn,
  insertNote,
  insertRest,
  tripletFromTail,
  ungroupTuplet,
} from "../editing";
import { patchRow } from "../mutate";
import { listEvents } from "../queries";

const bass5 = presetById("bass5-b")!;

let db: StablatureDb;
let clock: HlcClock;

beforeEach(async () => {
  db = new StablatureDb(`test-${newId()}`);
  await db.open();
  let now = 1_000_000;
  clock = new HlcClock("testnode", () => (now += 1));
});

const ctx = () => ({ db, clock });

async function scaffold() {
  const band = await createBand("Hollow Crown", ctx());
  const tuning = await createTuningFromPreset(band.id, bass5, true, ctx());
  const song = await createSong(band.id, "Dirge", tuning.id, ctx());
  const part = await createPart(song, ctx());
  return { band, song, part };
}

/** Six notes: [0..2] a plain group, [3..5] a counted tuplet of three. */
async function mixed() {
  const s = await scaffold();
  for (const fret of [1, 2, 3, 4, 5, 6]) await appendNote(s.part, 3, fret, ctx());
  let events = await listEvents(s.part.id, db);
  const plainId = newId();
  for (const e of events.slice(0, 3)) {
    await patchRow(
      "events",
      e.id,
      { tupletId: plainId, tupletCount: null, groupKind: "plain" },
      ctx(),
    );
  }
  await tripletFromTail(s.part.id, 3, ctx());
  events = await listEvents(s.part.id, db);
  return { ...s, events };
}

const groupFields = (e: EventRow) => ({
  tupletId: e.tupletId,
  tupletCount: e.tupletCount,
  groupKind: e.groupKind,
});
const NONE = { tupletId: null, tupletCount: null, groupKind: null };

describe("INV-011: every path that copies a column carries groupKind", () => {
  it("copy keeps the kind, count and a fresh id; two pastes do not weld", async () => {
    const { part, events } = await mixed();
    const clip = copyColumns(events);
    await pasteClipboard(part, events, events[5].id, clip, ctx());
    await pasteClipboard(part, events, events[5].id, clip, ctx());

    const all = await listEvents(part.id, db);
    expect(all).toHaveLength(18);
    const pasted = all.filter((e) => !events.some((o) => o.id === e.id));
    expect(pasted.filter((e) => e.groupKind === "plain")).toHaveLength(6);
    expect(pasted.filter((e) => e.groupKind === "tuplet")).toHaveLength(6);
    for (const e of pasted.filter((p) => p.groupKind === "plain")) expect(e.tupletCount).toBeNull();
    const ids = new Set(pasted.map((e) => e.tupletId));
    expect(ids.size).toBe(4);
    for (const original of events) expect(ids.has(original.tupletId)).toBe(false);
  });

  it("a partial copy keeps its kind", async () => {
    const { part, events } = await mixed();
    await pasteClipboard(part, events, events[5].id, copyColumns(events.slice(1, 3)), ctx());
    const pasted = (await listEvents(part.id, db)).filter(
      (e) => !events.some((o) => o.id === e.id),
    );
    expect(pasted.map((e) => e.groupKind)).toEqual(["plain", "plain"]);
  });

  it("cut puts the kind on the clipboard", async () => {
    const { events } = await mixed();
    const clip = await cutColumns(events.slice(0, 3), [], ctx());
    expect(clip.columns.map((c) => c.groupKind)).toEqual(["plain", "plain", "plain"]);
  });

  it("createVariant keeps plain, counted and legacy groups", async () => {
    const { part, events } = await mixed();
    const legacy = newId();
    // A legacy row: counted fields only, no groupKind key at all.
    await db.events.update(events[0].id, { tupletId: legacy, tupletCount: 4, groupKind: undefined });
    await db.events.update(events[1].id, { tupletId: legacy, tupletCount: 4, groupKind: undefined });
    const variant = await createVariant(part, ctx());
    const copied = await listEvents(variant.id, db);
    expect(copied.map((e) => e.groupKind ?? null)).toEqual([
      null,
      null,
      "plain",
      "tuplet",
      "tuplet",
      "tuplet",
    ]);
    expect(copied[0].tupletCount).toBe(4);
  });

  it("a clipboard saved with no groupKind pastes as counted tuplets", async () => {
    const { part } = await scaffold();
    await writeClipboard(
      {
        columns: [0, 1, 2].map((n) => ({
          kind: "notes" as const,
          frets: { "3": n },
          techniques: {},
          repeat: 1,
          durationHint: null,
          tupletGroup: 0,
          tupletCount: 3,
        })),
        annotations: [],
      },
      db,
    );
    const clip = (await readClipboard(db))!;
    await pasteClipboard(part, [], null, clip, ctx());
    const rows = await listEvents(part.id, db);
    expect(rows.map((e) => e.tupletCount)).toEqual([3, 3, 3]);
    expect(rows.map((e) => e.groupKind ?? "tuplet")).toEqual(["tuplet", "tuplet", "tuplet"]);
  });
});

describe("INV-011: ungrouped columns store strict null in all three fields", () => {
  it("insert, append, barline and rest paths", async () => {
    const { part } = await scaffold();
    const a = await appendNote(part, 3, 1, ctx());
    const b = await appendColumn(part, { "2": 2 }, {}, ctx());
    const c = await appendBarline(part, ctx());
    let events = await listEvents(part.id, db);
    const d = await insertColumn(part, events, a.id, { "1": 3 }, {}, ctx());
    events = await listEvents(part.id, db);
    const e = await insertNote(part, events, a.id, 2, 4, ctx());
    events = await listEvents(part.id, db);
    const f = await insertRest(part, events, a.id, ctx());
    events = await listEvents(part.id, db);
    const g = await insertBarline(part, events, a.id, ctx());
    for (const row of [a, b, c, d, e, f, g]) expect(groupFields(row)).toEqual(NONE);
    for (const row of await listEvents(part.id, db)) {
      expect(row.tupletId).toBeNull();
      expect(row.tupletCount).toBeNull();
      expect(row.groupKind).toBeNull();
    }
  });

  it("paste and variant of ungrouped columns", async () => {
    const { part } = await scaffold();
    await appendNote(part, 3, 1, ctx());
    await appendNote(part, 3, 2, ctx());
    const events = await listEvents(part.id, db);
    await pasteClipboard(part, events, null, copyColumns(events), ctx());
    const variant = await createVariant(part, ctx());
    for (const row of [...(await listEvents(part.id, db)), ...(await listEvents(variant.id, db))]) {
      expect(groupFields(row)).toEqual(NONE);
    }
  });
});

/* ---------- groupSelection (US1) ---------- */

async function barShape(shape: string) {
  // "n" a note, "r" a rest, "|" a barline.
  const s = await scaffold();
  for (const ch of shape) {
    if (ch === "n") await appendNote(s.part, 3, 5, ctx());
    else if (ch === "r") await appendColumn(s.part, {}, {}, ctx());
    else await appendBarline(s.part, ctx());
  }
  return { ...s, events: await listEvents(s.part.id, db) };
}

async function outboxParses() {
  const entries = await db.outbox.toArray();
  const mutations = entries.map((e) => ({ table: e.table, row: e.row }));
  for (let i = 0; i < mutations.length; i += 200) {
    const batch = mutations.slice(i, i + 200);
    if (batch.length) expect(pushRequestSchema.safeParse({ mutations: batch }).success).toBe(true);
  }
  return entries;
}

describe("INV-001..004: groupSelection", () => {
  it("every outbox row parses for sizes 2 to 40 across barline shapes and kinds", async () => {
    for (const shape of ["n|n", "|nnn|", "nn|nn", "n||n", "nrn", "|"]) {
      for (const kind of ["tuplet", "plain"] as const) {
        const { part, events } = await barShape(shape.repeat(2));
        await groupSelection(part.id, events[0].id, events.at(-1)!.id, kind, ctx());
        await outboxParses();
      }
    }
    for (const size of [2, 3, 16, 17, 40]) {
      const { part, events } = await barShape("n".repeat(size));
      await groupSelection(part.id, events[0].id, events.at(-1)!.id, "plain", ctx());
      await groupSelection(part.id, events[0].id, events.at(-1)!.id, "tuplet", ctx());
      await outboxParses();
    }
  });

  it("stored count equals the run for counts 2 to 16, rest included", async () => {
    for (let n = 2; n <= 16; n++) {
      const { part, events } = await barShape("n".repeat(n - 1) + "r");
      const ids = await groupSelection(part.id, events[0].id, events.at(-1)!.id, "tuplet", ctx());
      expect(ids).toHaveLength(1);
      const rows = await listEvents(part.id, db);
      expect(rows.every((r) => r.tupletCount === n && r.groupKind === "tuplet")).toBe(true);
      expect(tupletSpans(layoutPart({ events: rows, tuning: bass5 }))[0].count).toBe(n);
    }
  });

  it("a repeat column still counts as one", async () => {
    const { part, events } = await barShape("nnn");
    await db.events.update(events[1].id, { repeat: 8 });
    await groupSelection(part.id, events[0].id, events[2].id, "tuplet", ctx());
    expect((await listEvents(part.id, db)).map((r) => r.tupletCount)).toEqual([3, 3, 3]);
  });

  it("never groups across a barline; a barline stays null", async () => {
    const { part, events } = await barShape("nn|nn");
    const base = await db.outbox.count();
    expect(await groupSelection(part.id, events[0].id, events[4].id, "tuplet", ctx())).toEqual([]);
    expect(await db.outbox.count()).toBe(base);
    const ids = await groupSelection(part.id, events[0].id, events[4].id, "plain", ctx());
    expect(ids).toHaveLength(2);
    const rows = await listEvents(part.id, db);
    expect(groupFields(rows[2])).toEqual(NONE);
    expect(rows[0].tupletId).not.toBe(rows[3].tupletId);
    expect(rows.filter((r) => r.kind !== "barline").every((r) => r.groupKind === "plain")).toBe(
      true,
    );
  });

  it("group over group: a group that loses a column is dissolved whole", async () => {
    const { part, events } = await barShape("nnnnnn");
    await groupSelection(part.id, events[0].id, events[2].id, "tuplet", ctx());
    await groupSelection(part.id, events[2].id, events[4].id, "plain", ctx());
    const rows = await listEvents(part.id, db);
    expect(groupFields(rows[0])).toEqual(NONE);
    expect(groupFields(rows[1])).toEqual(NONE);
    expect(rows.slice(2, 5).every((r) => r.groupKind === "plain")).toBe(true);
    expect(new Set(rows.slice(2, 5).map((r) => r.tupletId)).size).toBe(1);
  });

  it("superset and exact selections replace the old group", async () => {
    const { part, events } = await barShape("nnnn");
    await groupSelection(part.id, events[1].id, events[2].id, "tuplet", ctx());
    await groupSelection(part.id, events[0].id, events[3].id, "tuplet", ctx());
    expect((await listEvents(part.id, db)).map((r) => r.tupletCount)).toEqual([4, 4, 4, 4]);
  });

  it("dissolves a legacy group that spans a barline", async () => {
    const { part, events } = await barShape("nn|nn");
    const legacy = newId();
    for (const i of [0, 1, 3, 4]) {
      await db.events.update(events[i].id, {
        tupletId: legacy,
        tupletCount: 4,
        groupKind: undefined,
      });
    }
    await groupSelection(part.id, events[0].id, events[1].id, "plain", ctx());
    const rows = await listEvents(part.id, db);
    expect(rows[3].tupletId).toBeNull();
    expect(rows[4].tupletId).toBeNull();
    expect(rows[0].groupKind).toBe("plain");
  });
});

describe("INV-005..008: write safety (set A)", () => {
  it("leaves another part's rows and the outbox for it untouched", async () => {
    const { part, events, song } = await barShape("nnn");
    const other = await createPart(song, ctx());
    await appendNote(other, 3, 2, ctx());
    await appendNote(other, 3, 2, ctx());
    const before = await listEvents(other.id, db);
    const outboxBefore = await db.outbox.count();
    await groupSelection(part.id, events[0].id, events[2].id, "tuplet", ctx());
    expect(await listEvents(other.id, db)).toEqual(before);
    expect(await db.outbox.count()).toBe(outboxBefore + 3);
  });

  it("only the three fields change; equal clocks; untouched rows write nothing", async () => {
    const { part, events } = await barShape("nnnn");
    await db.events.update(events[0].id, { repeat: 8, durationHint: "eighth" } as never);
    const before = await listEvents(part.id, db);
    const outboxBefore = await db.outbox.count();
    await groupSelection(part.id, events[0].id, events[2].id, "tuplet", ctx());
    const after = await listEvents(part.id, db);
    const strip = (row: EventRow) => {
      const copy: Record<string, unknown> = { ...row };
      for (const k of ["tupletId", "tupletCount", "groupKind", "fieldClocks", "updatedAt"]) {
        delete copy[k];
      }
      return copy;
    };
    expect(after.map(strip)).toEqual(before.map(strip));
    expect(await db.outbox.count()).toBe(outboxBefore + 3);
    expect(groupFields(after[3])).toEqual(NONE);
    for (const r of after.slice(0, 3)) {
      expect(r.fieldClocks.tupletId).toBe(r.fieldClocks.tupletCount);
      expect(r.fieldClocks.tupletId).toBe(r.fieldClocks.groupKind);
    }
  });

  it("a clock that throws on call N leaves rows and outbox identical", async () => {
    const { part, events } = await barShape("nnnn");
    await groupSelection(part.id, events[0].id, events[1].id, "plain", ctx());
    const rows = await db.events.toArray();
    const outbox = await db.outbox.toArray();
    for (let n = 1; n <= 4; n++) {
      let calls = 0;
      const failing = {
        send: () => {
          if (++calls === n) throw new Error("clock");
          return clock.send();
        },
      } as unknown as HlcClock;
      await expect(
        groupSelection(part.id, events[1].id, events[3].id, "tuplet", { db, clock: failing }),
      ).rejects.toThrow("clock");
      expect(await db.events.toArray()).toEqual(rows);
      expect(await db.outbox.toArray()).toEqual(outbox);
    }
  });
  it("ungroup: a clock that throws on call N leaves rows and outbox identical", async () => {
    const { part, events } = await barShape("nnnn");
    await groupSelection(part.id, events[0].id, events[3].id, "tuplet", ctx());
    const rows = await db.events.toArray();
    const outbox = await db.outbox.toArray();
    for (let n = 1; n <= 4; n++) {
      let calls = 0;
      const failing = {
        send: () => {
          if (++calls === n) throw new Error("clock");
          return clock.send();
        },
      } as unknown as HlcClock;
      await expect(ungroupTuplet([events[1]], { db, clock: failing })).rejects.toThrow("clock");
      expect(await db.events.toArray()).toEqual(rows);
      expect(await db.outbox.toArray()).toEqual(outbox);
    }
  });
});

describe("ungroupTuplet and groupRunEndingAt", () => {
  it("ungroup dissolves whole groups from stored ids, even with one column listed", async () => {
    const { part, events } = await barShape("nnn");
    await groupSelection(part.id, events[0].id, events[2].id, "tuplet", ctx());
    await ungroupTuplet([(await listEvents(part.id, db))[1]], ctx());
    for (const r of await listEvents(part.id, db)) expect(groupFields(r)).toEqual(NONE);
  });

  // INV-004/005/007/008. The first case above already passed on the rewritten
  // write; the cases below pin the rest of the contract.
  it("frees the unselected columns of the group in this part only, and legacy halves", async () => {
    const { part, events } = await barShape("nn|nn");
    await groupSelection(part.id, events[0].id, events[1].id, "tuplet", ctx());
    const variant = await createVariant(part, ctx());
    const before = await db.outbox.count();
    await ungroupTuplet([events[0]], ctx());
    const mine = await listEvents(part.id, db);
    for (const r of mine) expect(groupFields(r)).toEqual(NONE);
    expect((await db.outbox.count()) - before).toBe(2);
    const copied = await listEvents(variant.id, db);
    expect(copied.filter((r) => r.tupletId !== null)).toHaveLength(2);
    // Legacy: two halves sharing an id, counted fields only.
    const legacy = newId();
    for (const e of mine.slice(3)) {
      await db.events.update(e.id, { tupletId: legacy, tupletCount: 2, groupKind: undefined });
    }
    await ungroupTuplet([mine[3]], ctx());
    for (const r of (await listEvents(part.id, db)).slice(3)) expect(groupFields(r)).toEqual(NONE);
  });

  it("a clock that throws on call N leaves rows and outbox identical", async () => {
    const { part, events } = await barShape("nnn");
    await groupSelection(part.id, events[0].id, events[2].id, "tuplet", ctx());
    const rows = await db.events.toArray();
    const outbox = await db.outbox.toArray();
    for (let n = 1; n <= 3; n++) {
      let calls = 0;
      const failing = {
        send: () => {
          if (++calls === n) throw new Error("clock");
          return clock.send();
        },
      } as unknown as HlcClock;
      await expect(ungroupTuplet([events[1]], { db, clock: failing })).rejects.toThrow("clock");
      expect(await db.events.toArray()).toEqual(rows);
      expect(await db.outbox.toArray()).toEqual(outbox);
    }
  });

  it("refused runs write nothing", async () => {
    const { part, events } = await barShape("n|nn");
    const count = await db.outbox.count();
    expect(await groupRunEndingAt(part.id, events[3].id, 3, ctx())).toBeUndefined();
    expect(await db.outbox.count()).toBe(count);
  });
});

describe("US2: plain groups through the toolbar kind", () => {
  it("20 and 40 column plain groups store a null count and parse", async () => {
    for (const size of [20, 40]) {
      const { part, events } = await barShape("n".repeat(size));
      await groupSelection(part.id, events[0].id, events.at(-1)!.id, "plain", ctx());
      const rows = await listEvents(part.id, db);
      expect(rows.every((r) => r.groupKind === "plain" && r.tupletCount === null)).toBe(true);
      expect(new Set(rows.map((r) => r.tupletId)).size).toBe(1);
      await outboxParses();
    }
  });

  it("across a barline makes one group per bar and leaves a single-column bar alone", async () => {
    const { part, events } = await barShape("nn|nnn|n");
    const ids = await groupSelection(part.id, events[0].id, events.at(-1)!.id, "plain", ctx());
    expect(ids).toHaveLength(2);
    const rows = await listEvents(part.id, db);
    expect(groupFields(rows.at(-1)!)).toEqual(NONE);
    expect(groupFields(rows[2])).toEqual(NONE);
    expect(rows[0].tupletId).not.toBe(rows[3].tupletId);
  });

  it("counted to plain and back over the same columns rewrites all three fields", async () => {
    const { part, events } = await barShape("nnn");
    const [first, last] = [events[0].id, events[2].id];
    await groupSelection(part.id, first, last, "tuplet", ctx());
    const counted = await listEvents(part.id, db);
    await groupSelection(part.id, first, last, "plain", ctx());
    const plain = await listEvents(part.id, db);
    expect(plain.every((r) => r.groupKind === "plain" && r.tupletCount === null)).toBe(true);
    expect(plain[0].tupletId).not.toBeNull();
    await groupSelection(part.id, first, last, "tuplet", ctx());
    const back = await listEvents(part.id, db);
    expect(back.every((r) => r.groupKind === "tuplet" && r.tupletCount === 3)).toBe(true);
    expect(counted.every((r) => r.groupKind === "tuplet")).toBe(true);
  });
});

describe("US4 INV-016/INV-001: the triplet button's run", () => {
  const grouped = (rows: readonly EventRow[]) => rows.filter((r) => r.tupletId !== null);

  it("refuses with no write when the run is short or crosses a barline", async () => {
    const cases: [string, number][] = [
      ["nn", 1], // too few columns
      ["nnn|n", 1], // cursor on the first column
      ["nnn", 0], // cursor on the first of three
      ["nnn", 1], // cursor on the second of three
      ["n|nn", 2], // barline among the three, position 1
      ["nn|n", 3], // barline among the three, position 2
    ];
    for (const [shape, at] of cases) {
      const { part } = await barShape(shape);
      const rows = await listEvents(part.id, db);
      const playable = rows.filter((r) => r.kind !== "barline");
      const end = shape === "nn|n" || shape === "n|nn" ? rows[at] : playable[at];
      const before = await db.outbox.count();
      expect(await groupRunEndingAt(part.id, end.id, 3, ctx())).toBeUndefined();
      expect(await db.outbox.count()).toBe(before);
    }
  });

  it("groups three at the end, mid-part, over a rest or a repeat, and past a later barline", async () => {
    for (const shape of ["nnn", "nnnnn", "nrn", "nnrn"]) {
      const { part, events } = await barShape(shape);
      const id = await groupRunEndingAt(part.id, events.at(-1)!.id, 3, ctx());
      expect(id).toBeDefined();
      expect(grouped(await listEvents(part.id, db))).toHaveLength(3);
    }
    const mid = await barShape("nnnnn");
    expect(await groupRunEndingAt(mid.part.id, mid.events[2].id, 3, ctx())).toBeDefined();
    expect(grouped(await listEvents(mid.part.id, db)).map((r) => r.id)).toEqual(
      mid.events.slice(0, 3).map((r) => r.id),
    );
    const after = await barShape("nnn|nn");
    expect(await groupRunEndingAt(after.part.id, after.events[2].id, 3, ctx())).toBeDefined();
  });

  it("a repeat column counts as a column", async () => {
    const { part, events } = await barShape("nnn");
    await patchRow("events", events[1].id, { repeat: 2 }, ctx());
    expect(await groupRunEndingAt(part.id, events[2].id, 3, ctx())).toBeDefined();
  });

  it("tripletFromTail skips a trailing barline but never groups across one", async () => {
    const trailing = await barShape("nnn|");
    expect(await tripletFromTail(trailing.part.id, 3, ctx())).toBeDefined();
    expect(grouped(await listEvents(trailing.part.id, db))).toHaveLength(3);
    const across = await barShape("nn|n");
    const before = await db.outbox.count();
    expect(await tripletFromTail(across.part.id, 3, ctx())).toBeUndefined();
    expect(await db.outbox.count()).toBe(before);
  });

  it("tripletFromTail counts 1, 2, 3, 16, 17", async () => {
    for (const [count, ok] of [
      [1, false],
      [2, true],
      [3, true],
      [16, true],
      [17, false],
    ] as const) {
      const { part } = await barShape("n".repeat(17));
      const id = await tripletFromTail(part.id, count, ctx());
      expect(id !== undefined).toBe(ok);
    }
  });

  it("grouping a b c then d leaves b c d a triplet and a alone", async () => {
    const { part, events } = await barShape("nnnn");
    await groupRunEndingAt(part.id, events[2].id, 3, ctx());
    await groupRunEndingAt(part.id, events[3].id, 3, ctx());
    const rows = await listEvents(part.id, db);
    expect(groupFields(rows[0])).toEqual(NONE);
    const [b, c, d] = rows.slice(1);
    expect(b.tupletId).not.toBeNull();
    expect(new Set([b.tupletId, c.tupletId, d.tupletId]).size).toBe(1);
    expect(d.tupletCount).toBe(3);
  });
});
