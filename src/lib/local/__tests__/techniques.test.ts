import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";
import { HlcClock } from "../../hlc";
import { newId } from "../../ids";
import type { EventRow, Technique } from "../../model";
import { eventRowSchema } from "../../sync/protocol";
import { DECORATIONS, MAX_TECHNIQUES_PER_STRING } from "../../tab/techniques";
import { presetById } from "../../tunings";
import { StablatureDb } from "../db";
import {
  createBand,
  createPart,
  createSong,
  createTuningFromPreset,
  insertNote,
  stackNote,
  toggleDecoration,
  unstackNote,
} from "../editing";
import { listEvents } from "../queries";

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
  const tuning = await createTuningFromPreset(band.id, presetById("bass5-b")!, true, ctx());
  const song = await createSong(band.id, "Dirge", tuning.id, ctx());
  const part = await createPart(song, ctx());
  return { part };
}

const stored = async (id: string): Promise<EventRow> => {
  const row = await db.events.get(id);
  return row as EventRow;
};
const outboxCount = () => db.outbox.count();
const ids = DECORATIONS.map((d) => d.id);

describe("insertNote and stackNote with techniques", () => {
  it("nothing armed: stores {} and the same clocks as before", async () => {
    const { part } = await scaffold();
    const before = await outboxCount();
    const a = await insertNote(part, [], null, 3, 7, ctx());
    expect(a.techniques).toEqual({});
    expect(await outboxCount()).toBe(before + 1);
    const withEmpty = await insertNote(part, [a], a.id, 3, 5, { ...ctx(), techniques: [] });
    expect(withEmpty.techniques).toEqual({});
    expect(Object.keys(withEmpty.fieldClocks).sort()).toEqual(Object.keys(a.fieldClocks).sort());
  });

  it("stores exactly { string: [technique] } and passes the wire schema", async () => {
    const { part } = await scaffold();
    const a = await insertNote(part, [], null, 3, 7, { ...ctx(), techniques: ["hammer_on"] });
    expect(a.techniques).toEqual({ "3": ["hammer_on"] });
    expect(eventRowSchema.safeParse(await stored(a.id)).success).toBe(true);
  });

  it("a plain stack on a clean string writes the same clocks as today", async () => {
    const { part } = await scaffold();
    const a = await insertNote(part, [], null, 3, 7, ctx());
    const b = await stackNote(a, 2, 5, ctx());
    expect(Object.keys(b.fieldClocks)).not.toContain("techniques-patched");
    expect(b.fieldClocks.techniques).toBe(a.fieldClocks.techniques);
    expect(b.techniques).toEqual({});
  });

  it("stack replaces the string's list and keeps other strings", async () => {
    const { part } = await scaffold();
    const a = await insertNote(part, [], null, 3, 7, { ...ctx(), techniques: ["vibrato"] });
    const b = await stackNote(a, 2, 5, { ...ctx(), techniques: ["slide_up"] });
    expect(b.techniques).toEqual({ "3": ["vibrato"], "2": ["slide_up"] });
    const c = await stackNote(b, 3, 9, { ...ctx(), techniques: ["hammer_on"] });
    expect(c.techniques).toEqual({ "3": ["hammer_on"], "2": ["slide_up"] });
    const d = await stackNote(c, 3, 9, ctx()); // same fret, no chip: the string's list clears
    expect(d.techniques).toEqual({ "2": ["slide_up"] });
  });

  it("drops dead_note/unknown entries on a replaced note", async () => {
    const { part } = await scaffold();
    const a = await insertNote(part, [], null, 3, 7, ctx());
    await db.events.update(a.id, { techniques: { "3": ["dead_note", "wobble"] as unknown as Technique[] } });
    const b = await stackNote((await stored(a.id)) as EventRow, 3, 8, ctx());
    expect(b.techniques).toEqual({});
  });

  it("turns a rest into notes when stacked onto", async () => {
    const { part } = await scaffold();
    const a = await insertNote(part, [], null, 3, 7, ctx());
    await db.events.update(a.id, { kind: "rest", frets: {} });
    const b = await stackNote((await stored(a.id)) as EventRow, 3, 4, { ...ctx(), techniques: ["pull_off"] });
    expect(b.kind).toBe("notes");
    expect(b.techniques).toEqual({ "3": ["pull_off"] });
  });
});

describe("unstackNote", () => {
  it("removes the string's techniques with the note", async () => {
    const { part } = await scaffold();
    const a = await insertNote(part, [], null, 3, 7, { ...ctx(), techniques: ["hammer_on"] });
    const b = await stackNote(a, 2, 5, { ...ctx(), techniques: ["vibrato"] });
    await unstackNote(b, 3, ctx());
    const after = await stored(a.id);
    expect(after.frets).toEqual({ "2": 5 });
    expect(after.techniques).toEqual({ "2": ["vibrato"] });
  });

  it("deletes the column when it empties", async () => {
    const { part } = await scaffold();
    const a = await insertNote(part, [], null, 3, 7, { ...ctx(), techniques: ["hammer_on"] });
    await unstackNote(a, 3, ctx());
    expect(await listEvents(part.id, db)).toHaveLength(0);
  });
});

describe("toggleDecoration", () => {
  async function column(techniques: Technique[] = []) {
    const { part } = await scaffold();
    const a = await insertNote(part, [], null, 3, 7, { ...ctx(), techniques });
    return a;
  }

  it("turns each decoration on and off, writing only techniques", async () => {
    for (const d of ids) {
      const a = await column();
      await toggleDecoration(a.id, 3, d, ctx());
      const on = await stored(a.id);
      expect(on.techniques).toEqual({ "3": [d] });
      expect(on.fieldClocks.frets).toBe(a.fieldClocks.frets);
      await toggleDecoration(a.id, 3, d, ctx());
      expect((await stored(a.id)).techniques).toEqual({});
    }
  });

  it("keeps a transition, dead_note, unknown entries and other strings", async () => {
    const a = await column(["hammer_on"]);
    await db.events.update(a.id, {
      frets: { "3": 7, "2": 5 },
      techniques: { "3": ["hammer_on", "dead_note", "wobble"] as unknown as Technique[], "2": ["bend"] },
    });
    await toggleDecoration(a.id, 3, "vibrato", ctx());
    expect((await stored(a.id)).techniques).toEqual({
      "3": ["hammer_on", "dead_note", "wobble", "vibrato"],
      "2": ["bend"],
    });
    await toggleDecoration(a.id, 3, "vibrato", ctx());
    expect((await stored(a.id)).techniques["3"]).toEqual(["hammer_on", "dead_note", "wobble"]);
  });

  it("removes every copy of a duplicated entry", async () => {
    const a = await column();
    await db.events.update(a.id, { techniques: { "3": ["bend", "vibrato", "bend"] } });
    await toggleDecoration(a.id, 3, "bend", ctx());
    expect((await stored(a.id)).techniques).toEqual({ "3": ["vibrato"] });
  });

  it("serialises 15 pairs of concurrent toggles", async () => {
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const a = await column();
        await Promise.all([
          toggleDecoration(a.id, 3, ids[i], ctx()),
          toggleDecoration(a.id, 3, ids[j], ctx()),
        ]);
        expect(new Set((await stored(a.id)).techniques["3"])).toEqual(new Set([ids[i], ids[j]]));
      }
    }
  });

  it("lands two taps on one toggle as on then off, and all six in one burst", async () => {
    const a = await column();
    await Promise.all([
      toggleDecoration(a.id, 3, "bend", ctx()),
      toggleDecoration(a.id, 3, "bend", ctx()),
    ]);
    expect((await stored(a.id)).techniques).toEqual({});
    await Promise.all(ids.map((d) => toggleDecoration(a.id, 3, d, ctx())));
    expect(new Set((await stored(a.id)).techniques["3"])).toEqual(new Set(ids));
  });

  it("pins the cap against the wire schema and honours it", async () => {
    const a = await column();
    const row = await stored(a.id);
    const ok = (n: number) =>
      eventRowSchema.safeParse({
        ...row,
        techniques: { "3": Array.from({ length: n }, () => "bend") },
      }).success;
    expect(MAX_TECHNIQUES_PER_STRING).toBe(8);
    expect(ok(8)).toBe(true);
    expect(ok(9)).toBe(false);

    for (const length of [6, 7, 8]) {
      const list = [
        "hammer_on", "dead_note", "wobble", "a", "b", "c", "d", "e",
      ].slice(0, length) as Technique[];
      await db.events.update(a.id, { techniques: { "3": list } });
      await toggleDecoration(a.id, 3, "vibrato", ctx());
      const after = (await stored(a.id)).techniques["3"];
      expect(after.length).toBe(Math.min(length + 1, 8));
      expect(eventRowSchema.safeParse(await stored(a.id)).success).toBe(true);
    }
    // at the cap, turning one OFF still works
    await db.events.update(a.id, {
      techniques: { "3": ["vibrato", "a", "b", "c", "d", "e", "f", "g"] as Technique[] },
    });
    await toggleDecoration(a.id, 3, "vibrato", ctx());
    expect((await stored(a.id)).techniques["3"]).toHaveLength(7);
  });

  it("writes nothing when nothing changes", async () => {
    const a = await column();
    const before = await outboxCount();
    await toggleDecoration(a.id, 0, "bend", ctx()); // string has no note
    await toggleDecoration("missing", 3, "bend", ctx());
    await db.events.update(a.id, { deletedAt: "tombstone" });
    await toggleDecoration(a.id, 3, "bend", ctx());
    expect(await outboxCount()).toBe(before);
  });
});
