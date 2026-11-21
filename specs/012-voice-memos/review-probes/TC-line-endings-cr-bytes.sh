#!/usr/bin/env bash
# Review probe (spec 012, round 4). Plan § Technical Context, Constraints: "Keep each file's line endings; every file
# in this tree is LF (`npm run check:line-endings`)." Round 2 found it broken on src/lib/server/sync.ts (MAJOR F16);
# round 4 found it broken on playwright.config.ts (MAJOR F26), which T119 edited.
#
# Counts carriage-return BYTES with `tr`, not `grep $'\r'`. On Git for Windows, GNU grep strips a trailing CR before
# matching unless it is given -U, so `scripts/check-line-endings.sh:27` (`grep -Iq $'\r'`) never matches a CRLF file
# and its "CR in new file" half always passes on this machine (MINOR F28).
#
# Prints, and fails on:
#   - a tracked file this branch modified whose working tree has CRs that its index blob does not;
#   - an untracked text file this branch added under src/, e2e/ or scripts/ that contains a CR.
#
#   bash specs/012-voice-memos/review-probes/TC-line-endings-cr-bytes.sh < /dev/null
set -u
cd "$(git rev-parse --show-toplevel)" || exit 2
bad=0
crs() { tr -cd '\r' | wc -c | tr -d ' '; }
while IFS= read -r f; do
  [ -f "$f" ] || continue
  w=$(crs < "$f")
  i=$(git show ":$f" 2>/dev/null | crs)
  if [ "$w" != "$i" ]; then
    echo "modified  $f  index CRs $i, working tree CRs $w"
    bad=1
  fi
done < <(git diff --name-only)
while IFS= read -r f; do
  case "$f" in *.wav|*.png|*.jpg|*.webm|*.ogg|*.m4a) continue ;; esac
  n=$(crs < "$f")
  if [ "$n" != 0 ]; then
    echo "new       $f  CRs $n"
    bad=1
  fi
done < <(git ls-files --others --exclude-standard -- src e2e scripts)
[ "$bad" = 0 ] && echo "TC line endings: held" || echo "TC line endings: VIOLATED"
exit "$bad"
