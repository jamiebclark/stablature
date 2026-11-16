import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WIDE_QUERY } from "../wide";

// INV-016: the layout switches at one width, and CSS and JS cannot disagree about it.
describe("the wide threshold", () => {
  it("is the same condition in globals.css and in WIDE_QUERY", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const match = /@custom-variant\s+wide\s*\(\s*@media\s+(\([^)]*\))\s*\)\s*;/.exec(css);
    expect(match, "globals.css declares @custom-variant wide").not.toBeNull();
    expect(match![1]).toBe(WIDE_QUERY);
  });

  it("is 768px and does not look at the pointer", () => {
    expect(WIDE_QUERY).toBe("(min-width: 768px)");
  });

  it("has no other width media query in any syntax", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const conditions = [...css.matchAll(/@media\s+([^{;]*)\{/g)].map((m) => m[1].trim());
    const widths = conditions.filter((c) => /width/.test(c));
    expect(widths.length).toBeGreaterThan(0);
    for (const w of widths) expect(w).toBe(WIDE_QUERY);
  });
});
