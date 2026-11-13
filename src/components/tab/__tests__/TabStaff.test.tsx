// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { barline, bass5, ev } from "@/lib/tab/__tests__/helpers";
import { TabStaff } from "../TabStaff";

const A = 2; // the A string on a 5-string bass

function draw(events: ReturnType<typeof ev>[]) {
  const { container } = render(<TabStaff events={events} tuning={bass5} />);
  return container;
}

describe("TabStaff connectors", () => {
  it("draws a gap only where a connector exists", () => {
    const plain = draw([ev({ [A]: 5 }), ev({ [A]: 7 }), barline(), ev({ [A]: 3 })]);
    expect(plain.querySelectorAll('[data-testid="tab-connector"]')).toHaveLength(0);

    const joined = draw([
      ev({ [A]: 5 }),
      ev({ [A]: 7 }, { [A]: ["hammer_on"] }),
      ev({ [A]: 5 }),
    ]);
    expect(joined.querySelectorAll('[data-testid="tab-connector"]')).toHaveLength(1);
    expect(joined.querySelectorAll('[data-testid="tab-column"]')).toHaveLength(3);
  });

  it("marks the connector aria-hidden and leaves it out of the tab order", () => {
    const c = draw([ev({ [A]: 5 }), ev({ [A]: 7 }, { [A]: ["slide_up"] })]);
    const gap = c.querySelector('[data-testid="tab-connector"]')!;
    expect(gap.getAttribute("aria-hidden")).toBe("true");
    expect(gap.matches("button, [role], [tabindex]")).toBe(false);
    expect(gap.textContent).toBe("/");
  });

  it("works out no glyph itself: it never imports techniques or reads .techniques", () => {
    const src = readFileSync(path.join(__dirname, "..", "TabStaff.tsx"), "utf-8");
    expect(src).not.toMatch(/lib\/tab\/techniques|\.techniques\b/);
  });
});

describe("TabStaff reading sizes (007)", () => {
  const chorded = () => {
    const chordEvent = ev({ [A]: 3 });
    const { container } = render(
      <TabStaff
        events={[chordEvent, ev({ [A]: 5 })]}
        tuning={bass5}
        annotations={[
          { id: "c1", kind: "chord", anchorEventId: chordEvent.id, value: "F#m7b5" } as never,
        ]}
        showRhythm
        barNumbers={{ offset: 4 }}
      />,
    );
    return container;
  };

  it("never truncates a chord symbol, and widens its column instead of using a literal", () => {
    const c = chorded();
    const chord = [...c.querySelectorAll("div")].find((d) => d.textContent === "F#m7b5" && d.className.includes("text-accent"));
    expect(chord?.className).not.toMatch(/truncate/);
    expect(chord?.className).toMatch(/whitespace-nowrap/);
    const first = c.querySelector<HTMLElement>('[data-testid="tab-column"]')!;
    expect(first.style.width).toContain("--chord-ch");
    expect(first.style.width).not.toContain("0.6rem");
    expect(first.getAttribute("data-column")).toBeTruthy();
  });

  it("draws a 12px bar number offset by the pass, only on the column that opens a bar", () => {
    const numbers = chorded().querySelectorAll('[data-testid="tab-bar-number"]');
    expect(numbers).toHaveLength(1);
    expect(numbers[0].textContent).toBe("5");
    expect(numbers[0].className).toMatch(/text-\[12px\]/);
  });

  it("draws a stem 1px wide, beams 2px and flags 2px, with the numeral still 12px", () => {
    const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/\[data-part="stem"\][^}]*width: 1px/);
    expect(css).toMatch(/--rhythm-beam: 2px/);
    expect(css).toMatch(/\[data-part="flag"\][^}]*stroke-width: 2px/);
    const c = render(<TabStaff events={[ev({ [A]: 3 }, {}, { durationHint: "8" })]} tuning={bass5} showRhythm />).container;
    const cell = c.querySelector('[data-testid="tab-rhythm"]');
    expect(cell?.getAttribute("data-duration")).toBe("8");
    expect(cell?.querySelector('[data-part="stem"]')).not.toBeNull();
    expect(cell?.querySelector('[data-part="flag"]')).not.toBeNull();
    expect(c.querySelector(".tab-cell span")?.className ?? "").not.toMatch(/text-\[(?!12px)/);
  });
});
