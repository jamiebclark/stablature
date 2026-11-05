#!/usr/bin/env bash
# INV-005: "never can the suite pass by seeing nothing". Runs the project's round-trip suite against
# one broken reader at a time and prints which of its two big tests noticed. The harvest and the
# generator are what FR-040 calls the backbone; the pinned tests beside them are hand-written cases.
# The unmutated control must pass first, or the experiment proves nothing and this exits 2.
# Exit 1 if a mutant survives both big tests.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
cd "$root"
cache="${TMPDIR:-/tmp}/spec004-mutants"
rm -rf "$cache" "$(cygpath -u "$LOCALAPPDATA" 2>/dev/null)/Temp/spec004-mutants"

control="$(npx vitest run --config "$here/vitest.mutants.config.mts" --reporter=dot < /dev/null 2>&1)"
if ! printf '%s\n' "$control" | grep -qE 'Tests +[0-9]+ passed'; then
  printf 'control FAILED, so no mutant result below would mean anything\n'
  printf '%s\n' "$control" | grep -E 'FAIL|Tests ' | head
  exit 2
fi
if printf '%s\n' "$control" | grep -qE 'Tests +[0-9]+ failed'; then
  printf 'control FAILED, so no mutant result below would mean anything\n'
  exit 2
fi
printf 'control: %s\n' "$(printf '%s\n' "$control" | grep -E 'Tests +' | sed 's/^ *//')"

status=0
for mutant in frets-off-by-one chords-lost no-merge no-group-kind; do
  out="$(MUTANT="$mutant" npx vitest run --config "$here/vitest.mutants.config.mts" --reporter=dot < /dev/null 2>&1)"
  harvest="$(printf '%s\n' "$out" | grep -c 'FAIL .*every harvested part reads back')"
  generator="$(printf '%s\n' "$out" | grep -c 'FAIL .*the seeded generator G reads back')"
  pinned="$(printf '%s\n' "$out" | grep -c 'FAIL .*pinned:')"
  other="$(printf '%s\n' "$out" | grep 'FAIL ' | grep -vc 'every harvested part\|seeded generator\|pinned:')"
  verdict="killed by the backbone"
  if [ "$harvest" = "0" ] && [ "$generator" = "0" ]; then verdict="SURVIVED the backbone"; status=1; fi
  printf '%-18s harvest:%s generator:%s pinned:%s other:%s -> %s\n' \
    "$mutant" "$harvest" "$generator" "$pinned" "$other" "$verdict"
done
exit $status
