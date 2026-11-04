/**
 * INV-012 (unit half). T021 landed `prunedArmed` before this probe, so the e2e probe
 * in e2e/techniques.spec.ts (US4) is the one that failed first on the old prune.
 */
import { describe, expect, it } from "vitest";
import { cursorPending, prunedArmed } from "../latches";
import type { LatchId } from "../latches";

const ALL: LatchId[] = ["stack", "hammer_on", "pull_off", "slide_up", "slide_down"];

describe("INV-012 prune", () => {
  it("cursorPending: an undelivered cursor column is pending, a vanished delivered one is not", () => {
    expect(cursorPending("new", undefined, "old")).toBe(true);
    expect(cursorPending("gone", undefined, "gone")).toBe(false);
    expect(cursorPending("a", "a", "a")).toBe(false);
  });

  for (const id of ALL) {
    const armed = new Set<LatchId>([id]);
    it(`${id}: pending returns armed itself`, () => {
      expect(prunedArmed(armed, new Set(), true)).toBe(armed);
    });
    it(`${id}: settled on notes keeps it, settled on a barline drops it where inapplicable`, () => {
      expect(prunedArmed(armed, armed, false)).toBe(armed);
      const lit = new Set<LatchId>();
      expect(prunedArmed(armed, lit, false)).toBe(lit);
    });
  }
});
