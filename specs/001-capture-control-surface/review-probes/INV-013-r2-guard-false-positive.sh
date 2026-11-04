#!/usr/bin/env bash
# INV-013 (round 2): src/lib/capture/__tests__/export-untouched.test.ts (T054) adopted a
# one-spec fence as a permanent member of `npm test`, which the pre-commit hook runs. The
# fence is "differs from main", so it says nothing once this spec merges, and it fails
# for any later entry that legitimately changes a fenced path.
#
# Simulated without touching the tree: pointing the guard's base at a commit from before
# the fenced paths existed reproduces "main does not yet have this branch's src/lib/tab
# change". Exit 0 = the guard tolerates a legitimate fenced change (or is gone).
set -u
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
TEST=src/lib/capture/__tests__/export-untouched.test.ts
[ -f "$TEST" ] || { echo "guard removed: held"; exit 0; }
BASE_COMMIT="$(git log --format=%h --diff-filter=A -- src/lib/tab/layout.ts | tail -1)~1"
echo "pretend base: $BASE_COMMIT"
INV013_BASE="$BASE_COMMIT" npx vitest run "$TEST" < /dev/null
code=$?
if [ "$code" -ne 0 ]; then
  echo "INV-013 r2: guard FAILS for a legitimate fenced change (exit $code)"
  exit 1
fi
echo "INV-013 r2: guard tolerated it"
