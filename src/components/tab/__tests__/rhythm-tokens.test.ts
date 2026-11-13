// @vitest-environment jsdom
/**
 * FR-020: the rhythm row is at most twice the old bracket row (`--staff-row`) on both pointers, so the
 * capture band's height budget holds. Reads the stylesheet text, since jsdom resolves no custom properties.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** Body of the first block that opens with `selector {` and contains `needle`. */
function block(opener: RegExp, needle: string): string {
  const re = new RegExp(opener.source + "[^{]*\\{([^}]*)\\}", "g");
  for (const m of css.matchAll(re)) if (m[1].includes(needle)) return m[1];
  throw new Error(`no block with ${needle}`);
}

const rem = (body: string, name: string): number | null => {
  const m = new RegExp(`${name}:\\s*([\\d.]+)rem`).exec(body);
  return m ? Number(m[1]) : null;
};

describe("rhythm tokens", () => {
  const touch = block(/:root/, "--rhythm-row");
  const fine = css.slice(css.indexOf("@media (pointer: fine)"));
  const fineBody = /:root\s*\{([^}]*)\}/.exec(fine)![1];

  it("defines the tokens in both blocks", () => {
    for (const t of ["--rhythm-row", "--rhythm-lead", "--rhythm-stem", "--rhythm-beam", "--rhythm-beam-gap", "--rhythm-stub"]) {
      expect(touch).toContain(t);
    }
    expect(fineBody).toContain("--rhythm-row");
    expect(fineBody).toContain("--rhythm-stem");
  });

  it("holds the 2x bound on touch", () => {
    expect(rem(touch, "--rhythm-row")!).toBeLessThanOrEqual(2 * rem(touch, "--staff-row")!);
  });

  it("holds the 2x bound on fine", () => {
    expect(rem(fineBody, "--rhythm-row")!).toBeLessThanOrEqual(2 * rem(fineBody, "--staff-row")!);
  });

  it("draws parts in solid currentColor, never opacity or color-mix", () => {
    const rules = css.slice(css.indexOf(".tab-rhythm {"), css.indexOf(".tab-column-selected .tab-bracket {"));
    expect(rules).toContain("currentColor");
    expect(rules).not.toMatch(/opacity|color-mix/);
  });
});
