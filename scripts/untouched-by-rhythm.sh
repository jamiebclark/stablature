#!/usr/bin/env bash
# INV-043: this entry changes neither the ASCII codec, the export, the stored model, the wire nor
# the schema. Named paths must have no diff against main, tracked or untracked.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
status=0
paths=(
  src/lib/tab/ascii.ts src/lib/tab/parse.ts src/lib/tab/reading.ts src/lib/export/text.ts
  src/lib/sync src/lib/server src/app/api src/db drizzle
  src/lib/model.ts src/lib/local/db.ts src/lib/local/clipboard.ts src/lib/local/importing.ts
  src/components/ui/index.tsx public/sw.js
  src/lib/tab/__tests__/ascii.test.ts src/lib/export/__tests__/text.test.ts
  src/lib/tab/__tests__/round-trip.test.ts
)
for p in "${paths[@]}"; do
  changed="$(git diff main --stat -- "$p"; git ls-files --others --exclude-standard -- "$p")"
  if [ -n "$changed" ]; then printf 'CHANGED %s\n%s\n' "$p" "$changed"; status=1; else printf 'zero diff  %s\n' "$p"; fi
done
exit $status
