#!/usr/bin/env bash
# INV-016 (review round 2): does `src/lib/reading/__tests__/wide-threshold.test.ts` fail when a width media condition in
# globals.css is written the way contracts/reading-cards.md §1 still prescribes it, `@media (width >= 48rem)`?
# Copies globals.css, rewrites the grid's condition on the copy, and runs the test's own regex against both forms.
# Exit 0 = the test would catch every form; exit 1 = some form slips past (prints which). Touches no tracked file.
#   bash specs/010-wide-reading-layout/review-probes/INV-016-threshold-test-sees-range-syntax.probe.sh < /dev/null
set -u
cd "$(git rev-parse --show-toplevel)" || exit 2
node - <<'JS'
const fs = require("fs");
const css = fs.readFileSync("src/app/globals.css", "utf8");
const WIDE = "(min-width: 768px)";
// The test's two regexes, copied from wide-threshold.test.ts.
const variant = /@custom-variant\s+wide\s*\(\s*@media\s+(\([^)]*\))\s*\)\s*;/;
const widths = /@media\s+([^{;]*)\{/g;
const catches = (text) => {
  const v = variant.exec(text);
  if (!v || v[1] !== WIDE) return true;
  const all = [...text.matchAll(widths)].map((m) => m[1].trim()).filter((c) => /width/.test(c));
  return all.length === 0 || all.some((w) => w !== WIDE);
};
const forms = {
  "as is": css,
  "grid as (min-width: 48rem)": css.replace("@media (min-width: 768px) {\n  .reading-cards", "@media (min-width: 48rem) {\n  .reading-cards"),
  "grid as (width >= 48rem) (contract §1)": css.replace("@media (min-width: 768px) {\n  .reading-cards", "@media (width >= 48rem) {\n  .reading-cards"),
  "grid as screen and (min-width: 48rem)": css.replace("@media (min-width: 768px) {\n  .reading-cards", "@media screen and (min-width: 48rem) {\n  .reading-cards"),
};
let bad = 0;
for (const [name, text] of Object.entries(forms)) {
  if (name !== "as is" && text === css) { console.log(`${name}: could not rewrite`); bad = 1; continue; }
  const caught = catches(text);
  const want = name !== "as is";
  console.log(`${name}: test ${caught ? "FAILS (caught)" : "passes"}${caught === want ? "" : "   <-- slips past"}`);
  if (caught !== want) bad = 1;
}
process.exit(bad);
JS
