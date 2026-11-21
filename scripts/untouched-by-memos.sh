#!/usr/bin/env bash
# INV-026: voice memos touch no capture, playback, play-view, export, parser, service-worker or deploy path.
# Named paths must have no diff against main, tracked or untracked. Every e2e/ file that exists on main is named too,
# except e2e/reading-helpers.ts (helper-only, plan.md's table) and e2e/polish-part-card-menu.spec.ts, which may change only the line that assigns `want`.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "${MEMOS_ROOT:-$root}"
status=0
paths=(
  src/components/capture "src/app/songs/[songId]/capture" src/components/app/PlayView.tsx "src/app/songs/[songId]/play"
  src/lib/playback src/lib/rhythm src/components/rhythm src/lib/capture
  src/lib/tab src/lib/export src/lib/reading src/components/reading src/components/tab src/lib/arrangement
  public/sw.js src/components/app/ServiceWorker.tsx docker-compose.yml docker-compose.build.yml Dockerfile
  .env.docker.example next.config.ts
  src/app/api/sync
  src/lib/sync/__tests__/merge.test.ts
)
# every e2e file that exists on main (new files there are allowed)
while IFS= read -r f; do
  [ "$f" = e2e/polish-part-card-menu.spec.ts ] && continue
  [ "$f" = e2e/reading-helpers.ts ] && continue # helper-only edits, recorded in plan.md's table
  paths+=("$f")
done < <(git ls-tree -r --name-only main -- e2e/)
for p in "${paths[@]}"; do
  changed="$(git diff main --stat -- "$p"; git ls-files --others --exclude-standard -- "$p")"
  if [ -n "$changed" ]; then printf 'CHANGED %s\n%s\n' "$p" "$changed"; status=1; else printf 'zero diff  %s\n' "$p"; fi
done

f=e2e/polish-part-card-menu.spec.ts
other="$(git diff main -U0 -- "$f" | grep -a '^[-+]' | grep -av '^---' | grep -av '^+++' | grep -av 'const want = ')"
if [ -n "$other" ]; then printf 'CHANGED beyond the want line: %s\n%s\n' "$f" "$other"; status=1; else printf 'only the want line  %s\n' "$f"; fi
exit $status
