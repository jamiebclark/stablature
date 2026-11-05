/**
 * Did adopting a probe weaken it? Prints every line of a probe that has no equal line in the suite file it was
 * added to, and every assertion in the suite's copy that the probe does not have. Lines are compared trimmed, so
 * indentation does not count. A review tool: reading what it prints is the check, and an empty list proves only
 * that no line was lost.
 *
 *   node specs/006-reading-aids/review-probes/adopted-against-probe.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");
const probes = "specs/006-reading-aids/review-probes";
const ADOPTED = [
  ["INV-002-the-reader-reads-the-export.spec.ts", "e2e/reading-view.spec.ts"],
  ["INV-005-a-tab-left-on-frets.spec.ts", "e2e/reading-view.spec.ts"],
  ["INV-015-031-every-write-every-route.spec.ts", "e2e/reading-sync.spec.ts"],
  ["INV-003-signed-in-play-view.spec.ts", "e2e/reading-sync.spec.ts"],
  ["INV-034-print-tokens.spec.ts", "e2e/variant-marks-paint.spec.ts"],
  ["INV-015-one-read-one-snapshot.test.ts", "src/lib/reading/__tests__/snapshot.test.ts"],
  ["INV-019-020-022-023-024-t073-results-unchanged.test.ts", "src/lib/reading/__tests__/compare-oracle.test.ts"],
];
const lines = (file) =>
  readFileSync(path.join(root, file), "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("import ") && !l.startsWith("//") && !l.startsWith("*") && !l.startsWith("/*"));

for (const [probe, target] of ADOPTED) {
  const inSuite = new Set(lines(target));
  const lost = lines(path.join(probes, probe)).filter((l) => !inSuite.has(l));
  console.log(`\n=== ${probe} -> ${target}: ${lost.length} line(s) not found`);
  for (const line of lost) console.log(`  - ${line.slice(0, 150)}`);
}
