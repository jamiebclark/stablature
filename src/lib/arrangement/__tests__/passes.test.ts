/** INV-032: the play view and the click read one list of drawn passes. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { EventRow } from "@/lib/model";
import { eventsInBars } from "@/lib/tab/layout";
import { drawnPasses } from "../passes";

let n = 0;
function ev(partId: string, kind: EventRow["kind"] = "notes"): EventRow {
  n += 1;
  return {
    id: `e${n}`,
    bandId: "b",
    partId,
    rank: `a${n}`,
    kind,
    frets: kind === "notes" ? { "0": n } : {},
    techniques: {},
    repeat: 1,
    durationHint: null,
    tupletId: null,
    tupletCount: null,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
  } as EventRow;
}
const bars = (partId: string) => [
  ev(partId),
  ev(partId, "barline"),
  ev(partId),
  ev(partId, "barline"),
  ev(partId),
];

describe("drawnPasses", () => {
  it("gives each step exactly the columns eventsInBars gives it", () => {
    const eventsByPart: Record<string, EventRow[]> = { A: bars("A"), B: bars("B") };
    const step = (partId: string, fromBar: number | null, toBar: number | null, sections: string[]) => ({
      partId,
      entryId: "1",
      pass: 1,
      passes: 1,
      fromBar,
      toBar,
      sections,
      visits: [],
    });
    const steps = [
      step("A", null, null, []),
      step("B", 2, 3, ["Verse"]),
      step("A", 1, 1, []),
      step("GONE", null, null, []),
    ];
    const passes = drawnPasses(steps, eventsByPart);
    expect(passes).toHaveLength(steps.length);
    passes.forEach((p, i) => {
      expect(p.step).toBe(steps[i]);
      const all = eventsByPart[steps[i].partId] ?? [];
      expect(p.events).toEqual(eventsInBars(all, steps[i].fromBar, steps[i].toBar));
    });
    expect(passes[3].events).toEqual([]);
  });
  it("PlayView does not import eventsInBars", () => {
    const source = readFileSync("src/components/app/PlayView.tsx", "utf8");
    expect(source).not.toMatch(/eventsInBars/);
  });
});
