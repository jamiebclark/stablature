// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BracketGlyph } from "..";

/** The markup `TripletGlyph` drew before it was replaced (INV-019). */
const TRIPLET_LITERAL =
  '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true" focusable="false"><path data-rail="true" d="M1.5 12V8.5h3.6"></path><path data-rail="true" d="M10.9 8.5h3.6V12"></path><text x="8" y="11.4" font-size="10" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none">3</text></svg>';

describe("BracketGlyph", () => {
  it("numeral 3 keeps today's rails and text attributes", () => {
    const html = renderToStaticMarkup(<BracketGlyph numeral={3} />);
    expect(html).toContain('d="M1.5 12V8.5h3.6"');
    expect(html).toContain('d="M10.9 8.5h3.6V12"');
    expect(html).toContain('font-size="10" font-weight="700" text-anchor="middle"');
    expect(html).toBe(TRIPLET_LITERAL);
  });
  it("no numeral is one closed path and no text", () => {
    const html = renderToStaticMarkup(<BracketGlyph />);
    expect(html.match(/<path/g)).toHaveLength(1);
    expect(html).not.toContain("<text");
  });
  it("two digits shrink and squeeze", () => {
    const html = renderToStaticMarkup(<BracketGlyph numeral={12} />);
    expect(html).toContain('font-size="8"');
    expect(html).toContain('textLength="9.2"');
  });
});
