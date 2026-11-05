import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { barline, bass5, ev } from "@/lib/tab/__tests__/helpers";
import { TabStaff } from "../TabStaff";

const A = 2;

function html(events: ReturnType<typeof ev>[], showRhythm: boolean) {
  return renderToStaticMarkup(<TabStaff events={events} tuning={bass5} showRhythm={showRhythm} />);
}

describe("TabStaff showRhythm", () => {
  it("draws nothing extra when no column has a duration", () => {
    const events = [ev({ [A]: 5 }), barline(), ev({ [A]: 7 })];
    expect(html(events, true)).toBe(html(events, false));
    expect(html(events, true)).not.toContain("tab-rhythm");
  });

  it("draws one row with a mark per set column and nothing for unset or barlines", () => {
    const events = [
      ev({ [A]: 5 }, {}, { durationHint: "8" }),
      ev({ [A]: 7 }),
      barline(),
      ev({ [A]: 3 }, {}, { durationHint: "q" }),
    ];
    const out = html(events, true);
    expect(out.match(/data-testid="tab-rhythm"/g)).toHaveLength(4);
    const marks = [...out.matchAll(/data-testid="tab-rhythm"[^>]*>([^<]*)</g)].map((m) => m[1]);
    expect(marks).toEqual(["8", "", "", "q"]);
    expect(html(events, false)).not.toContain("tab-rhythm");
  });
});
