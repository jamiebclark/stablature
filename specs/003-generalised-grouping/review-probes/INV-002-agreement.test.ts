/**
 * INV-002 / SC-002: offer length, stored count, tupletSpans count, toAscii digits and the sheet's
 * heading, for counts 2 to 16 x {all notes, one rest, one repeat: 8}, in both densities.
 */
import "fake-indexeddb/auto";

import { describe, expect, it } from "vitest";
import { groupOffer } from "@/lib/capture/grouping";
import { COLUMN_PROPERTIES, type PropertyContext } from "@/lib/capture/properties";
import { groupSelection, setColumnRepeat } from "@/lib/local/editing";
import { toAscii } from "@/lib/tab/ascii";
import { layoutPart, tupletSpans } from "@/lib/tab/layout";
import { bass5, build, rows, world } from "./unit-helpers";

const heading = (event: unknown) =>
  COLUMN_PROPERTIES.find((p) => p.id === "group")!.heading!({ event } as PropertyContext);

describe("INV-002", () => {
  for (const variant of ["all notes", "one rest", "one repeat: 8"] as const) {
    it(variant, async () => {
      for (let n = 2; n <= 16; n++) {
        const w = await world();
        const all = await build(w, variant === "one rest" ? `r${"n".repeat(n - 1)}` : "n".repeat(n));
        if (variant === "one repeat: 8") await setColumnRepeat(all[n - 1].id, 8, w.ctx);
        const fresh = await rows(w);
        expect(groupOffer(fresh).tuplet!.length).toBe(n);
        await groupSelection(w.part.id, fresh[0].id, fresh.at(-1)!.id, "tuplet", w.ctx);
        const stored = await rows(w);
        expect(new Set(stored.map((r) => r.tupletCount))).toEqual(new Set([n]));
        for (const density of ["expanded", "compact"] as const) {
          const layout = layoutPart({ events: stored, tuning: bass5, density });
          expect(tupletSpans(layout).map((s) => s.count)).toEqual([n]);
          const bracket = toAscii({ events: stored, tuning: bass5, density }).split("\n")[0];
          expect(bracket.match(/\d+/g)).toEqual([String(n)]);
        }
        expect(heading(stored[0])).toBe(`tuplet of ${n}`);
        w.db.close();
      }
    });
  }
});
