#!/usr/bin/env bash
# INV-013: the plain-text export never changes.
#   1. No file under the layout / serialiser / sync / model / schema surface differs from main
#      (committed or uncommitted, tracked or untracked).
#   2. The two export suites are unmodified relative to main and green.
set -u
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
BASE="${BASE:-main}"
FENCED="src/lib/tab src/lib/export src/lib/sync src/lib/model.ts src/db/schema"

changed=$( { git diff --name-only "$BASE" -- $FENCED; git ls-files --others --exclude-standard -- $FENCED; } | sort -u)
if [ -n "$changed" ]; then
  echo "INV-013 VIOLATED: fenced files differ from $BASE:"; echo "$changed"; exit 1
fi
echo "fenced paths unchanged vs $BASE"

suites="src/lib/tab/__tests__/ascii.test.ts src/lib/export/__tests__/text.test.ts"
if [ -n "$(git diff --name-only "$BASE" -- $suites)" ]; then
  echo "INV-013 VIOLATED: an export suite was edited"; exit 1
fi
npx vitest run $suites < /dev/null || { echo "INV-013 VIOLATED: export suites red"; exit 1; }
echo "INV-013 held"
