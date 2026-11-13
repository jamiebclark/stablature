// @vitest-environment jsdom
/**
 * Review probe, INV-006 member Gapk (and FR-017, the spec's edge case "a connector gap, or a variant's removal
 * gap, between two beamed notes: the beam runs through the gap unbroken"), through `render(TabStaff)`.
 *
 * For each gap kind × {single line, wrapped} × beam levels 1..3: the column after the gap shares `L` beam levels
 * with the one before it (`data-beams-left = L`), so the gap's rhythm spacer must hold `L` full-width beams, or the
 * beam has a hole as wide as the gap (1ch for a connector, 3ch for a removal).
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EventRow } from "@/lib/model";
import type { StaffMarks } from "@/lib/reading/marks";
import { bass5, ev } from "@/lib/tab/__tests__/helpers";
import { TabStaff } from "@/components/tab/TabStaff";

const D = { 1: "8", 2: "16", 3: "32" } as const;

function staff(kind: "connector" | "removal", level: 1 | 2 | 3, wrap: boolean) {
  const d = D[level];
  // Two notes in one beat; the second arrives by a slide (connector) or after columns a variant removed.
  const a = ev({ "2": 5 }, {}, { durationHint: d });
  const b = ev({ "2": 7 }, kind === "connector" ? { "2": ["slide_up"] } : {}, { durationHint: d });
  const events: EventRow[] = [a, b];
  const marks: StaffMarks | null =
    kind === "removal"
      ? { columns: new Map(), removals: new Map([[`${b.id}-0`, 2]]), removedAtEnd: 0, line: "", any: true, parentLabel: "A" }
      : null;
  const c = render(
    <TabStaff
      events={events}
      tuning={bass5}
      showRhythm
      wrap={wrap}
      reading={marks ? { view: "frets", partEvents: events, marks } : undefined}
    />,
  ).container;
  const testid = kind === "connector" ? "tab-connector" : "tab-removal";
  const gap = c.querySelector(`[data-testid="${testid}"]`);
  const cells = [...c.querySelectorAll('[data-testid="tab-rhythm"]')];
  return {
    gap,
    arriving: Number(cells[1]?.getAttribute("data-beams-left")),
    departing: Number(cells[0]?.getAttribute("data-beams-right")),
    spacerBeams: gap ? gap.querySelectorAll('.tab-rhythm [data-part="beam"]').length : -1,
  };
}

describe("INV-006: a beam runs unbroken through every kind of gap", () => {
  for (const kind of ["connector", "removal"] as const)
    for (const wrap of [false, true])
      for (const level of [1, 2, 3] as const)
        it(`${kind} gap, ${wrap ? "wrapped" : "single line"}, ${level} level(s)`, () => {
          const got = staff(kind, level, wrap);
          expect(got.gap, "the gap is drawn").not.toBeNull();
          expect(got.departing).toBe(level);
          expect(got.arriving).toBe(level);
          expect(got.spacerBeams, `${kind} gap spacer beams`).toBe(level);
        });
});
