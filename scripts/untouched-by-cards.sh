#!/usr/bin/env bash
# INV-015: cards-per-row touches no stored row, sync, export, capture, playback, memo UI, SongView or drawn part of TabStaff.
# Fenced paths must have no diff against main, tracked or untracked; a few files may change only inside a bounded hunk.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "${CARDS_ROOT:-$root}"
status=0
paths=(
  src/lib src/db src/app/api drizzle
  src/components/capture src/components/rhythm src/components/memos src/components/app/SongView.tsx
  src/components/reading/useReadingPosition.ts
  public/sw.js next.config.ts
)
while IFS= read -r f; do
  case "$f" in e2e/wide-order.spec.ts|e2e/wide-print.spec.ts|e2e/fixtures/memo-card-before.json|e2e/memo-card-height.spec.ts) continue ;; esac
  paths+=("$f")
done < <(git ls-tree -r --name-only main -- e2e/)
for p in "${paths[@]}"; do
  changed="$(git diff main --stat -- "$p"; git ls-files --others --exclude-standard -- "$p")"
  if [ -n "$changed" ]; then printf 'CHANGED %s\n%s\n' "$p" "$changed"; status=1; fi
done
# ClickBar* (any file)
cb="$(git diff main --stat -- 'src/components/app/ClickBar*'; git ls-files --others --exclude-standard -- 'src/components/app/ClickBar*')"
[ -n "$cb" ] && { printf 'CHANGED ClickBar*\n%s\n' "$cb"; status=1; }

# bounded: TabStaff.tsx hunks only inside rulerWidth / sumTerms
f=src/components/tab/TabStaff.tsx
if ! git diff main --quiet -- "$f"; then
  bad="$(git diff main -U0 -- "$f" | awk '
    /^@@/ { hdr=$0; sub(/^@@[^@]*@@ ?/, "", hdr); ok = (hdr ~ /rulerWidth|sumTerms/); next }
    /^[-+]/ && !/^(---|\+\+\+)/ { if (!ok && $0 !~ /rulerWidth|sumTerms/) print }')"
  if [ -n "$bad" ]; then printf 'CHANGED outside rulerWidth/sumTerms: %s\n%s\n' "$f" "$bad"; status=1; fi
fi
# bounded: PlayView.tsx only the card-passes block
f=src/components/app/PlayView.tsx
other="$(git diff main -U0 -- "$f" | grep -a '^[-+]' | grep -av '^---' | grep -av '^+++' | grep -av 'card-passes')"
if [ -n "$(git diff main -U0 -- "$f")" ]; then
  # moved block may span lines; allow only when every hunk touches card-passes
  hunks_bad="$(git diff main -U0 -- "$f" | awk '/^@@/{if(h!=""&&!seen)print h; h=$0; seen=0; next} /card-passes/{seen=1} END{if(h!=""&&!seen)print h}')"
  [ -n "$hunks_bad" ] && { printf 'CHANGED beyond card-passes: %s\n%s\n' "$f" "$hunks_bad"; status=1; }
fi
: "$other"
# bounded: playwright.config.ts only the firefox testMatch
f=playwright.config.ts
bad="$(git diff main -U0 -- "$f" | grep -a '^[-+]' | grep -av '^---' | grep -av '^+++' | grep -av 'testMatch')"
[ -n "$bad" ] && { printf 'CHANGED beyond firefox testMatch: %s\n%s\n' "$f" "$bad"; status=1; }
# bounded: package.json only the two new check: scripts
f=package.json
bad="$(git diff main -U0 -- "$f" | grep -a '^[-+]' | grep -av '^---' | grep -av '^+++' | grep -av 'check:untouched-cards\|check:cards-amendments')"
[ -n "$bad" ] && { printf 'CHANGED beyond the two check: scripts: %s\n%s\n' "$f" "$bad"; status=1; }
[ $status -eq 0 ] && echo "untouched by cards: ok"
exit $status
