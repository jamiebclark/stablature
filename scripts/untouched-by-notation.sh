#!/usr/bin/env bash
# INV-015: the rhythm-notation pass touches no storage, wire, export, parser or engine path. Named paths must have no diff
# against main, tracked or untracked. src/lib/rhythm/notation.ts may only gain lines, apart from the `hit` callback's
# signature in readBar and its two call sites.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "${NOTATION_ROOT:-$root}"
status=0
paths=(
  src/db drizzle src/lib/server src/lib/sync src/app/api src/lib/model.ts src/lib/tab src/lib/export src/lib/reading
  src/lib/arrangement src/lib/local src/lib/capture/latches.ts src/lib/chords.ts
  src/lib/rhythm/durations.ts src/lib/rhythm/audio.ts src/lib/rhythm/scheduler.ts src/lib/rhythm/stream.ts
  src/lib/rhythm/tap.ts src/lib/rhythm/tempo.ts
  src/lib/rhythm/__tests__/notation-baseline.test.ts src/lib/rhythm/__tests__/notation-oracle.test.ts
  src/lib/rhythm/__tests__/notation.test.ts
  src/components/app/PlayView.tsx src/components/app/SongView.tsx public/sw.js
  e2e/fixtures/capture-375-before.json e2e/usability-height-budget.spec.ts e2e/usability-wrap.spec.ts
  e2e/polish-band-unchanged.spec.ts
)
for p in "${paths[@]}"; do
  changed="$(git diff main --stat -- "$p"; git ls-files --others --exclude-standard -- "$p")"
  if [ -n "$changed" ]; then printf 'CHANGED %s\n%s\n' "$p" "$changed"; status=1; else printf 'zero diff  %s\n' "$p"; fi
done

f=src/lib/rhythm/notation.ts
# removed lines other than the `hit` callback's signature and its call sites (`hit?.(` / `hit(`)
removed="$(git diff main -U0 -- "$f" | grep -a '^-' | grep -av '^---' | grep -avE '\bhit\b')"
if [ -n "$removed" ]; then printf 'REMOVED LINES in %s\n%s\n' "$f" "$removed"; status=1; else printf 'additions only  %s\n' "$f"; fi
exit $status
