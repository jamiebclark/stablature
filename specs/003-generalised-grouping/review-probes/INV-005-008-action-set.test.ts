/**
 * INV-005 to INV-008, over the plan's set A (6 actions).
 * INV-005 / FR-014: 6 x {edit the variant, edit the parent} x {shared id, two variants of a parent}.
 * INV-006 / FR-005: 6 x {joining, dissolved}; merge pairs both ways.
 * INV-007 / FR-015: 6 x every N, on a group that dissolves another.
 * INV-008 / FR-016: 6 x columns holding {techniques, repeat, chord, rest, durationHint}.
 */
import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";
import {
  createVariant,
  groupSelection,
  setChord,
  setColumnRepeat,
  toggleDecoration,
  ungroupTuplet,
} from "@/lib/local/editing";
import { patchRow } from "@/lib/local/mutate";
import { listAnnotations, listEvents } from "@/lib/local/queries";
import type { HlcClock } from "@/lib/hlc";
import type { EventRow } from "@/lib/model";
import { mergeRow } from "@/lib/sync/merge";
import {
  build,
  expectClocksTogether,
  expectWrittenState,
  fiveWithOldGroup,
  rows,
  SET_A,
  triple,
  world,
  type World,
} from "./unit-helpers";

const entriesFor = async (w: World, partId: string) =>
  (await w.db.outbox.toArray()).filter((e) => (e.row as EventRow).partId === partId).length;

describe("INV-005: never another part", () => {
  for (const [name, act] of Object.entries(SET_A)) {
    for (const edit of ["variant", "parent"] as const) {
      it(`${name}, edit the ${edit}`, async () => {
        const w = await world();
        await fiveWithOldGroup(w);
        const v1 = await createVariant(w.part, w.ctx);
        const v2 = await createVariant(w.part, w.ctx);
        const target = edit === "variant" ? v1 : w.part;
        const others = edit === "variant" ? [w.part, v2] : [v1, v2];
        const snapshots = await Promise.all(others.map((p) => listEvents(p.id, w.db)));
        const counts = await Promise.all(others.map((p) => entriesFor(w, p.id)));
        const mine = await listEvents(target.id, w.db);
        expect(mine[0].tupletId).toBe(snapshots[0][0].tupletId); // the id really is shared
        await act({ partId: target.id, rows: mine, ctx: w.ctx });
        expect(await listEvents(target.id, w.db)).not.toEqual(mine);
        for (const [i, other] of others.entries()) {
          expect(await listEvents(other.id, w.db)).toEqual(snapshots[i]);
          expect(await entriesFor(w, other.id)).toBe(counts[i]);
        }
      });
    }
  }
});

describe("INV-006: three written states, one clock", () => {
  for (const [name, act] of Object.entries(SET_A)) {
    for (const old of ["tuplet", "plain"] as const) {
      it(`${name} over a ${old} group`, async () => {
        const w = await world();
        const before = await fiveWithOldGroup(w, old);
        await act({ partId: w.part.id, rows: before, ctx: w.ctx });
        for (const r of await rows(w)) {
          expectWrittenState(r);
          expectClocksTogether(r);
        }
      });
    }
  }

  type Write = (w: World, r: EventRow[]) => Promise<unknown>;

  /** Two devices that start from the same rows and each make one write. */
  async function devices(one: Write, two: Write) {
    const a = await world("phone", 2_000_000);
    const start = await build(a, "nnnnnn");
    const b = await world("laptop", 3_000_000);
    await b.db.events.bulkPut(start);
    await one(a, start);
    await two(b, start);
    return { a: await listEvents(a.part.id, a.db), b: await b.db.events.toArray() };
  }
  const group =
    (from: number, to: number, kind: "tuplet" | "plain"): Write =>
    (w, r) =>
      groupSelection(r[0].partId, r[from].id, r[to].id, kind, w.ctx);
  const seedThenUngroup: Write = async (w, r) => {
    await groupSelection(r[0].partId, r[0].id, r[2].id, "tuplet", w.ctx);
    await ungroupTuplet([r[1]], w.ctx);
  };

  const PAIRS: Record<string, [Write, Write]> = {
    "tuplet vs plain": [group(0, 3, "tuplet"), group(0, 3, "plain")],
    "group vs ungroup": [group(0, 2, "plain"), seedThenUngroup],
    "group vs group on overlapping columns": [group(0, 3, "tuplet"), group(2, 5, "plain")],
  };

  for (const [name, [one, two]] of Object.entries(PAIRS)) {
    for (const flip of [false, true]) {
      it(`${name}${flip ? ", the other way round" : ""}`, async () => {
        const d = flip ? await devices(two, one) : await devices(one, two);
        const byId = new Map(d.b.map((r) => [r.id, r]));
        for (const left of d.a) {
          const right = byId.get(left.id)!;
          const ab = mergeRow("events", left, right);
          const ba = mergeRow("events", right, left);
          expect(triple(ab)).toEqual(triple(ba));
          expect([triple(left), triple(right)]).toContainEqual(triple(ab));
          expectClocksTogether(ab);
        }
      });
    }
  }
});

describe("INV-007: never half done", () => {
  for (const [name, act] of Object.entries(SET_A)) {
    it(name, async () => {
      const w = await world();
      const start = await fiveWithOldGroup(w);
      const before = { events: await w.db.events.toArray(), outbox: await w.db.outbox.toArray() };
      let failed = 0;
      for (let n = 1; n < 20; n++) {
        let calls = 0;
        const clock = {
          send: () => {
            if (++calls === n) throw new Error("clock");
            return w.clock.send();
          },
        } as unknown as HlcClock;
        const outcome = await act({
          partId: w.part.id,
          rows: start,
          ctx: { db: w.db, clock },
        }).then(
          () => "done",
          () => "threw",
        );
        if (outcome === "done") break;
        failed += 1;
        expect(await w.db.events.toArray()).toEqual(before.events);
        expect(await w.db.outbox.toArray()).toEqual(before.outbox);
      }
      // Every action here touches at least the three columns of the old group.
      expect(failed).toBeGreaterThanOrEqual(3);
    });
  }
});

describe("INV-008: nothing but the three fields", () => {
  const strip = (row: EventRow) => {
    const copy: Record<string, unknown> = { ...row };
    for (const k of ["tupletId", "tupletCount", "groupKind", "fieldClocks", "updatedAt"]) {
      delete copy[k];
    }
    return copy;
  };
  const moved = (a: EventRow, b: EventRow) =>
    Object.keys(b.fieldClocks)
      .filter((k) => a.fieldClocks[k] !== b.fieldClocks[k])
      .sort();

  for (const [name, act] of Object.entries(SET_A)) {
    it(name, async () => {
      const w = await world();
      const shaped = await build(w, "nnrnn");
      await toggleDecoration(shaped[1].id, 3, "vibrato", w.ctx);
      await setColumnRepeat(shaped[3].id, 8, w.ctx);
      await setChord(w.part, shaped[4].id, "Am", w.ctx);
      await patchRow("events", shaped[4].id, { durationHint: "8" }, w.ctx);
      await groupSelection(w.part.id, shaped[0].id, shaped[2].id, "tuplet", w.ctx);
      const before = await rows(w);
      const notes = await listAnnotations(w.part.id, w.db);
      const outbox = await w.db.outbox.count();

      await act({ partId: w.part.id, rows: before, ctx: w.ctx });

      const after = await rows(w);
      expect(after.map((r) => r.id)).toEqual(before.map((r) => r.id));
      expect(after.map(strip)).toEqual(before.map(strip));
      expect(await listAnnotations(w.part.id, w.db)).toEqual(notes);
      let touched = 0;
      after.forEach((r, i) => {
        const clocks = moved(before[i], r);
        if (clocks.length === 0) {
          expect(r).toEqual(before[i]);
          return;
        }
        touched += 1;
        expect(clocks).toEqual(["groupKind", "tupletCount", "tupletId"]);
      });
      expect(touched).toBeGreaterThan(0);
      expect(await w.db.outbox.count()).toBe(outbox + touched);
    });
  }

  it("a selected column that joins nothing gets no write", async () => {
    const w = await world();
    const all = await build(w, "nn|n");
    const outbox = await w.db.outbox.count();
    await groupSelection(w.part.id, all[0].id, all[3].id, "plain", w.ctx);
    expect(await w.db.outbox.count()).toBe(outbox + 2);
    expect((await rows(w))[3]).toEqual(all[3]);
  });
});
