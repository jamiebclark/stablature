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
