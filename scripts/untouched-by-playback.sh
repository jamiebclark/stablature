#!/usr/bin/env bash
# INV-019: playback touches no storage, wire, export, capture, reading, click-stream or service-worker path.
# Named paths must have no diff against main, tracked or untracked. e2e/polish-part-card-menu.spec.ts may change
# only the line that assigns `want`.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
status=0
paths=(
  src/db drizzle src/lib/server src/lib/sync src/app/api src/lib/model.ts src/lib/local
  src/lib/tab src/lib/export src/lib/capture src/lib/chords.ts src/lib/tunings.ts src/lib/pitch.ts
  src/lib/arrangement/expand.ts
  src/lib/rhythm/stream.ts src/lib/rhythm/durations.ts src/lib/rhythm/tempo.ts src/lib/rhythm/tap.ts src/lib/rhythm/beams.ts
  src/lib/reading src/components/reading
  src/components/capture src/components/tab src/components/ui
  src/components/rhythm/__tests__/click-bar.test.tsx src/components/rhythm/__tests__/tempo-control.test.tsx
  public/sw.js src/components/app/ServiceWorker.tsx
  e2e/click-helpers.ts e2e/wide-helpers.ts e2e/capture.spec.ts e2e/fixtures
)
# every existing rhythm test, by name (new files there are allowed)
while IFS= read -r f; do paths+=("$f"); done < <(git ls-tree --name-only main -- src/lib/rhythm/__tests__/)
for g in 'e2e/click-*.spec.ts' 'e2e/wide-*.spec.ts' 'e2e/reading-*.spec.ts' 'e2e/capture-*.spec.ts' \
  'e2e/notation-*.spec.ts' 'e2e/usability-*.spec.ts' 'e2e/polish-*.spec.ts'; do
  while IFS= read -r f; do
    [ "$f" = e2e/polish-part-card-menu.spec.ts ] && continue
    paths+=("$f")
  done < <({ git ls-tree --name-only main -- e2e/ | grep -E "^$(printf '%s' "$g" | sed 's/\./\./g; s/\*/.*/g')\$"; \
             git ls-files --others --exclude-standard -- e2e/ | grep -E "^$(printf '%s' "$g" | sed 's/\./\./g; s/\*/.*/g')\$"; } | sort -u)
done
for p in "${paths[@]}"; do
  # a path that exists on neither side is not a change
  changed="$(git diff main --stat -- "$p"; git ls-files --others --exclude-standard -- "$p")"
  if [ -n "$changed" ]; then printf 'CHANGED %s\n%s\n' "$p" "$changed"; status=1; else printf 'zero diff  %s\n' "$p"; fi
done

f=e2e/polish-part-card-menu.spec.ts
other="$(git diff main -U0 -- "$f" | grep -a '^[-+]' | grep -av '^---' | grep -av '^+++' | grep -av 'const want = ')"
if [ -n "$other" ]; then printf 'CHANGED beyond the want line: %s\n%s\n' "$f" "$other"; status=1; else printf 'only the want line  %s\n' "$f"; fi
exit $status
