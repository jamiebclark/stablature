#!/usr/bin/env bash
# INV-023: the polish pass touches no storage, wire, export or layout-engine path. Named paths must have no diff
# against main, tracked or untracked. src/lib/local/queries.ts and hooks.ts may only gain lines (or change an import
# list). The one-line branch of TabStaff (its last top-level `return (` to the end of the body) must match main byte for byte.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
status=0
paths=(
  src/db drizzle src/lib/server src/lib/sync src/app/api src/lib/model.ts src/lib/tab src/lib/export
  src/lib/rhythm src/lib/reading src/lib/arrangement src/lib/capture/latches.ts src/lib/chords.ts
  src/components/app/PlayView.tsx public/sw.js
  e2e/usability-wrap.spec.ts
)
for f in src/lib/local/*; do
  case "$(basename "$f")" in queries.ts|hooks.ts) ;; *) paths+=("$f") ;; esac
done
for p in "${paths[@]}"; do
  changed="$(git diff main --stat -- "$p"; git ls-files --others --exclude-standard -- "$p")"
  if [ -n "$changed" ]; then printf 'CHANGED %s\n%s\n' "$p" "$changed"; status=1; else printf 'zero diff  %s\n' "$p"; fi
done
# a new file under src/lib/local/ is also a change
newlocal="$(git ls-files --others --exclude-standard -- src/lib/local | grep -v -e '/queries\.ts$' -e '/hooks\.ts$')"
[ -n "$newlocal" ] && { printf 'CHANGED new file in src/lib/local\n%s\n' "$newlocal"; status=1; }

for f in src/lib/local/queries.ts src/lib/local/hooks.ts; do
  removed="$(git diff main -U0 -- "$f" | grep -a '^-' | grep -av '^---' | grep -av '^-import ' | grep -av '^-} from ' | grep -av '^-  [A-Za-z_$][A-Za-z0-9_$]*,\?$')"
  if [ -n "$removed" ]; then printf 'REMOVED LINES in %s\n%s\n' "$f" "$removed"; status=1; else printf 'additions only  %s\n' "$f"; fi
  added="$(git diff main -U0 -- "$f" | grep -a '^+' | grep -aE '^\+(export )?(async )?(function|const|type|interface) ' | sed 's/^+//')"
  [ -n "$added" ] && printf '  added declarations:\n%s\n' "$added" | sed 's/^\([^ ]\)/    \1/'
done

slice() { # reads the file on stdin; prints the one-line branch of TabStaff
  tr -d '\015' | awk '
    /^export function TabStaff\(/ {inb=1}
    inb && /^  return \($/ {buf=""; cap=1}
    inb && cap {buf = buf $0 "\n"}
    inb && /^}$/ {print buf; exit}
  '
}
f=src/components/tab/TabStaff.tsx
a="$(git show main:$f | slice | cksum)"
b="$(slice < $f | cksum)"
if [ "$a" = "$b" ] && [ "$a" != "$(echo | cksum)" ]; then echo "zero diff  $f (one-line branch)"; else echo "CHANGED $f (one-line branch)"; status=1; fi
exit $status
