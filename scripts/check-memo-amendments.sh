#!/usr/bin/env bash
# INV-025: no earlier requirement is left saying something untrue, and no decision goes unrecorded.
# (1) spec 008 FR-014 carries "Amended by spec 012"; (2) docs/DECISIONS.md has "012 — decisions" with one bullet per
#     spec decision (5 + 9) and per plan deviation (6), "012 — re-pinned tests" naming each file in plan.md's table,
#     and "012 — owed on real phones".
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "${MEMOS_ROOT:-$root}"
status=0
dec=docs/DECISIONS.md
fail() { printf 'MISSING %s\n' "$1"; status=1; }
section() { awk -v h="## $1" 'index($0,h)==1{f=1;next} /^## /{f=0} f' "$dec"; }

grep -E '^- \*\*FR-014\*\*' specs/008-usability-polish/spec.md | grep -q 'Amended by spec 012' \
  || fail "FR-014 in specs/008-usability-polish/spec.md carries 'Amended by spec 012'"

decisions="$(section '012 — decisions')"
[ -n "$decisions" ] || fail "'012 — decisions' in $dec"
n="$(printf '%s\n' "$decisions" | grep -c '^- ' || true)"
[ "$n" -ge 20 ] || fail "'012 — decisions' needs 20 bullets (14 decisions + 6 deviations); has $n"

repinned="$(section '012 — re-pinned tests')"
[ -n "$repinned" ] || fail "'012 — re-pinned tests' in $dec"
printf '%s' "$repinned" | grep -q 'polish-part-card-menu.spec.ts' || fail "polish-part-card-menu.spec.ts under '012 — re-pinned tests'"

phones="$(section '012 — owed on real phones')"
[ -n "$phones" ] || fail "'012 — owed on real phones' in $dec"
for p in P1 P2 P3 P4 P5 P6; do printf '%s' "$phones" | grep -q "$p" || fail "$p under '012 — owed on real phones'"; done

[ $status -eq 0 ] && echo "memo amendments: ok"
exit $status
