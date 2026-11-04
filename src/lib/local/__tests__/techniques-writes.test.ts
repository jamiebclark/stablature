/**
 * INV-002, INV-006 (stored form), INV-013, INV-014, INV-015, INV-016 through the public write
 * operations over fake-indexeddb, every member the plan names.
 */
import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";
import { HlcClock } from "@/lib/hlc";
import { newId } from "@/lib/ids";
import type { EventRow, Technique } from "@/lib/model";
import { StablatureDb } from "@/lib/local/db";
import {
  createBand,
  createPart,
  createSong,
  createTuningFromPreset,
  insertBarline,
  insertNote,
  insertRest,
  stackNote,
  toggleDecoration,
  unstackNote,
} from "@/lib/local/editing";
import { listEvents } from "@/lib/local/queries";
import { eventRowSchema } from "@/lib/sync/protocol";
import { presetById } from "@/lib/tunings";

const DECORATIONS = ["vibrato", "harmonic", "let_ring", "bend", "tap", "palm_mute"] as const;
const TRANSITIONS = ["hammer_on", "pull_off", "slide_up", "slide_down"] as const;

let db: StablatureDb;
let clock: HlcClock;

beforeEach(async () => {
  db = new StablatureDb(`probe-${newId()}`);
  await db.open();
  let now = 1_000_000;
  clock = new HlcClock("probe", () => (now += 1));
});

const ctx = () => ({ db, clock });

async function scaffold() {
  const band = await createBand("Hollow Crown", ctx());
  const tuning = await createTuningFromPreset(band.id, presetById("bass5-b")!, true, ctx());
  const song = await createSong(band.id, "Dirge", tuning.id, ctx());
  return createPart(song, ctx());
}

const read = async (id: string) => (await db.events.get(id)) as EventRow;
const outbox = () => db.outbox.count();
const moved = (a: EventRow, b: EventRow) =>
  Object.keys(b.fieldClocks)
    .filter((k) => (a.fieldClocks as Record<string, string>)[k] !== (b.fieldClocks as Record<string, string>)[k])
    .sort();
const wireOk = async (id: string) =>
  expect(eventRowSchema.safeParse(await read(id)).success).toBe(true);

const FRESH = {
  kind: "notes",
  techniques: {},
  repeat: 1,
  durationHint: null,
  tupletId: null,
  tupletCount: null,
};

describe("INV-002: nothing armed, 7 routes", () => {
  const inserted = async (row: EventRow, before: number) => {
    expect(row).toMatchObject({ ...FRESH, frets: { "3": 7 } });
    expect(await outbox()).toBe(before + 1);
    await wireOk(row.id);
  };

  it("insert at the end", async () => {
    const part = await scaffold();
    const a = await insertNote(part, [], null, 3, 5, ctx());
    const before = await outbox();
    await inserted(await insertNote(part, [a], a.id, 3, 7, ctx()), before);
  });
  it("insert mid-part", async () => {
    const part = await scaffold();
    const a = await insertNote(part, [], null, 3, 5, ctx());
    const b = await insertNote(part, [a], a.id, 3, 9, ctx());
    const before = await outbox();
    const row = await insertNote(part, [a, b], a.id, 3, 7, ctx());
    await inserted(row, before);
    expect((await listEvents(part.id, db)).map((e) => e.id)).toEqual([a.id, row.id, b.id]);
  });
  it("insert at the start", async () => {
    const part = await scaffold();
    const a = await insertNote(part, [], null, 3, 5, ctx());
    const before = await outbox();
    const row = await insertNote(part, [a], null, 3, 7, ctx());
    await inserted(row, before);
    expect((await listEvents(part.id, db)).map((e) => e.id)).toEqual([row.id, a.id]);
  });
  it("insert after a barline", async () => {
    const part = await scaffold();
    const a = await insertNote(part, [], null, 3, 5, ctx());
    const bar = await insertBarline(part, [a], a.id, ctx());
    const before = await outbox();
    await inserted(await insertNote(part, [a, bar], bar.id, 3, 7, ctx()), before);
  });
  it("stack on a new string", async () => {
    const part = await scaffold();
    const a = await insertNote(part, [], null, 3, 5, ctx());
    const before = await outbox();
    const b = await stackNote(a, 2, 7, ctx());
    expect(b.frets).toEqual({ "3": 5, "2": 7 });
    expect(b.techniques).toEqual({});
    expect(moved(a, b)).toEqual(["frets"]);
    expect(await outbox()).toBe(before + 1);
  });
  it("stack on a rest", async () => {
    const part = await scaffold();
    const a = await insertRest(part, [], null, ctx());
    const before = await outbox();
    const b = await stackNote(a, 2, 7, ctx());
    expect(b.kind).toBe("notes");
    expect(moved(a, b)).toEqual(["frets", "kind"]);
    expect(await outbox()).toBe(before + 1);
  });
  it("stack replacing a plain note", async () => {
    const part = await scaffold();
    const a = await insertNote(part, [], null, 3, 5, ctx());
    const before = await outbox();
    const b = await stackNote(a, 3, 7, ctx());
    expect(b.frets).toEqual({ "3": 7 });
    expect(moved(a, b)).toEqual(["frets"]);
    expect(await outbox()).toBe(before + 1);
  });
});

describe("INV-006: the stored form, 4 chips x {insert, stack}", () => {
  for (const t of TRANSITIONS) {
    it(`${t} by insert`, async () => {
      const part = await scaffold();
      const a = await insertNote(part, [], null, 3, 5, ctx());
      const b = await insertNote(part, [a], a.id, 3, 7, { ...ctx(), techniques: [t] });
      expect((await read(b.id)).techniques).toEqual({ "3": [t] });
      expect((await read(a.id)).techniques).toEqual({});
      expect(JSON.stringify(await read(b.id))).not.toContain(a.id);
      await wireOk(b.id);
    });
    it(`${t} by stack`, async () => {
      const part = await scaffold();
      const a = await insertNote(part, [], null, 3, 5, ctx());
      const b = await stackNote(a, 2, 7, { ...ctx(), techniques: [t] });
      expect((await read(b.id)).techniques).toEqual({ "2": [t] });
      expect(moved(a, b)).toEqual(["frets", "techniques"]);
      await wireOk(b.id);
    });
  }
});

describe("INV-013: nothing lost", () => {
  it("15 pairs, with both promises in flight", async () => {
    const part = await scaffold();
    for (let i = 0; i < 6; i += 1) {
      for (let j = i + 1; j < 6; j += 1) {
        const a = await insertNote(part, [], null, 3, 7, ctx());
        await Promise.all([
          toggleDecoration(a.id, 3, DECORATIONS[i], ctx()),
          toggleDecoration(a.id, 3, DECORATIONS[j], ctx()),
        ]);
        expect(new Set((await read(a.id)).techniques["3"])).toEqual(
          new Set([DECORATIONS[i], DECORATIONS[j]]),
        );
      }
    }
  });
  it("6 double taps land back at off", async () => {
    const part = await scaffold();
    for (const d of DECORATIONS) {
      const a = await insertNote(part, [], null, 3, 7, ctx());
      await Promise.all([toggleDecoration(a.id, 3, d, ctx()), toggleDecoration(a.id, 3, d, ctx())]);
      expect((await read(a.id)).techniques).toEqual({});
    }
  });
  it("a pair across two strings, and all six in one burst", async () => {
    const part = await scaffold();
    const a = await insertNote(part, [], null, 3, 7, ctx());
    const b = await stackNote(a, 2, 5, ctx());
    await Promise.all([
      toggleDecoration(b.id, 3, "bend", ctx()),
      toggleDecoration(b.id, 2, "tap", ctx()),
    ]);
    expect((await read(b.id)).techniques).toEqual({ "3": ["bend"], "2": ["tap"] });
    await Promise.all(DECORATIONS.map((d) => toggleDecoration(b.id, 2, d, ctx())));
    expect((await read(b.id)).techniques["2"]).toHaveLength(5); // tap went off, five came on
  });
});

describe("INV-014: 6 decorations x {on, off} x 4 contexts", () => {
  const CONTEXTS: Record<string, { frets: EventRow["frets"]; techniques: Record<string, string[]> }> = {
    "with a transition": { frets: { "3": 7 }, techniques: { "3": ["hammer_on"] } },
    dead_note: { frets: { "3": 7 }, techniques: { "3": ["dead_note"] } },
    "an unknown entry": { frets: { "3": 7 }, techniques: { "3": ["wobble"] } },
    "another string decorated": { frets: { "3": 7, "2": 5 }, techniques: { "2": ["bend"] } },
  };

  for (const d of DECORATIONS) {
    for (const [name, prepared] of Object.entries(CONTEXTS)) {
      it(`${d} ${name}`, async () => {
        const part = await scaffold();
        const a = await insertNote(part, [], null, 3, 7, ctx());
        await db.events.update(a.id, prepared as Partial<EventRow>);
        const before = await read(a.id);

        await toggleDecoration(a.id, 3, d, ctx());
        const on = await read(a.id);
        expect(moved(before, on)).toEqual(["techniques"]);
        expect(on.techniques["3"]).toContain(d);
        const rest = (row: EventRow) => ({ ...row, techniques: 0, fieldClocks: 0, updatedAt: 0 });
        expect(rest(on)).toEqual(rest(before));
        await wireOk(a.id);

        await toggleDecoration(a.id, 3, d, ctx());
        expect((await read(a.id)).techniques).toEqual(before.techniques);
      });
    }

    it(`${d} off restores {} on a plain note`, async () => {
      const part = await scaffold();
      const a = await insertNote(part, [], null, 3, 7, ctx());
      await toggleDecoration(a.id, 3, d, ctx());
      await toggleDecoration(a.id, 3, d, ctx());
      expect((await read(a.id)).techniques).toEqual({});
    });
  }
});

describe("INV-015: nothing the wire refuses", () => {
  const list = (n: number) =>
    ["hammer_on", "dead_note", "w1", "w2", "w3", "w4", "w5", "w6"].slice(0, n) as Technique[];

  for (const n of [6, 7, 8]) {
    it(`a list of ${n}, on then off`, async () => {
      const part = await scaffold();
      const a = await insertNote(part, [], null, 3, 7, ctx());
      await db.events.update(a.id, { techniques: { "3": list(n) } });
      const before = await outbox();

      await toggleDecoration(a.id, 3, "vibrato", ctx());
      await wireOk(a.id);
      expect((await read(a.id)).techniques["3"]).toHaveLength(Math.min(n + 1, 8));
      expect(await outbox()).toBe(before + (n < 8 ? 1 : 0));

      await toggleDecoration(a.id, 3, "vibrato", ctx());
      await wireOk(a.id);
    });
  }

  it("the cap is the real schema's: 8 accepted, 9 refused", async () => {
    const part = await scaffold();
    const row = await read((await insertNote(part, [], null, 3, 7, ctx())).id);
    const parse = (n: number) =>
      eventRowSchema.safeParse({
        ...row,
        techniques: { "3": Array.from({ length: n }, () => "bend") },
      }).success;
    expect([parse(8), parse(9)]).toEqual([true, false]);
  });

  it("insert with a transition, and stack with a transition onto a full list", async () => {
    const part = await scaffold();
    const a = await insertNote(part, [], null, 3, 7, { ...ctx(), techniques: ["slide_up"] });
    await wireOk(a.id);
    await db.events.update(a.id, { techniques: { "3": list(8) } });
    const b = await stackNote(await read(a.id), 3, 9, { ...ctx(), techniques: ["pull_off"] });
    expect(b.techniques).toEqual({ "3": ["pull_off"] });
    await wireOk(a.id);
  });
});

describe("INV-016: a removed note leaves nothing behind", () => {
  it("stack replace with nothing armed", async () => {
    const part = await scaffold();
    const a = await insertNote(part, [], null, 3, 7, { ...ctx(), techniques: ["hammer_on"] });
    expect((await stackNote(a, 3, 9, ctx())).techniques).toEqual({});
  });
  it("stack replace with a chip armed", async () => {
    const part = await scaffold();
    const a = await insertNote(part, [], null, 3, 7, { ...ctx(), techniques: ["hammer_on"] });
    const b = await stackNote(a, 3, 9, { ...ctx(), techniques: ["slide_up"] });
    expect(b.techniques).toEqual({ "3": ["slide_up"] });
  });
  it("same-fret stack", async () => {
    const part = await scaffold();
    const a = await insertNote(part, [], null, 3, 7, ctx());
    await toggleDecoration(a.id, 3, "vibrato", ctx());
    expect((await stackNote(await read(a.id), 3, 7, ctx())).techniques).toEqual({});
  });
  it("unstackNote with a second string left, then a new note on that string", async () => {
    const part = await scaffold();
    const a = await insertNote(part, [], null, 3, 7, { ...ctx(), techniques: ["hammer_on"] });
    const b = await stackNote(a, 2, 5, ctx());
    await unstackNote(b, 3, ctx());
    expect((await read(a.id)).techniques).toEqual({});
    expect((await stackNote(await read(a.id), 3, 9, ctx())).techniques).toEqual({});
  });
  it("unstackNote emptying the column", async () => {
    const part = await scaffold();
    const a = await insertNote(part, [], null, 3, 7, { ...ctx(), techniques: ["hammer_on"] });
    await unstackNote(a, 3, ctx());
    expect(await listEvents(part.id, db)).toHaveLength(0);
  });
  it("stacking onto an orphan technique", async () => {
    const part = await scaffold();
    const a = await insertNote(part, [], null, 3, 7, ctx());
    await db.events.update(a.id, { techniques: { "2": ["bend"] } });
    expect((await stackNote(await read(a.id), 2, 5, ctx())).techniques).toEqual({});
  });
});
