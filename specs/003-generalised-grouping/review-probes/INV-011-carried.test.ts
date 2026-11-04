/**
 * INV-011 / FR-007: carried by copy, cut and variant, each x {plain, counted, legacy}; a pasted
 * group has a new id; two pastes do not weld; a partial copy keeps its kind. Null on every other
 * creation path, read strictly.
 */
import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";
import { copyColumns, cutColumns, pasteClipboard } from "@/lib/local/clipboard";
import {
  appendBarline,
  appendColumn,
  appendNote,
  createVariant,
  groupSelection,
  insertBarline,
  insertColumn,
  insertNote,
  insertRest,
} from "@/lib/local/editing";
import { newId } from "@/lib/ids";
import { toAscii } from "@/lib/tab/ascii";
import { bass5, build, makeLegacy, NONE, rows, triple, world, type World } from "./unit-helpers";

type Flavour = "plain" | "counted" | "legacy";

async function grouped(w: World, flavour: Flavour) {
  const all = await build(w, "nnn");
  if (flavour === "legacy") {
    const id = newId();
    for (const r of all) await makeLegacy(w, r.id, id, 3);
  } else {
    const kind = flavour === "plain" ? "plain" : "tuplet";
    await groupSelection(w.part.id, all[0].id, all[2].id, kind, w.ctx);
  }
  return rows(w);
}
const expected = {
  plain: ["plain", null],
  counted: ["tuplet", 3],
  legacy: [null, 3],
} as const;

describe("INV-011 carried", () => {
  for (const flavour of ["plain", "counted", "legacy"] as const) {
    const [kind, count] = expected[flavour];

    it(`copy, ${flavour}: fresh id, and two pastes do not weld`, async () => {
      const w = await world();
      const source = await grouped(w, flavour);
      const clip = copyColumns(source);
      const one = await pasteClipboard(w.part, source, source[2].id, clip, w.ctx);
      const two = await pasteClipboard(w.part, await rows(w), one.at(-1)!.id, clip, w.ctx);
      for (const pasted of [one, two]) {
        expect(new Set(pasted.map((r) => r.tupletId)).size).toBe(1);
        expect(pasted[0].tupletId).not.toBe(source[0].tupletId);
        for (const r of pasted) {
          expect(r.groupKind ?? null).toBe(kind);
          expect(r.tupletCount).toBe(count);
        }
      }
      expect(one[0].tupletId).not.toBe(two[0].tupletId);
      // Three brackets, not one welded span.
      const bracket = toAscii({ events: await rows(w), tuning: bass5 }).split("\n")[0];
      expect(bracket.match(/,[-\d]*,/g)).toHaveLength(3);
    });

    it(`cut, ${flavour}`, async () => {
      const w = await world();
      const source = await grouped(w, flavour);
      const clip = await cutColumns(source, [], w.ctx);
      expect(await rows(w)).toEqual([]);
      const pasted = await pasteClipboard(w.part, [], null, clip, w.ctx);
      for (const r of pasted) expect(r.groupKind ?? null).toBe(kind);
    });

    it(`variant, ${flavour}`, async () => {
      const w = await world();
      const source = await grouped(w, flavour);
      const variant = await createVariant(w.part, w.ctx);
      const copies = await rows(w, variant);
      copies.forEach((r, i) => {
        expect(r.tupletId).toBe(source[i].tupletId);
        expect(r.tupletCount).toBe(count);
        expect(r.groupKind ?? null).toBe(kind);
      });
    });

    it(`partial copy, ${flavour}`, async () => {
      const w = await world();
      const source = await grouped(w, flavour);
      const pasted = await pasteClipboard(
        w.part,
        source,
        source[2].id,
        copyColumns(source.slice(1)),
        w.ctx,
      );
      for (const r of pasted) {
        expect(r.groupKind ?? null).toBe(kind);
        expect(r.tupletCount).toBe(count);
      }
    });
  }
});

describe("INV-011 null", () => {
  it("every other creation path stores strict null in all three fields", async () => {
    const w = await world();
    const a = await appendNote(w.part, 3, 1, w.ctx);
    const made = [
      a,
      await appendColumn(w.part, { "2": 2 }, {}, w.ctx),
      await appendBarline(w.part, w.ctx),
      await insertColumn(w.part, await rows(w), a.id, { "1": 3 }, {}, w.ctx),
      await insertNote(w.part, await rows(w), a.id, 2, 4, w.ctx),
      await insertRest(w.part, await rows(w), a.id, w.ctx),
      await insertBarline(w.part, await rows(w), a.id, w.ctx),
    ];
    for (const r of made) expect(triple(r)).toEqual(NONE);
    for (const r of await rows(w)) {
      expect(triple(r)).toEqual(NONE);
      expect(r.groupKind).toBeNull();
    }
    expect(toAscii({ events: await rows(w), tuning: bass5 })).not.toContain(",");
  });

  it("paste and variant of ungrouped columns", async () => {
    const w = await world();
    const source = await build(w, "nrn|");
    const pasted = await pasteClipboard(w.part, source, null, copyColumns(source), w.ctx);
    const variant = await createVariant(w.part, w.ctx);
    for (const r of [...pasted, ...(await rows(w)), ...(await rows(w, variant))]) {
      expect(triple(r)).toEqual(NONE);
    }
  });
});
