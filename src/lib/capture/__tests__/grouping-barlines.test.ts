/**
 * INV-003 / FR-010 / SC-005: 4 grouping actions x 6 barline shapes x {cursor at the end, mid-part},
 * read from stored rows and from toAscii, and a barline arriving between render and tap.
 */
import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";
import {
  groupRunEndingAt,
  groupSelection,
  insertBarline,
  tripletFromTail,
} from "@/lib/local/editing";
import type { EventRow } from "@/lib/model";
import { toAscii } from "@/lib/tab/ascii";
import { bass5, build, NONE, rows, shapes, triple, world } from "./unit-helpers";

function expectNoCrossing(all: readonly EventRow[]) {
  const closed = new Set<string>();
  let open = new Set<string>();
  for (const r of all) {
    if (r.kind === "barline") {
      expect(triple(r)).toEqual(NONE);
      for (const id of open) closed.add(id);
      open = new Set();
    } else if (r.tupletId) {
      expect(closed.has(r.tupletId)).toBe(false);
      open.add(r.tupletId);
    }
  }
}

/** No bracket character may sit on a barline's offset. */
function expectAsciiStopsAtBars(all: readonly EventRow[]) {
  if (!all.some((r) => r.tupletId)) return;
  const [bracket, staff] = toAscii({ events: all, tuning: bass5 }).split("\n");
  const start = staff.indexOf("|") + 1;
  for (let i = start; i < staff.length - 1; i++) {
    if (staff[i] === "|") expect(bracket[i] ?? " ").toBe(" ");
  }
}

describe("INV-003", () => {
  for (const n of [3, 4, 6]) {
    for (const [name, shape] of Object.entries(shapes(n))) {
      for (const cursor of ["at the end", "mid-part"] as const) {
        const tail = cursor === "mid-part" ? "nn" : "";
        for (const action of ["tuplet", "group", "button", "tripletFromTail"] as const) {
          it(`${action}, n=${n}, ${name}, cursor ${cursor}`, async () => {
            const w = await world();
            const before = await build(w, shape + tail);
            const end = before.length - 1 - tail.length;
            const lastPlayable = before
              .slice(0, end + 1)
              .reverse()
              .find((r) => r.kind !== "barline")!;
            if (action === "tuplet" || action === "group") {
              const kind = action === "tuplet" ? "tuplet" : "plain";
              await groupSelection(w.part.id, before[0].id, before[end].id, kind, w.ctx);
            } else if (action === "button") {
              await groupRunEndingAt(w.part.id, lastPlayable.id, 3, w.ctx);
            } else {
              await tripletFromTail(w.part.id, 3, w.ctx);
            }
            const after = await rows(w);
            expectNoCrossing(after);
            expectAsciiStopsAtBars(after);
          });
        }
      }
    }
  }

  it("a barline arriving between render and tap re-derives the offer", async () => {
    const w = await world();
    const stale = await build(w, "nnnn");
    await insertBarline(w.part, stale, stale[1].id, w.ctx);
    const outbox = await w.db.outbox.count();
    expect(await groupSelection(w.part.id, stale[0].id, stale[3].id, "tuplet", w.ctx)).toEqual([]);
    expect(await w.db.outbox.count()).toBe(outbox);
    expect(await groupSelection(w.part.id, stale[0].id, stale[3].id, "plain", w.ctx)).toHaveLength(2);
    expectNoCrossing(await rows(w));
  });

  it("a barline arriving among the triplet's three refuses, stale cursor or not", async () => {
    const w = await world();
    const stale = await build(w, "nnn");
    await insertBarline(w.part, stale, stale[0].id, w.ctx);
    const outbox = await w.db.outbox.count();
    expect(await groupRunEndingAt(w.part.id, stale[2].id, 3, w.ctx)).toBeUndefined();
    expect(await w.db.outbox.count()).toBe(outbox);
  });
});
