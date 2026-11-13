#!/usr/bin/env bash
# INV-016: no earlier requirement is left saying something untrue, and no pin moves in silence.
# (1) each file in plan.md's "Existing tests this changes on purpose" table is named in docs/DECISIONS.md under
#     "009 — re-pinned tests";
# (2) each requirement FR-035 names carries "Amended by spec 009" on its own line, with a note after it.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
status=0
plan=specs/009-rhythm-notation/plan.md
dec=docs/DECISIONS.md
fail() { printf 'MISSING %s\n' "$1"; status=1; }

rows="$(awk '/^### Existing tests this changes on purpose/{f=1;next} /^\*\*Must pass unedited/{f=0} f && /^\|/ && !/^\|---/ && !/^\| File/' "$plan" | cut -d'|' -f2 | grep -o '[A-Za-z0-9_./-]*\.\(ts\|tsx\|json\)')"
[ -n "$rows" ] || fail "no rows parsed from plan.md"
section="$(awk '/^## 009 — re-pinned tests/{f=1;next} /^## /{f=0} f' "$dec")"
[ -n "$section" ] || fail "no '009 — re-pinned tests' section in $dec"
for f in $rows; do
  printf '%s' "$section" | grep -q "$(basename "$f")" || fail "$f not named under '009 — re-pinned tests' in $dec"
done

req() { # spec file, line regex, label
  local l; l="$(grep -aE "$2" "$1" | grep -a 'Amended by spec 009' | head -1)"
  [ -n "$l" ] || { fail "$3 in $1"; return; }
  [ -n "$(printf '%s' "${l#*Amended by spec 009}" | tr -d ' .:—-')" ] || fail "$3: the marker has no note"
}
s5="$(ls -d specs/005-*/ | head -1)spec.md"; s3="$(ls -d specs/003-*/ | head -1)spec.md"
s7="$(ls -d specs/007-*/ | head -1)spec.md"; s8="$(ls -d specs/008-*/ | head -1)spec.md"
for id in FR-013 FR-014 FR-015 FR-016 SC-011; do req "$s5" "^- \*\*$id\*\*" "005 $id"; done
for id in FR-020 SC-009 FR-032; do req "$s3" "^- \*\*$id\*\*" "003 $id"; done
req "$s7" '^- \*\*FR-064\*\*' "007 FR-064"
req "$s8" '^- \*\*FR-003\*\*' "008 FR-003"

[ $status -eq 0 ] && echo "notation amendments: ok"
exit $status
