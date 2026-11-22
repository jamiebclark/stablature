#!/usr/bin/env bash
# INV-016: no earlier requirement is left saying something untrue, and no pin moves in silence.
# (1) spec 010 FR-005, FR-006, SC-003 and contracts/reading-cards.md §1, §4, §5 carry "Amended by spec 013";
# (2) docs/DECISIONS.md has "013 — decisions" and "013 — re-pinned tests";
# (3) each re-pin row of plan.md's table still has its "// re-pinned by spec 013" marker in e2e/wide-order.spec.ts.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
status=0
plan=specs/013-cards-per-row/plan.md
dec=docs/DECISIONS.md
s10=specs/010-wide-reading-layout/spec.md
c10=specs/010-wide-reading-layout/contracts/reading-cards.md
wo=e2e/wide-order.spec.ts
fail() { printf 'MISSING %s\n' "$1"; status=1; }

for r in FR-005 FR-006 SC-003; do
  grep -E "^- \*\*$r\*\*" "$s10" | grep -q "Amended by spec 013" || fail "$r in $s10 carries 'Amended by spec 013'"
done
for n in 1 4 5; do
  awk -v n="$n" '$0 ~ "^#+ *(§ ?)?"n"[.) ]" {f=1; next} /^#+ /{f=0} f' "$c10" | grep -q "Amended by spec 013" \
    || fail "§$n in $c10 carries 'Amended by spec 013'"
done
grep -q '^## 013 — decisions' "$dec" || fail "'013 — decisions' in $dec"
grep -q '^## 013 — re-pinned tests' "$dec" || fail "'013 — re-pinned tests' in $dec"

# plan rows whose file is wide-order.spec.ts: one marker per row
rows="$(awk '/^### Existing tests this changes on purpose/{f=1;next} /^### /{f=0} f && /^\|/ && !/^\|---/ && !/^\| File/ && /wide-order\.spec\.ts|^\| same/' "$plan" | wc -l)"
marks="$(grep -c '// re-pinned by spec 013' "$wo" 2>/dev/null || true)"
[ "${marks:-0}" -ge "$rows" ] || fail "$wo has $marks '// re-pinned by spec 013' markers; plan.md lists $rows rows"
# T037: the wide-print re-pin keeps its marker
grep -q '// re-pinned by spec 013' e2e/wide-print.spec.ts 2>/dev/null || fail "e2e/wide-print.spec.ts has no '// re-pinned by spec 013' marker"
[ $status -eq 0 ] && echo "cards amendments: ok"
exit $status
