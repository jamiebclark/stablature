// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { barline, bass5, ev } from "@/lib/tab/__tests__/helpers";
import { TabStaff } from "../TabStaff";

const A = 2;
const events = [ev({ [A]: 5 }), barline(), ev({ [A]: 3 })];

describe("TabStaff wrapped, as capture draws it", () => {
  it("draws the start caret at the head of the first run", () => {
    const { container } = render(
      <TabStaff wrap events={events} tuning={bass5} insertAfterEventId={null} />,
    );
    const first = container.querySelector(".tab-bar-run");
    expect(first?.firstElementChild?.getAttribute("data-testid")).toBe("tab-caret");
    expect(container.querySelectorAll('[data-testid="tab-caret"]')).toHaveLength(1);
  });

  it("draws the caret with no advance, so it cannot move a line break", () => {
    const { container } = render(
      <TabStaff wrap events={events} tuning={bass5} insertAfterEventId={events[0].id} />,
    );
    const caret = container.querySelector('[data-testid="tab-caret"]');
    expect(caret?.className).toContain("w-0 ");
    expect(caret?.className).not.toContain("w-0.5");
    expect(caret?.querySelector(".absolute")).not.toBeNull();
  });

  it("draws the one-line caret as before", () => {
    const { container } = render(
      <TabStaff events={events} tuning={bass5} insertAfterEventId={events[0].id} />,
    );
    expect(container.querySelector('[data-testid="tab-caret"]')?.className).toContain("w-0.5");
  });

  it("draws no caret when none is asked for", () => {
    const { container } = render(<TabStaff wrap events={events} tuning={bass5} />);
    expect(container.querySelector('[data-testid="tab-caret"]')).toBeNull();
  });

  it("follows the tail on the last run", () => {
    const { container } = render(
      <TabStaff wrap followTail events={events} tuning={bass5} />,
    );
    expect(container.querySelectorAll(".tab-bar-run").length).toBeGreaterThan(0);
  });
});
