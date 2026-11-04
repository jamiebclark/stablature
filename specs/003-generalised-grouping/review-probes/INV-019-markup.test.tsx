// @vitest-environment jsdom
/**
 * INV-019, markup half, against what main actually shipped rather than a literal typed into the
 * test. The suite's TRIPLET_LITERAL (src/components/icons/__tests__/BracketGlyph.test.tsx:7) is
 * labelled "the markup TripletGlyph drew" but already holds the split paths and `data-rail`.
 *
 * Main's single path `M1.5 12V8.5h3.6M10.9 8.5h3.6V12` is two subpaths, so the same strokes.
 * contracts/components.md asks for the split and the plan's INV-019 asks for an equal string, and
 * both cannot hold, so this pins what matters: same strokes, same text. INV-019-glyph.spec.ts then
 * compares the pixels.
 */
import { execFileSync } from "node:child_process";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BracketGlyph } from "@/components/icons";

const main = execFileSync("git", ["show", "HEAD:src/components/icons/index.tsx"], {
  encoding: "utf8",
});

describe("INV-019 markup", () => {
  const html = renderToStaticMarkup(<BracketGlyph numeral={3} />);
  it("main's path is the two rails, in order", () => {
    const [, d] = main.match(/TripletGlyph[\s\S]*?<path d="([^"]+)"/)!;
    const rails = [...html.matchAll(/<path data-rail="true" d="([^"]+)"/g)].map((m) => m[1]);
    expect(rails.join("")).toBe(d);
  });
  it("text attributes match main's", () => {
    expect(html).toContain(
      'x="8" y="11.4" font-size="10" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none">3<',
    );
    for (const attr of ['x="8"', 'y="11.4"', 'fontSize="10"', 'fontWeight="700"']) {
      expect(main).toContain(attr);
    }
  });
  it("the empty form has one path and no text; every other numeral has two rails and text", () => {
    const empty = renderToStaticMarkup(<BracketGlyph />);
    expect(empty.match(/<path/g)).toHaveLength(1);
    expect(empty).not.toContain("<text");
    for (let n = 2; n <= 16; n++) {
      const out = renderToStaticMarkup(<BracketGlyph numeral={n} />);
      expect(out.match(/data-rail/g)).toHaveLength(2);
      expect(out).toContain(`>${n}</text>`);
    }
  });
});
