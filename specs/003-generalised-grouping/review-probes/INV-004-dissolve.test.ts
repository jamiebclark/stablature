/**
 * INV-004 / FR-013 / SC-006: left end, right end, middle, exact, superset, spanning two, each
 * x {counted over counted, counted over plain, plain over counted, plain over plain}; the button
 * over `a b c` then `d`; an old group with columns in another bar; a legacy cross-bar group.
 */
import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";
import { groupRunEndingAt, groupSelection, ungroupTuplet } from "@/lib/local/editing";
import { newId } from "@/lib/ids";
import type { EventRow, GroupKind } from "@/lib/model";
import {
  build,
  expectWrittenState,
  groups,
  makeLegacy,
  NONE,
  rows,
  triple,
  world,
} from "./unit-helpers";

function expectConsistent(all: readonly EventRow[]) {
  for (const members of groups(all).values()) {
    expect(new Set(members.map((m) => m.groupKind)).size).toBe(1);
    if (members[0].groupKind === "tuplet") {
      for (const m of members) expect(m.tupletCount).toBe(members.length);
    }
    for (const m of members) expectWrittenState(m);
  }
}

const CASES: Record<string, { old: [number, number][]; next: [number, number] }> = {
  "left end, from inside": { old: [[3, 7]], next: [3, 4] },
  "left end, from outside": { old: [[3, 7]], next: [1, 4] },
  "right end, from inside": { old: [[3, 7]], next: [6, 7] },
  "right end, from outside": { old: [[3, 7]], next: [6, 9] },
  middle: { old: [[3, 7]], next: [4, 6] },
  exact: { old: [[3, 7]], next: [3, 7] },
  superset: { old: [[3, 7]], next: [2, 8] },
  "spanning two": {
    old: [
      [3, 5],
      [6, 8],
    ],
    next: [5, 6],
  },
};
const KINDS: [GroupKind, GroupKind][] = [
  ["tuplet", "tuplet"],
  ["tuplet", "plain"],
  ["plain", "tuplet"],
  ["plain", "plain"],
];

describe("INV-004", () => {
  for (const [name, { old, next }] of Object.entries(CASES)) {
    for (const [oldKind, newKind] of KINDS) {
      it(`${name}: ${newKind} over ${oldKind}`, async () => {
        const w = await world();
        const all = await build(w, "n".repeat(12));
        for (const [a, b] of old) {
          await groupSelection(w.part.id, all[a].id, all[b].id, oldKind, w.ctx);
        }
        const before = await rows(w);
        const oldIds = new Set(before.map((r) => r.tupletId).filter(Boolean));
        const [made] = await groupSelection(
          w.part.id,
          all[next[0]].id,
          all[next[1]].id,
          newKind,
          w.ctx,
        );
        const after = await rows(w);
        expectConsistent(after);
        after.forEach((r, i) => {
          expect(oldIds.has(r.tupletId)).toBe(false);
          if (i >= next[0] && i <= next[1]) expect(r.tupletId).toBe(made);
          else expect(triple(r)).toEqual(NONE);
        });
      });
    }
  }

  for (const kind of ["tuplet", "plain"] as const) {
    it(`the button over a b c (${kind}) then d leaves b c d and a alone`, async () => {
      const w = await world();
      const all = await build(w, "nnnn");
      await groupSelection(w.part.id, all[0].id, all[2].id, kind, w.ctx);
      await groupRunEndingAt(w.part.id, all[3].id, 3, w.ctx);
      const after = await rows(w);
      expect(triple(after[0])).toEqual(NONE);
      expectConsistent(after);
      expect(after.slice(1).every((r) => r.tupletCount === 3 && r.groupKind === "tuplet")).toBe(
        true,
      );
      expect(new Set(after.slice(1).map((r) => r.tupletId)).size).toBe(1);
    });
  }

  for (const action of ["tuplet", "plain", "button", "ungroup"] as const) {
    it(`an old group with columns in another bar, legacy, under ${action}`, async () => {
      const w = await world();
      const all = await build(w, "nnn|nnn");
      const legacy = newId();
      for (const i of [1, 2, 4, 5]) await makeLegacy(w, all[i].id, legacy, 4);
      if (action === "button") await groupRunEndingAt(w.part.id, all[2].id, 3, w.ctx);
      else if (action === "ungroup") await ungroupTuplet([all[1]], w.ctx);
      else await groupSelection(w.part.id, all[0].id, all[2].id, action, w.ctx);
      const after = await rows(w);
      expect(after.some((r) => r.tupletId === legacy)).toBe(false);
      expect(triple(after[4])).toEqual(NONE);
      expect(triple(after[5])).toEqual(NONE);
      expectConsistent(after);
    });
  }

  it("a lone selected column whose own group lost nothing is left whole", async () => {
    const w = await world();
    const all = await build(w, "nn|nnn");
    await groupSelection(w.part.id, all[3].id, all[5].id, "tuplet", w.ctx);
    const before = await rows(w);
    await groupSelection(w.part.id, all[0].id, all[3].id, "plain", w.ctx);
    const after = await rows(w);
    expect(after.slice(3)).toEqual(before.slice(3));
  });
});
