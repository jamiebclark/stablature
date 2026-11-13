#!/usr/bin/env bash
# INV-024: no earlier requirement is left saying something untrue, and no pin moves in silence.
# (1) each file in plan.md's "Existing tests this changes on purpose" table is named in docs/DECISIONS.md;
# (2) each requirement FR-035 names in spec 007 carries "Amended by spec 008" on its own line, and the note
#     states the change FR-035 names, not only the marker.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
status=0
plan=specs/008-usability-polish/plan.md
dec=docs/DECISIONS.md
s7=specs/007-usability-pass/spec.md
fail() { printf 'MISSING %s\n' "$1"; status=1; }

rows="$(awk '/^### Existing tests this changes on purpose/{f=1;next} /^\*\*Must pass unedited/{f=0} f && /^\|/ && !/^\|---/ && !/^\| File/' "$plan" | cut -d'|' -f2 | grep -o '[A-Za-z0-9_./-]*\.\(ts\|tsx\|json\)')"
[ -n "$rows" ] || fail "no rows parsed from plan.md"
for f in $rows; do
  grep -q "$(basename "$f")" "$dec" || fail "$f not named in $dec"
done

req() { # line regex, label, pattern the amendment note must contain (case-insensitive)
  local l; l="$(grep -E "$1" "$s7")"
  printf '%s' "$l" | grep -q "Amended by spec 008" || { fail "$2 in $s7"; return; }
  printf '%s' "${l#*Amended by spec 008}" | grep -qiE "$3" || fail "$2: the amendment does not say /$3/"
}
req '^- \*\*FR-001\*\*' "007 FR-001" 'sav(ed|ing)|sign in|signed.out'
req '^- \*\*FR-026\*\*' "007 FR-026" 'duration'
req '^- \*\*FR-056\*\*' "007 FR-056" 'capture wraps'
req 'Wrapping .*capture' "007 Out of Scope 'Wrapping … capture'" 'capture now wraps|capture wraps'

bash scripts/check-usability-amendments.sh >/dev/null 2>&1 || fail "check:usability-amendments no longer passes"

[ $status -eq 0 ] && echo "polish amendments: ok"
exit $status
