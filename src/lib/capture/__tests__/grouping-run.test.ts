/**
 * INV-016 / FR-022 to FR-025, library half: groupRunEndingAt and tripletFromTail, with the outbox
 * count unchanged on every refusal.
 */
import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";
import { groupRunEndingAt, setColumnRepeat, tripletFromTail } from "@/lib/local/editing";
import { build, rows, world } from "./unit-helpers";

const REFUSED: [string, string, number][] = [
  ["on the first column", "nnn", 0],
  ["on the second column", "nnn", 1],
  ["barline just before the cursor", "nn|n", 3],
  ["barline second before the cursor", "n|nn", 3],
  ["one column in the bar", "nnn|n", 4],
  ["a barline as the end", "nnn|", 3],
];
const MADE: [string, string, number, number[]][] = [
  ["cursor at the end", "nnn", 2, [0, 1, 2]],
  ["mid-part", "nnnnn", 2, [0, 1, 2]],
  ["ending on a rest", "nnr", 2, [0, 1, 2]],
  ["a rest inside", "nrn", 2, [0, 1, 2]],
  ["a barline after the cursor", "nnn|n", 2, [0, 1, 2]],
  ["a trailing barline, cursor at a note", "nnn|", 2, [0, 1, 2]],
];

describe("INV-016", () => {
  for (const [name, shape, at] of REFUSED) {
    it(`refuses: ${name}`, async () => {
      const w = await world();
      const all = await build(w, shape);
      const outbox = await w.db.outbox.count();
      expect(await groupRunEndingAt(w.part.id, all[at].id, 3, w.ctx)).toBeUndefined();
      expect(await w.db.outbox.count()).toBe(outbox);
      expect(await rows(w)).toEqual(all);
    });
  }
  for (const [name, shape, at, members] of MADE) {
    it(`makes: ${name}`, async () => {
      const w = await world();
      const all = await build(w, shape);
      const id = await groupRunEndingAt(w.part.id, all[at].id, 3, w.ctx);
      expect(id).toBeDefined();
      const after = await rows(w);
      expect(after.flatMap((r, i) => (r.tupletId === id ? [i] : []))).toEqual(members);
      for (const i of members) {
        expect(after[i].tupletCount).toBe(3);
        expect(after[i].groupKind).toBe("tuplet");
      }
    });
  }
  it("a repeat column counts as one", async () => {
    const w = await world();
    const all = await build(w, "nnn");
    await setColumnRepeat(all[1].id, 8, w.ctx);
    await groupRunEndingAt(w.part.id, null, 3, w.ctx);
    expect((await rows(w)).map((r) => r.tupletCount)).toEqual([3, 3, 3]);
  });
  it("null means the last playable column, so a trailing barline is skipped", async () => {
    const w = await world();
    await build(w, "nnn|");
    expect(await groupRunEndingAt(w.part.id, null, 3, w.ctx)).toBeDefined();
  });
  it("the two columns of a new part refuse with no write", async () => {
    const w = await world();
    await build(w, "nn");
    const outbox = await w.db.outbox.count();
    expect(await groupRunEndingAt(w.part.id, null, 3, w.ctx)).toBeUndefined();
    expect(await w.db.outbox.count()).toBe(outbox);
  });

  const SEVENTEEN = "n".repeat(17);
  for (const [count, shape, ok] of [
    [1, SEVENTEEN, false],
    [2, SEVENTEEN, true],
    [3, SEVENTEEN, true],
    [16, SEVENTEEN, true],
    [17, SEVENTEEN, false],
    [3, "nn", false],
    [3, "nn|n", false],
  ] as const) {
    it(`tripletFromTail ${count} over ${shape.length > 8 ? "17 columns" : shape}`, async () => {
      const w = await world();
      await build(w, shape);
      const outbox = await w.db.outbox.count();
      const id = await tripletFromTail(w.part.id, count, w.ctx);
      expect(id !== undefined).toBe(ok);
      if (!ok) expect(await w.db.outbox.count()).toBe(outbox);
      else expect((await rows(w)).filter((r) => r.tupletId === id)).toHaveLength(count);
    });
  }
});
