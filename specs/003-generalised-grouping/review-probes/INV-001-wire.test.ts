/**
 * INV-001 / SC-004: never is a row written that sync would refuse. Sizes 2 to 40 x 6 shapes x
 * {tuplet where offered, group}, every outbox row through the real pushRequestSchema in the
 * client's batches, then the ungroup of each result. Then a rest, a repeat: 512 and a legacy row.
 */
import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";
import { groupOffer } from "@/lib/capture/grouping";
import { groupSelection, setColumnRepeat, ungroupTuplet } from "@/lib/local/editing";
import { build, expectOutboxPushes, makeLegacy, rows, shapes, world } from "./unit-helpers";

describe("INV-001", () => {
  it("every size x shape x kind, then ungroup", async () => {
    let cases = 0;
    let written = 0;
    for (let n = 2; n <= 40; n++) {
      for (const shape of Object.values(shapes(n))) {
        for (const kind of ["tuplet", "plain"] as const) {
          const w = await world();
          const all = await build(w, shape);
          const offer = groupOffer(all);
          const ids = await groupSelection(w.part.id, all[0].id, all.at(-1)!.id, kind, w.ctx);
          const expected = kind === "tuplet" ? (offer.tuplet ? 1 : 0) : offer.plain.length;
          expect(ids).toHaveLength(expected);
          if (ids.length) written += 1;
          await expectOutboxPushes(w);
          await ungroupTuplet(await rows(w), w.ctx);
          await expectOutboxPushes(w);
          for (const r of await rows(w)) expect(r.tupletId).toBeNull();
          cases += 1;
          w.db.close();
        }
      }
    }
    console.log(`INV-001: ${cases} cases, ${written} wrote a group`);
    expect(cases).toBe(39 * 6 * 2);
  });

  it("a rest, a repeat: 512 and a legacy row in the selection", async () => {
    for (const kind of ["tuplet", "plain"] as const) {
      const w = await world();
      const all = await build(w, "nrnn");
      await setColumnRepeat(all[0].id, 512, w.ctx);
      await makeLegacy(w, all[2].id, all[2].id, 3);
      await makeLegacy(w, all[3].id, all[2].id, 3);
      await groupSelection(w.part.id, all[0].id, all[3].id, kind, w.ctx);
      await expectOutboxPushes(w);
      await ungroupTuplet(await rows(w), w.ctx);
      await expectOutboxPushes(w);
    }
  });
});
