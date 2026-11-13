// @vitest-environment jsdom
/**
 * Review probe, INV-004 and FR-014, through `render(TabStaff)`: for every Grp shape × {rhythm, no rhythm} ×
 * {expanded, compact} × {single line, wrapped}, each counted group's number is drawn exactly once and a plain
 * group's never; each `tab-bracket` sits inside `tab-rhythm` iff the staff has `data-rhythm`; a staff with rhythm
 * draws no bracket row above the cells; and every column of a group carries a bracket in either placement.
 * Also INV-013's markup half: every rhythm part is inside an `aria-hidden` element.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EventRow } from "@/lib/model";
import { barline, bass5, ev } from "@/lib/tab/__tests__/helpers";
import { TabStaff } from "@/components/tab/TabStaff";

type Shape = { name: string; make: (d: (x: string) => string | null) => EventRow[]; counted: string[]; plain: string[] };

const col = (d: string | null, over: Partial<EventRow> = {}) => ev({ "2": 5 }, {}, { durationHint: d as never, ...over });
const g = (id: string, count: number | null, d: string | null, over: Partial<EventRow> = {}) =>
  col(d, { tupletId: id, tupletCount: count, groupKind: count === null ? "plain" : "tuplet", ...over });

const SHAPES: Shape[] = [
  { name: "counted that reads", make: (d) => [g("t", 3, d("8")), g("t", 3, d("8")), g("t", 3, d("8")), col(d("q"))], counted: ["t"], plain: [] },
  { name: "counted still being built", make: (d) => [g("t", 3, d("8")), g("t", 3, d("8"))], counted: ["t"], plain: [] },
  { name: "counted with a repeat", make: (d) => [g("t", 3, d("8"), { repeat: 2 }), g("t", 3, d("8")), g("t", 3, d("8"))], counted: ["t"], plain: [] },
  { name: "plain", make: (d) => [g("p", null, d("16")), g("p", null, d("16")), g("p", null, d("16"))], counted: [], plain: ["p"] },
  { name: "plain with a repeat", make: (d) => [g("p", null, d("16"), { repeat: 4 }), g("p", null, d("8")), g("p", null, d("8"))], counted: [], plain: ["p"] },
  { name: "group next to a barline", make: (d) => [col(d("8")), g("t", 3, d("8")), g("t", 3, d("8")), g("t", 3, d("8")), barline(), col(d("8")), col(d("8"))], counted: ["t"], plain: [] },
  { name: "two adjacent groups", make: (d) => [g("a", 3, d("8")), g("a", 3, d("8")), g("a", 3, d("8")), g("b", 5, d("16")), g("b", 5, d("16")), g("b", 5, d("16")), g("b", 5, d("16")), g("b", 5, d("16"))], counted: ["a", "b"], plain: [] },
  { name: "legacy group across a barline", make: (d) => [g("t", 3, d("8")), g("t", 3, d("8")), barline(), g("t", 3, d("8"))], counted: ["t"], plain: [] },
  { name: "a rest inside a counted group", make: (d) => [g("t", 3, d("8")), g("t", 3, d("8"), { kind: "rest", frets: {} }), g("t", 3, d("8"))], counted: ["t"], plain: [] },
];

describe("INV-004 over every Grp shape", () => {
  for (const shape of SHAPES)
    for (const withRhythm of [true, false])
      for (const density of ["expanded", "compact"] as const)
        for (const wrap of [false, true])
          it(`${shape.name}, ${withRhythm ? "rhythm" : "no rhythm"}, ${density}, ${wrap ? "wrapped" : "single"}`, () => {
            const events = shape.make((x) => (withRhythm ? x : null));
            const c = render(<TabStaff events={events} tuning={bass5} showRhythm density={density} wrap={wrap} />).container;
            const staff = c.querySelector('[data-testid="tab-staff"]')!;
            expect(staff.hasAttribute("data-rhythm")).toBe(withRhythm);

            // One number per counted group, none for plain: read each label's column back to its group.
            const labels = [...c.querySelectorAll(".tab-bracket-label")];
            expect(labels.map((l) => l.textContent).sort()).toEqual(
              shape.counted.map((id) => String(events.find((e) => e.tupletId === id)!.tupletCount)).sort(),
            );

            // Every column of a group has a bracket; placement follows the staff.
            const columns = [...c.querySelectorAll('[data-testid="tab-column"]')];
            const inGroup = columns.filter((el) => el.querySelector('[data-testid="tab-bracket"]'));
            const groupColumns = density === "compact"
              ? events.filter((e) => e.tupletId).length
              : events.filter((e) => e.tupletId).reduce((n, e) => n + Math.max(1, e.repeat), 0);
            expect(inGroup.length).toBe(groupColumns);
            for (const b of c.querySelectorAll('[data-testid="tab-bracket"]'))
              expect(!!b.closest(".tab-rhythm"), "bracket placement").toBe(withRhythm);
            if (withRhythm)
              for (const el of columns) expect((el.firstElementChild as HTMLElement).className).not.toContain("staff-row");

            // INV-013 (markup): every rhythm part is hidden from assistive technology.
            for (const part of c.querySelectorAll(".tab-rhythm, [data-part]"))
              expect(part.closest('[aria-hidden="true"]'), "rhythm part hidden").not.toBeNull();
          });
});
