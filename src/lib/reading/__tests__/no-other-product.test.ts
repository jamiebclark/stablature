/**
 * INV-044 / FR-062: the app does not name, copy or imitate another product, and no fixture holds tab
 * content from one. Greps every file under `src/` and `e2e/` for the names of the tab products people
 * compare this to. `specs/007-usability-pass/audit/` is not bundled and is not scanned. This test names
 * the products, so it skips itself. It passes on the pre-change tree by design (it guards drift); the
 * proof it can fail is a throwaway string holding a name, which the scan reports.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const NAMES = /songsterr|ultimate[ -]?guitar|guitar[ -]?pro\b|soundslice|tux[ -]?guitar|muse[ -]?score|yousician|guitar[ -]?tabs?\.cc|911tabs|e-chords|echords/i;
const SELF = "no-other-product.test.ts";
const SKIP_DIRS = new Set(["node_modules", ".next", "audit", "test-results"]);
const TEXT = /\.(tsx?|mts|mjs|json|css|md|txt|html|webmanifest)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (TEXT.test(name) && name !== SELF) out.push(full);
  }
  return out;
}

export const offenders = (files: string[], read: (f: string) => string = (f) => readFileSync(f, "utf8")) =>
  files.filter((f) => NAMES.test(read(f)));

describe("no other product is named (INV-044)", () => {
  it("scans a real set of files", () => {
    expect(walk("src").length + walk("e2e").length).toBeGreaterThan(50);
  });

  it("finds no product name in src/ or e2e/", () => {
    expect(offenders([...walk("src"), ...walk("e2e")])).toEqual([]);
  });

  it("would notice one", () => {
    expect(offenders(["x"], () => 'label: "Open in Songsterr"')).toEqual(["x"]);
  });
});
