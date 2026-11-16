#!/usr/bin/env bash
# INV-017: no earlier requirement is left saying something untrue, and no pin moves in silence.
# (1) each file in plan.md's "Existing tests this changes on purpose" table is named in docs/DECISIONS.md under
#     "010 — re-pinned tests"; (2) spec 007 SC-010 and FR-055 each carry "Amended by spec 010"; (3) "010 — decisions" exists.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
status=0
plan=specs/010-wide-reading-layout/plan.md
dec=docs/DECISIONS.md
s7=specs/007-usability-pass/spec.md
fail() { printf 'MISSING %s\n' "$1"; status=1; }

rows="$(awk '/^### Existing tests this changes on purpose/{f=1;next} /^\*\*Must pass unedited/{f=0} f && /^\|/ && !/^\|---/ && !/^\| File/' "$plan" | cut -d'|' -f2 | grep -o '[A-Za-z0-9_./-]*\.\(ts\|tsx\|json\)')"
[ -n "$rows" ] || fail "no rows parsed from plan.md"
section="$(awk '/^## 010 — re-pinned tests/{f=1;next} /^## /{f=0} f' "$dec")"
[ -n "$section" ] || fail "'010 — re-pinned tests' in $dec"
for f in $rows; do
  printf '%s' "$section" | grep -q "$(basename "$f")" || fail "$f not named under '010 — re-pinned tests' in $dec"
done
grep -q '^## 010 — decisions' "$dec" || fail "'010 — decisions' in $dec"
for r in SC-010 FR-055; do
  grep -E "^- \*\*$r\*\*" "$s7" | grep -q "Amended by spec 010" || fail "$r in $s7 carries 'Amended by spec 010'"
done
[ $status -eq 0 ] && echo "wide amendments: ok"
exit $status
