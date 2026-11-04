#!/usr/bin/env bash
# INV-003 (first half): ascii.test.ts, text.test.ts and editing.test.ts carry zero diff.
set -u
cd "$(dirname "$0")/../../.."
OUT=$(git diff --stat main -- src/lib/tab/__tests__/ascii.test.ts src/lib/export/__tests__/text.test.ts src/lib/local/__tests__/editing.test.ts)
[ -z "$OUT" ] && echo "INV-003 held: 3 of 3 suites unedited" && exit 0
echo "INV-003 violated:"; echo "$OUT"; exit 1
