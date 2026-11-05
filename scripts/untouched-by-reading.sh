#!/usr/bin/env bash
# INV-037: this entry touches neither storage, the wire, the codec nor the capture path. Named paths
# must have no diff against main, tracked or untracked. text.ts may change its header comment only.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
status=0
paths=(
  src/lib/tab/ascii.ts src/lib/tab/parse.ts src/lib/tab/reading.ts
  src/lib/server src/db drizzle
  src/lib/model.ts src/lib/local/db.ts src/lib/local/mutate.ts src/lib/local/editing.ts
  src/lib/local/clipboard.ts src/lib/local/importing.ts
  src/lib/arrangement src/components/capture
  src/components/app/PasteTab.tsx src/components/app/ExportSong.tsx
  src/components/rhythm src/components/ui/index.tsx public/sw.js
  src/lib/tab/__tests__ src/lib/export/__tests__
)
for p in "${paths[@]}"; do
  changed="$(git diff main --stat -- "$p"; git ls-files --others --exclude-standard -- "$p")"
  if [ -n "$changed" ]; then printf 'CHANGED %s\n%s\n' "$p" "$changed"; status=1; else printf 'zero diff  %s\n' "$p"; fi
done
# src/lib/sync apart from client.ts, whose diff may touch applyRemoteRows only (plan.md Deviations 14)
changed="$(git diff main --stat -- src/lib/sync ':(exclude)src/lib/sync/client.ts'; git ls-files --others --exclude-standard -- src/lib/sync)"
if [ -n "$changed" ]; then printf 'CHANGED src/lib/sync\n%s\n' "$changed"; status=1; else printf 'zero diff  src/lib/sync (apart from client.ts)\n'; fi
outside="$(git diff main -U0 -- src/lib/sync/client.ts | awk '
  /^@@/ { hunk=$0; next }
  /^(\+\+\+|---|diff|index)/ { next }
  /^[+-]/ { print hunk }' | sort -u)"
# every hunk header must sit inside applyRemoteRows (git names the enclosing function after the second @@)
bad="$(printf '%s\n' "$outside" | grep -v '^$' | grep -v 'applyRemoteRows' || true)"
if [ -n "$bad" ]; then printf 'CHANGED src/lib/sync/client.ts outside applyRemoteRows\n%s\n' "$bad"; status=1; else printf 'zero diff  src/lib/sync/client.ts outside applyRemoteRows\n'; fi
# src/app apart from globals.css
changed="$(git diff main --stat -- src/app ':(exclude)src/app/globals.css'; git ls-files --others --exclude-standard -- src/app ':(exclude)src/app/globals.css')"
if [ -n "$changed" ]; then printf 'CHANGED src/app\n%s\n' "$changed"; status=1; else printf 'zero diff  src/app (apart from globals.css)\n'; fi
# text.ts: only comment lines may differ
code="$(git diff main -U0 -- src/lib/export/text.ts | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vE '^[+-]\s*(/\*|\*|//|$)' || true)"
if [ -n "$code" ]; then printf 'CHANGED src/lib/export/text.ts (more than comments)\n%s\n' "$code"; status=1; else printf 'zero diff  src/lib/export/text.ts (comments only)\n'; fi
exit $status
