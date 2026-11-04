#!/usr/bin/env bash
# INV-001: no stored model, schema, wire, clipboard or migration change.
# Members: src/db, drizzle, src/lib/model.ts, src/lib/sync, src/lib/local/clipboard.ts,
# src/lib/local/db.ts. Tracked diffs AND untracked files, against main.
set -u
cd "$(dirname "$0")/../../.."
FENCE="src/db drizzle src/lib/model.ts src/lib/sync src/lib/local/clipboard.ts src/lib/local/db.ts"
OUT=$(git diff --stat main -- $FENCE; git status --short --untracked-files=all -- $FENCE)
[ -z "$OUT" ] && echo "INV-001 held: nothing changed in 6 of 6 members" && exit 0
echo "INV-001 violated:"; echo "$OUT"; exit 1
