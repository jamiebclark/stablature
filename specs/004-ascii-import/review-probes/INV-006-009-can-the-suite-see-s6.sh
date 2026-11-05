#!/usr/bin/env bash
# Round 9. Breaks S6 one way at a time, in memory, and counts what the project's own suites notice.
# The unmutated control must pass first. A mutant reported SURVIVED is a part of the rule no test
# in the suite holds in place. Exit 1 if any survives.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
cd "$root"
config="$here/vitest.s6-mutants.config.mts"
rm -rf "${TMPDIR:-/tmp}/spec004-s6-mutants" "$(cygpath -u "$LOCALAPPDATA" 2>/dev/null)/Temp/spec004-s6-mutants"

control="$(npx vitest run --config "$config" --reporter=dot < /dev/null 2>&1)"
if printf '%s\n' "$control" | grep -qE 'Tests +[0-9]+ failed' || ! printf '%s\n' "$control" | grep -qE 'Tests +[0-9]+ passed'; then
  printf 'control FAILED, so no mutant result below would mean anything\n'
  printf '%s\n' "$control" | grep -E 'FAIL|Tests ' | head
  exit 2
fi
printf 'control: %s\n' "$(printf '%s\n' "$control" | grep -E 'Tests +' | sed 's/^ *//')"

status=0
for mutant in ${S6_MUTANTS:-without-s6 no-note no-touch no-prose no-numbers-guard numbers-above-only numbers-below-only no-pipe-rule touch-hyphen-only prose-edge-no-minus digits-only line-not-run run-digits-only no-notation-x}; do
  out="$(S6_MUTANT="$mutant" npx vitest run --config "$config" --reporter=dot < /dev/null 2>&1)"
  if printf '%s\n' "$out" | grep -q 'no longer applies'; then
    printf '%-22s does not apply: the code has moved\n' "$mutant"
    status=1
    continue
  fi
  failed="$(printf '%s\n' "$out" | grep -c '^ *FAIL ')"
  verdict="killed"
  if [ "$failed" = "0" ]; then verdict="SURVIVED"; status=1; fi
  printf '%-22s failed:%s -> %s\n' "$mutant" "$failed" "$verdict"
done
exit $status
