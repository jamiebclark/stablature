#!/usr/bin/env bash
# INV-020 / FR-030 / SC-003: the exact-string suites have zero diff against main and pass.
# FR-037: the only existing tests changed are the three the plan names.
set -u
cd "$(dirname "$0")/../../.."
BASE="${BASE:-main}"
FAIL=0

DIFF=$(git diff --stat "$BASE" -- src/lib/tab/__tests__/ascii.test.ts src/lib/export/__tests__/text.test.ts)
if [ -n "$DIFF" ]; then echo "FAIL: exact suites edited: $DIFF"; FAIL=1; fi

CHANGED=$(git diff --name-only "$BASE" -- '*.test.ts' '*.test.tsx' '*.spec.ts' | sort)
ALLOWED=$(printf '%s\n' src/lib/__tests__/storage-fence.test.ts src/lib/capture/__tests__/properties.test.ts src/lib/local/__tests__/editing.test.ts | sort)
if [ "$CHANGED" != "$ALLOWED" ]; then echo "FAIL: changed tests differ:"; echo "$CHANGED"; FAIL=1; fi

npx vitest run src/lib/tab/__tests__/ascii.test.ts src/lib/export/__tests__/text.test.ts < /dev/null > /tmp/inv020.log 2>&1 || FAIL=1
tail -6 /tmp/inv020.log
[ -e src/lib/__tests__/storage-fence.test.ts ] && { echo "FAIL: fence still there"; FAIL=1; }
[ "$FAIL" = 0 ] && echo "INV-020 held"
exit $FAIL
