/**
 * INV-012 / FR-017: the nine rows of data-model.md's table, each x {grouped, ungrouped}; a
 * selection overlapping two groups; a single grouped column; 18, 20 and 40; every extension step.
 * Selections are real rows from real writes. INV-002-012-controls.spec.ts reads the same table on screen.
 */
import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";
import { groupOffer } from "@/lib/capture/grouping";
import { groupSelection } from "@/lib/local/editing";
import { build, rows, world } from "./unit-helpers";

const ROWS: { shape: string; tuplet: number | null; plain: number }[] = [
  { shape: "n", tuplet: null, plain: 0 },
  { shape: "|", tuplet: null, plain: 0 },
  { shape: "nn", tuplet: 2, plain: 1 },
  { shape: "|nnn|", tuplet: 3, plain: 1 },
  { shape: "n|n", tuplet: null, plain: 0 },
  { shape: "nn|n", tuplet: null, plain: 1 },
  { shape: "nn|nn", tuplet: null, plain: 2 },
  { shape: "n".repeat(16), tuplet: 16, plain: 1 },
  { shape: "n".repeat(17), tuplet: null, plain: 1 },
];

describe("INV-012", () => {
  for (const { shape, tuplet, plain } of ROWS) {
    for (const grouped of [false, true]) {
      const label = shape.length > 8 ? `${shape.length} columns` : shape;
      it(`${label}, ${grouped ? "grouped" : "ungrouped"}`, async () => {
        const w = await world();
        const all = await build(w, shape + (grouped ? "nn" : ""));
        const selection = all.slice(0, shape.length);
        const playable = selection.filter((r) => r.kind !== "barline");
        if (grouped && playable.length > 0) {
          // A group reaching one selected column from outside the selection. When the selection
          // ends in a barline the group would have to cross it, so take the padding's own pair.
          const last = playable.at(-1)!;
          const start = selection.at(-1)!.kind === "barline" ? playable.at(-2) ?? last : last;
          await groupSelection(w.part.id, start.id, selection.at(-1)!.id, "tuplet", w.ctx);
        }
        const fresh = (await rows(w)).slice(0, shape.length);
        const offer = groupOffer(fresh);
        expect(offer.tuplet?.length ?? null).toBe(tuplet);
        expect(offer.plain).toHaveLength(plain);
        const stored = fresh.some((r) => r.tupletId !== null);
        expect(offer.ungroup).toBe(stored);
      });
    }
  }

  it("a selection overlapping two groups", async () => {
    const w = await world();
    const all = await build(w, "nnnn");
    await groupSelection(w.part.id, all[0].id, all[1].id, "tuplet", w.ctx);
    await groupSelection(w.part.id, all[2].id, all[3].id, "plain", w.ctx);
    const offer = groupOffer((await rows(w)).slice(1, 3));
    expect(offer.ungroup).toBe(true);
    expect(offer.tuplet).toHaveLength(2);
  });

  it("a single column in a group offers ungroup and no grouping control", async () => {
    const w = await world();
    const all = await build(w, "nnn");
    await groupSelection(w.part.id, all[0].id, all[2].id, "plain", w.ctx);
    const offer = groupOffer((await rows(w)).slice(1, 2));
    expect([offer.tuplet, offer.plain.length, offer.ungroup]).toEqual([null, 0, true]);
  });

  it("18, 20 and 40 columns, and every extension step from 2 to 17", async () => {
    const w = await world();
    const all = await build(w, "n".repeat(40));
    for (const n of [18, 20, 40]) {
      const offer = groupOffer(all.slice(0, n));
      expect(offer.tuplet).toBeNull();
      expect(offer.plain.map((r) => r.length)).toEqual([n]);
    }
    for (let n = 2; n <= 17; n++) {
      expect(groupOffer(all.slice(0, n)).tuplet?.length ?? null).toBe(n <= 16 ? n : null);
    }
  });
});
