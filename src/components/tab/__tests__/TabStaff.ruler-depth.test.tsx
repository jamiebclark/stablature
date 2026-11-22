// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { barline, bass5, ev } from "@/lib/tab/__tests__/helpers";
import type { EventRow } from "@/lib/model";
import type { StaffMarks } from "@/lib/reading/marks";
import { STAFF_VIEWS } from "@/lib/reading/view";
import { TabStaff } from "../TabStaff";

const A = 2;
const bar = (): EventRow[] => [ev({ [A]: 5 }), ev({ [A]: 7 }), barline()];
const bars = (count: number): EventRow[] => Array.from({ length: count }, bar).flat();

/** The deepest operand count of any parenthesis level (calc, max, nested groups) in a CSS width. */
function widestLevel(css: string): number {
  let widest = 0;
  const counts: number[] = [1];
  let depth = 0;
  for (const ch of css) {
    if (ch === "(") {
      depth += 1;
      counts[depth] = 1;
    } else if (ch === ")") {
      widest = Math.max(widest, counts[depth] ?? 0);
      depth -= 1;
    } else if (ch === "+" && depth >= 0) {
      counts[depth] = (counts[depth] ?? 1) + 1;
    }
  }
  return Math.max(widest, counts[0] ?? 0);
}

function render(events: EventRow[], view: (typeof STAFF_VIEWS)[number], extra: { chords?: boolean; marks?: StaffMarks } = {}) {
  const annotations = extra.chords
    ? events.filter((e) => e.kind === "notes").map((e, i) => ({ id: `c${i}`, kind: "chord", anchorEventId: e.id, value: "F#m7b5" }) as never)
    : [];
  const html = renderToStaticMarkup(
    <TabStaff
      wrap
      ruler
      events={events}
      tuning={bass5}
      annotations={annotations}
      reading={{ view, partEvents: events, marks: extra.marks ?? null }}
    />,
  );
  const doc = new DOMParser().parseFromString(html, "text/html");
  const ruler = doc.querySelector<HTMLElement>('[data-testid="tab-ruler"]')!;
  const columns = [...doc.querySelectorAll<HTMLElement>(".tab-bar-run > *")].map((el) => el.style.minWidth).filter((w) => w.startsWith("calc("));
  return { width: ruler.style.width, columns };
}

// INV-008 (unit half): a flat sum past ~100 operands reads as 0 in Chromium, so no level may be wide.
describe("TabStaff ruler depth", () => {
  const sizes = [1, 4, 8, 10, 12, 16, 32, 64];
  const cases: [string, EventRow[], { chords?: boolean }][] = [
    ...sizes.map((count): [string, EventRow[], { chords?: boolean }] => [`${count} bars`, bars(count), {}]),
    ["one 64-column bar", Array.from({ length: 64 }, () => ev({ [A]: 5 })), {}],
    ["60 chord columns", Array.from({ length: 60 }, () => ev({ [A]: 5 })), { chords: true }],
  ];
  for (const view of STAFF_VIEWS) {
    for (const [name, events, extra] of cases) {
      it(`${name} (${view}): at most 16 operands a level, every term verbatim`, () => {
        const { width, columns } = render(events, view, extra);
        expect(width.startsWith("calc(")).toBe(true);
        expect(width.endsWith("var(--gutter))")).toBe(true);
        expect(widestLevel(width)).toBeLessThanOrEqual(16);
        for (const w of columns) {
          const terms = w.slice("calc(".length, -1).replace(/(\d+)ch/g, "$1 * var(--staff-ch)");
          expect(width).toContain(terms);
        }
      });
    }
  }

  it("an empty part's ruler has no empty operand", () => {
    for (const view of STAFF_VIEWS) {
      const { width } = render([], view);
      expect(width, view).not.toMatch(/calc\(\s*\+|\(\s*\+|\+\s*\+|\+\s*\)/);
      expect(width.endsWith("var(--gutter))"), view).toBe(true);
    }
  });

  it("a removal gap variant stays shallow", () => {
    const events = bars(40);
    const marks = {
      columns: new Map(),
      removals: new Map(events.filter((e) => e.kind === "notes").map((e) => [`${e.id}-0`, 1] as [string, number])),
      removedAtEnd: 1,
      line: "",
      any: true,
      parentLabel: "P",
    } as StaffMarks;
    const { width } = render(events, "frets", { marks });
    expect(widestLevel(width)).toBeLessThanOrEqual(16);
  });
});
