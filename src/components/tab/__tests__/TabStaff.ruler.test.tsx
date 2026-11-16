// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { barline, bass5, ev } from "@/lib/tab/__tests__/helpers";
import { TabStaff } from "../TabStaff";

const A = 2;
const events = [ev({ [A]: 5 }), ev({ [A]: 7 }), barline(), ev({ [A]: 3 })];

/** Every column's width style, in document order. */
function columnWidths(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.querySelectorAll<HTMLElement>(".tab-bar-run > [data-column], .tab-bar-run > *")]
    .map((el) => el.style.minWidth)
    .filter((w) => w.startsWith("calc("));
}

// INV-019 (unit half): the ruler is the sum of the very terms the columns are sized from.
describe("TabStaff ruler", () => {
  it("is not drawn without the prop", () => {
    const html = renderToStaticMarkup(<TabStaff wrap events={events} tuning={bass5} />);
    expect(html).not.toContain("tab-ruler");
  });

  it("is not drawn unwrapped, even with the prop", () => {
    const html = renderToStaticMarkup(<TabStaff ruler events={events} tuning={bass5} />);
    expect(html).not.toContain("tab-ruler");
  });

  it("sums the same width terms the columns use, plus the gutter", () => {
    const html = renderToStaticMarkup(<TabStaff wrap ruler events={events} tuning={bass5} />);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const ruler = doc.querySelector<HTMLElement>('[data-testid="tab-ruler"]');
    expect(ruler).not.toBeNull();
    expect(ruler!.getAttribute("aria-hidden")).toBe("true");
    expect(ruler!.parentElement!.classList.contains("tab-staff-wrapped")).toBe(true);
    const width = ruler!.style.width;
    expect(width.startsWith("calc(")).toBe(true);
    expect(width.endsWith("var(--gutter))")).toBe(true);
    const widths = columnWidths(html);
    expect(widths.length).toBeGreaterThan(0);
    for (const w of widths) {
      const terms = w.slice("calc(".length, -1);
      expect(width).toContain(terms);
    }
  });
});
