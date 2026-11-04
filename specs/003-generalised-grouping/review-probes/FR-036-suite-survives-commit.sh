#!/usr/bin/env bash
# FR-036, round 2. Everything on this branch is uncommitted, so a test that reads `git show HEAD:`
# or `main:` is still seeing the pre-feature file and cannot show what a commit does to it. This
# commits the working tree in a throwaway clone, runs the unit suite there, and reports whether
# `main:` would still hold what e2e/grouping-glyph.spec.ts reads once the feature has merged.
# Nothing in this checkout changes. Exits non-zero if the suite goes red.
set -u
root="$(cd "$(dirname "$0")/../../.." && pwd)"
tmp="$(mktemp -d)"
repo="$tmp/repo"
cleanup() {
  # node_modules is a junction: remove the link alone, or rm would follow it into the real one.
  [ -e "$repo/node_modules" ] && MSYS2_ARG_CONV_EXCL='*' cmd /c rmdir "$(cygpath -w "$repo/node_modules")" > /dev/null 2>&1
  rm -rf "$tmp"
}
trap cleanup EXIT
git clone -q --shared "$root" "$repo"
cd "$root"
git ls-files -m -o --exclude-standard | while IFS= read -r f; do
  if [ -f "$f" ]; then mkdir -p "$repo/$(dirname "$f")"; cp "$f" "$repo/$f"; fi
done
git diff --name-only --diff-filter=D HEAD | while IFS= read -r f; do rm -f "$repo/$f"; done
cd "$repo"
git add -A
git -c user.name=probe -c user.email=probe@localhost commit -q -m "chore: probe" --no-verify
git branch -f main HEAD > /dev/null
MSYS2_ARG_CONV_EXCL='*' cmd /c mklink /J "$(cygpath -w "$repo/node_modules")" "$(cygpath -w "$root/node_modules")" > /dev/null
echo "HEAD:src/components/icons/index.tsx mentions TripletGlyph $(git show HEAD:src/components/icons/index.tsx | grep -c TripletGlyph) time(s)"
echo "main: as merged mentions TripletGlyph $(git show main:src/components/icons/index.tsx | grep -c TripletGlyph) time(s)"
npx vitest run < /dev/null 2>&1 | tail -30
status=${PIPESTATUS[0]}
echo "suite exit: $status"
exit "$status"
