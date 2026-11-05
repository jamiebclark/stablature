// @vitest-environment jsdom
/** The insertion caret stays after the same column in every view, including with a carried `(Am)` label. */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TabStaff } from "@/components/tab/TabStaff";
import type { AnnotationRow } from "@/lib/model";
import { barline, bass5, ev } from "@/lib/tab/__tests__/helpers";

const A = 2;
const events = [ev({ [A]: 12 }), ev({ [A]: 7 }), barline(), ev({ [A]: 3 })];
const annotations = [{ kind: "chord", anchorEventId: events[0].id, value: "Am" }] as AnnotationRow[];

/** Test ids, in document order, of the staff's columns and its caret. */
function order(view: "frets" | "notes" | "intervals", slice = events) {
  const { container } = render(
    <TabStaff
      events={slice}
      tuning={bass5}
      annotations={annotations}
      insertAfterEventId={events[1].id}
      reading={{ view, partEvents: events }}
    />,
  );
  return [...container.querySelectorAll('[data-testid="tab-column"], [data-testid="tab-caret"]')].map(
    (el) => el.getAttribute("data-testid"),
  );
}

describe("the caret in each view", () => {
  it("sits after the same column", () => {
    const frets = order("frets");
    expect(frets).toContain("tab-caret");
    expect(order("notes")).toEqual(frets);
    expect(order("intervals")).toEqual(frets);
  });

  it("is unmoved when the slice opens with a carried chord", () => {
    const { container } = render(
      <TabStaff
        events={events.slice(1)}
        tuning={bass5}
        annotations={annotations}
        insertAfterEventId={events[1].id}
        reading={{ view: "intervals", partEvents: events }}
      />,
    );
    const kinds = [...container.querySelectorAll('[data-testid="tab-column"], [data-testid="tab-caret"]')].map((e) =>
      e.getAttribute("data-testid"),
    );
    expect(kinds[0]).toBe("tab-column");
    expect(kinds[1]).toBe("tab-caret");
    expect(container.textContent).toContain("(Am)");
  });
});
