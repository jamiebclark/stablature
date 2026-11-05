#!/usr/bin/env sh
# Round 2, F17. Runs the whole unit suite N times, as CI does, and fails on any red run. A test that
# passes alone and times out under the suite's load shows up only here: run in isolation, or under the
# probes' 300 s timeout, the H tests never fail. The suite's default timeout is 5 s and CI has no retry.
#   INV-001-suite-stays-green.sh       five runs
#   INV-001-suite-stays-green.sh 10    ten runs
cd "$(dirname "$0")/../../.." || exit 2
runs="${1:-5}"
red=0
i=0
while [ "$i" -lt "$runs" ]; do
  i=$((i + 1))
  out=$(npx vitest run < /dev/null 2>&1)
  code=$?
  summary=$(echo "$out" | sed 's/\x1b\[[0-9;]*[A-Za-z]//g' | grep -E '^ +Tests  ' | tr -s ' ')
  echo "run $i: exit $code$summary"
  echo "$out" | sed 's/\x1b\[[0-9;]*[A-Za-z]//g' | grep -E '^ FAIL ' | cut -c1-150 | sort -u
  [ "$code" -eq 0 ] || red=$((red + 1))
done
echo "$red of $runs runs red"
[ "$red" -eq 0 ]
