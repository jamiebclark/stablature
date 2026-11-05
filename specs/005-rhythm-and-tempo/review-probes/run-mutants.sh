#!/usr/bin/env sh
# Runs every mutant against the feature's own suite, then any survivor against this directory's unit
# probes. Prints one row a mutant. Nothing on disk changes: the mutants are in-memory transforms.
#   run-mutants.sh            all of them
#   run-mutants.sh tap-       only names containing that text
cd "$(dirname "$0")/../../.." || exit 2
CONFIG=specs/005-rhythm-and-tempo/review-probes/vitest.mutants.config.mts
FILTER="${1:-}"

run() {
  # A non-zero exit with a failing test is a kill. A stale mutant throws in the transform, and reports
  # as STALE rather than passing for a kill.
  out=$(MUTANT="$1" MUTANT_AGAINST="$2" npx vitest run --config "$CONFIG" < /dev/null 2>&1)
  code=$?
  if echo "$out" | grep -q "no longer applies"; then echo STALE
  elif [ "$code" -eq 0 ]; then echo SURVIVED
  # A kill is a failing test. A config that does not parse also exits non-zero, and must not read as one.
  elif echo "$out" | grep -q "FAIL "; then echo KILLED
  else echo BROKEN; fi
}

NAMES=$(MUTANT_LIST=1 npx vitest run --config "$CONFIG" < /dev/null 2>/dev/null | grep -E '^[a-z0-9-]+$')
for name in $NAMES; do
  case "$name" in *"$FILTER"*) ;; *) continue ;; esac
  suite=$(run "$name" suite)
  if [ "$suite" = "SURVIVED" ]; then whole=$(run "$name" all); probes=$(run "$name" probes); else whole="-"; probes="-"; fi
  printf '%-28s suite=%-9s whole-suite=%-9s probes=%s\n' "$name" "$suite" "$whole" "$probes"
done
