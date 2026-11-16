#!/usr/bin/env bash
# INV-020: no earlier requirement is left saying something untrue, no decision unrecorded, no pin moved in silence.
# (1) spec 005's Out of Scope line "Pitched playback of the notes." carries "Amended by spec 011";
# (2) docs/DECISIONS.md has "011 — decisions" naming the spec's 11 decisions and plan.md's 4 deviations;
# (3) "011 — re-pinned tests" names each file in plan.md's "Existing tests this changes on purpose" table.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
status=0
plan=specs/011-tab-playback/plan.md
spec=specs/011-tab-playback/spec.md
s5=specs/005-rhythm-and-tempo/spec.md
dec=docs/DECISIONS.md
fail() { printf 'MISSING %s\n' "$1"; status=1; }

grep -F 'Pitched playback of the notes.' "$s5" | grep -q 'Amended by spec 011' || fail "spec 005 Out of Scope line lacks 'Amended by spec 011'"

section() { awk -v h="$1" '$0 ~ "^## " h {f=1; next} /^## /{f=0} f' "$dec"; }
decisions="$(section '011 — decisions')"
repinned="$(section '011 — re-pinned tests')"
[ -n "$decisions" ] || fail "section '011 — decisions' in $dec"
[ -n "$repinned" ] || fail "section '011 — re-pinned tests' in $dec"
[ -n "$decisions" ] && [ -n "$repinned" ] || { echo "playback amendments: not done"; exit 1; }

# each spec decision's bold lead words, and each plan deviation's, must appear in the section
n=0
while IFS= read -r lead; do
  n=$((n+1))
  grep -qiF -- "$lead" <<<"$decisions" || fail "spec decision: $lead"
done < <(awk '/^## Decisions made for this spec/{f=1;next} /^## /{f=0} f && /^[0-9]+\. \*\*/' "$spec" | sed -E 's/^[0-9]+\. \*\*([^*]*)\*\*.*/\1/')
[ "$n" -eq 11 ] || fail "expected 11 decisions in the spec, parsed $n"

n=0
while IFS= read -r lead; do
  n=$((n+1))
  grep -qiF -- "$lead" <<<"$decisions" || fail "plan deviation: $lead"
done < <(awk '/^### Deviations from the spec/{f=1;next} /^## |^### /{f=0} f && /^[0-9]+\. \*\*/' "$plan" | sed -E 's/^[0-9]+\. \*\*([^*]*)\*\*.*/\1/')
[ "$n" -eq 4 ] || fail "expected 4 deviations in the plan, parsed $n"

rows="$(awk '/^### Existing tests this changes on purpose/{f=1;next} /^\*\*Must pass unedited/{f=0} f && /^\|/ && !/^\|---/ && !/^\| File/' "$plan" | cut -d'|' -f2 | grep -o '[A-Za-z0-9_./-]*\.\(ts\|tsx\|json\)')"
[ -n "$rows" ] || fail "no rows parsed from plan.md"
for f in $rows; do grep -qF "$(basename "$f")" <<<"$repinned" || fail "$f not named under '011 — re-pinned tests'"; done

[ $status -eq 0 ] && echo "playback amendments: ok"
exit $status
