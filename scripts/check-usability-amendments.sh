#!/usr/bin/env bash
# INV-045: no earlier requirement is left saying something untrue, and no pin moves in silence.
# (1) each file in plan.md's "Existing tests this changes on purpose" table is named in docs/DECISIONS.md;
# (2) each requirement FR-064 names carries "Amended by spec 007" on its own line, FR-020 with the exact wording.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
status=0
plan=specs/007-usability-pass/plan.md
dec=docs/DECISIONS.md
fail() { printf 'MISSING %s\n' "$1"; status=1; }

rows="$(awk '/^### Existing tests this changes on purpose/{f=1;next} /^\*\*Must pass unedited/{f=0} f && /^\|/ && !/^\|---/ && !/^\| File/' "$plan" | cut -d'|' -f2 | grep -o '[A-Za-z0-9_./-]*\.\(ts\|tsx\|json\)')"
[ -n "$rows" ] || fail "no rows parsed from plan.md"
for f in $rows; do
  grep -q "$(basename "$f")" "$dec" || fail "$f not named in $dec"
done

req() { # file, line regex, label
  local f; f="$(ls $1 2>/dev/null | head -1)"
  [ -n "$f" ] || { fail "$1"; return; }
  grep -E "$2" "$f" | grep -q "Amended by spec 007" || fail "$3 in $f"
}
req 'specs/001-*/spec.md' '^- \*\*FR-026\*\*' "001 FR-026"
req 'specs/002-*/spec.md' '^- \*\*SC-006\*\*' "002 SC-006"
req 'specs/003-*/spec.md' '^- \*\*FR-020\*\*' "003 FR-020"
req 'specs/003-*/spec.md' '^- \*\*SC-009\*\*' "003 SC-009"
req 'specs/003-*/plan.md' '^\| INV-013 ' "003 INV-013"
req 'specs/004-*/plan.md' '^\| INV-010 ' "004 INV-010"
req 'specs/005-*/spec.md' '^- \*\*FR-026\*\*' "005 FR-026"
for n in 013 014 015; do req 'specs/005-*/spec.md' "^- \*\*FR-$n\*\*" "005 FR-$n"; done
req 'specs/006-*/spec.md' '^- \*\*FR-001\*\*' "006 FR-001"
grep -q "Amended by spec 007" specs/004-*/contracts/reader.md || fail "004 contracts/reader.md"

want='At 375×667 with all seven controls present, labels MUST NOT wrap, the staff MUST keep every string of a four-, five- or six-string part in view with a chord row and a bracket row, and the page MUST NOT scroll. Where a part does not fit, at seven strings or on a shorter screen, every string and the bracket MUST be reachable with a swipe.'
grep -qF "$want" specs/003-*/spec.md || fail "003 FR-020 exact wording"

[ $status -eq 0 ] && echo "usability amendments: ok"
exit $status
