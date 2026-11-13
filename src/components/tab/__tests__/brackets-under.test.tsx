// @vitest-environment jsdom
/** INV-004: with rhythm a group's bracket and number sit in the rhythm row, once per group; without it, above as ever. */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { barline, bass5, ev } from "@/lib/tab/__tests__/helpers";
import { TabStaff } from "../TabStaff";

const A = 2;
const g = (id: string, count: number | null, d: string | null) =>
  ev({ [A]: 5 }, {}, {
    tupletId: id,
    tupletCount: count,
    groupKind: count === null ? "plain" : "tuplet",
    durationHint: d,
  } as never);

function events(withRhythm: boolean) {
  const d = (x: string) => (withRhythm ? x : null);
  return [
    g("t", 3, d("8")),
    g("t", 3, d("8")),
    g("t", 3, d("8")),
    barline(),
    g("p", null, d("q")),
    g("p", null, d("q")),
    g("f", 5, d("16")),
    g("f", 5, d("16")),
    g("f", 5, d("16")),
    g("f", 5, d("16")),
  ];
}

const draw = (withRhythm: boolean) =>
  render(<TabStaff events={events(withRhythm)} tuning={bass5} showRhythm />).container;

describe("brackets under the tab (INV-004)", () => {
  it("with rhythm: brackets are inside tab-rhythm, one number per counted group, no row above", () => {
    const c = draw(true);
    expect(c.querySelector('[data-testid="tab-staff"]')?.hasAttribute("data-rhythm")).toBe(true);
    const brackets = c.querySelectorAll('[data-testid="tab-bracket"]');
    expect(brackets.length).toBe(9);
    for (const b of brackets) expect(b.closest(".tab-rhythm")).not.toBeNull();
    const labels = [...c.querySelectorAll(".tab-bracket-label")].map((l) => l.textContent);
    expect(labels).toEqual(["3", "5"]);
    // No column carries a row above its cells.
    for (const col of c.querySelectorAll('[data-testid="tab-column"]')) {
      const first = col.firstElementChild as HTMLElement;
      expect(first.className).not.toContain("staff-row");
    }
  });

  it("without rhythm: brackets stay above, outside any rhythm cell", () => {
    const c = draw(false);
    expect(c.querySelector('[data-testid="tab-staff"]')?.hasAttribute("data-rhythm")).toBe(false);
    expect(c.querySelectorAll('[data-testid="tab-bracket"]').length).toBe(9);
    expect(c.querySelectorAll(".tab-rhythm").length).toBe(0);
    expect([...c.querySelectorAll(".tab-bracket-label")].map((l) => l.textContent)).toEqual(["3", "5"]);
  });
});
