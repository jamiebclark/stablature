#!/usr/bin/env bash
# INV-014: this entry touches neither storage, the wire, the layout and export logic, the capture path nor the
# click's reader. Named paths must have no diff against main, tracked or untracked (plan.md Scope fence).
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
status=0
paths=(
  src/db drizzle src/lib/server src/lib/sync src/app/api src/lib/model.ts src/lib/local
  src/lib/tab src/lib/export src/lib/rhythm src/lib/arrangement src/lib/capture src/lib/chords.ts
  src/lib/reading/position.ts src/lib/reading/bars.ts src/lib/reading/played.ts src/lib/reading/marks.ts
  src/lib/reading/compare.ts src/lib/reading/labels.ts src/lib/reading/staff.ts src/lib/reading/view.ts
  src/lib/reading/__tests__/baseline.json src/lib/reading/__tests__/notation-baseline.json
  src/components/capture src/components/tab/RhythmCell.tsx src/components/tab/__tests__/__snapshots__
  public/sw.js
  e2e/click-double-tap.spec.ts e2e/click-bar-fit.spec.ts e2e/click-following.spec.ts
  e2e/usability-highlight-timing.spec.ts e2e/usability-height-budget.spec.ts
  'e2e/polish-band*.spec.ts' 'e2e/capture-*.spec.ts' 'e2e/notation-capture*.spec.ts'
  e2e/fixtures/capture-375-before.json e2e/fixtures/paste-preview-before.json
)
for p in "${paths[@]}"; do
  changed="$(git diff main --stat -- "$p"; git ls-files --others --exclude-standard -- "$p")"
  if [ -n "$changed" ]; then printf 'CHANGED %s\n%s\n' "$p" "$changed"; status=1; else printf 'zero diff  %s\n' "$p"; fi
done
# e2e/capture.spec.ts: only the test "builds the brief's arrangement and reads it back in order" may differ.
f=e2e/capture.spec.ts
range="$(git show "main:$f" | awk '
  /test\(".*builds the brief.s arrangement and reads it back in order/ { s=NR; next }
  s && !e && /^  (test|it)\(|^  \}\);|^\}\);/ { if (NR > s && ($0 ~ /^  \}\);/ || $0 ~ /^  (test|it)\(/)) { e=NR; if ($0 ~ /^  (test|it)\(/) e=NR-1 } }
  END { if (s) print s, (e ? e : NR) }')"
if [ -z "$range" ]; then
  printf 'CHANGED %s (could not find the test that may differ)\n' "$f"; status=1
else
  set -- $range
  bad="$(git diff main -U0 -- "$f" | awk -v s="$1" -v e="$2" '
    /^@@/ { split($2, a, ","); from = substr(a[1], 2) + 0; n = (a[2] == "" ? 1 : a[2] + 0);
            to = from + (n > 0 ? n - 1 : 0); if (from < s - 1 || to > e + 1) print $0 }')"
  if [ -n "$bad" ]; then printf 'CHANGED %s outside lines %s-%s\n%s\n' "$f" "$1" "$2" "$bad"; status=1
  else printf 'zero diff  %s (apart from the test on lines %s-%s)\n' "$f" "$1" "$2"; fi
fi
exit $status
