#!/usr/bin/env bash
# Review probe (round 3): plan.md Technical Context, "Edits keep each file's line endings. Every file touched in this
# tree is LF." Round 1 found this broken (F7, MAJOR) and T061 fixed it; round 2's remediation broke it again on
# docs/DECISIONS.md. This makes the check repeatable.
#
# Fails when:
#   - a file in the index has CRLF or mixed endings (`git ls-files --eol`: i/crlf, i/mixed), or
#   - a tracked file this branch modified has a working-tree line ending different from the one in the index
#     (i/lf w/crlf, or i/crlf w/lf, or a mixed w/), unless .gitattributes gives it `eol=lf`, or
#   - an untracked file this branch added under src/, e2e/ or scripts/ contains a CR, with the same exception.
# Under `eol=lf` git stores LF whatever the working tree holds, so a CRLF working copy cannot reach a commit; the
# index check is what proves it.
# Also prints `git diff --stat` beside `git diff --stat --ignore-cr-at-eol`: they must be equal.
#
#   bash scripts/check-line-endings.sh < /dev/null
set -u
cd "$(git rev-parse --show-toplevel)" || exit 2
bad=0
lf_attr() { [ "$(git check-attr eol -- "$1" | awk '{print $NF}')" = lf ]; }
while IFS= read -r f; do
  echo "CRLF in index   $f"
  bad=1
done < <(git ls-files --eol | awk '$1 == "i/crlf" || $1 == "i/mixed" {print $NF}')
while IFS= read -r f; do
  [ -f "$f" ] || continue
  lf_attr "$f" && continue
  line=$(git ls-files --eol -- "$f")
  i=$(printf '%s' "$line" | awk '{print $1}' | sed 's#^i/##')
  w=$(printf '%s' "$line" | awk '{print $2}' | sed 's#^w/##')
  if [ "$w" = "mixed" ] || { [ "$i" != "$w" ] && [ "$i" != "-text" ] && [ "$i" != "none" ]; }; then
    echo "changed ending  $f  (index $i, working tree $w)"
    bad=1
  fi
done < <(git diff --name-only)
while IFS= read -r f; do
  lf_attr "$f" && continue
  if grep -Iq $'\r' "$f"; then
    echo "CR in new file  $f"
    bad=1
  fi
done < <(git ls-files --others --exclude-standard -- src e2e scripts)
a=$(git diff --stat | tail -1)
b=$(git diff --stat --ignore-cr-at-eol | tail -1)
echo "diff --stat:                    $a"
echo "diff --stat --ignore-cr-at-eol: $b"
[ "$a" = "$b" ] || bad=1
[ "$bad" = 0 ] && echo "line endings: kept" || echo "line endings: CHANGED"
exit "$bad"
