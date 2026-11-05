#!/usr/bin/env bash
# INV-026: this entry changes neither the export, its tests, the stored model, the wire or the
# schema. Named paths must have no diff against main, tracked or untracked. protocol.ts may only
# swap literals for the three constants, and text.ts may only add.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
status=0
paths=(
  src/lib/tab/ascii.ts src/lib/tab/layout.ts src/components/tab/TabStaff.tsx
  src/lib/tab/__tests__/ascii.test.ts src/lib/export/__tests__/text.test.ts
  src/lib/local/__tests__/clipboard.test.ts src/lib/local/db.ts
  drizzle src/db src/lib/server src/app/api
)
for p in "${paths[@]}"; do
  changed="$(git diff main --stat -- "$p"; git ls-files --others --exclude-standard -- "$p")"
  if [ -n "$changed" ]; then printf 'CHANGED %s\n%s\n' "$p" "$changed"; status=1; else printf 'zero diff  %s\n' "$p"; fi
done

# Every removed or added line of protocol.ts must be a limit or its import.
extra="$(git diff main -U0 -- src/lib/sync/protocol.ts | grep -E '^[-+]' | grep -vE '^(\+\+\+|---)' \
  | grep -vE 'MAX_CHORD_LENGTH|MAX_FRET|MAX_REPEAT|MAX_TUPLET_COLUMNS|MIN_GROUP_COLUMNS|GROUP_KINDS|SYNCED_TABLES|^\+import \{$|^\+\} from "\.\./model";$|\.max\(200\)|\.max\(36\)|\.max\(512\)')"
if [ -n "$extra" ]; then printf 'protocol.ts changed beyond its limits:\n%s\n' "$extra"; status=1; else printf 'protocol.ts: limits only\n'; fi

removed="$(git diff main -U0 -- src/lib/export/text.ts | grep -E '^-' | grep -vE '^---')"
if [ -n "$removed" ]; then printf 'text.ts removed lines:\n%s\n' "$removed"; status=1; else printf 'text.ts: additive only\n'; fi

migrations="$(git status --short -- drizzle)"
[ -z "$migrations" ] && printf 'no migration\n' || { printf 'a migration:\n%s\n' "$migrations"; status=1; }
exit $status
