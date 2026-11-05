#!/usr/bin/env bash
# INV-037: can scripts/untouched-by-reading.sh fail? T074 widened it to let three timeouts through, so this tampers
# with a throwaway worktree in each way that must stay red, and each way the plan allows, and reads the exit code.
# It never touches the repo's own tree. From the repo root:
#   bash specs/006-reading-aids/review-probes/INV-037-the-guard-can-fail.sh
set -u
root="$(cd "$(dirname "$0")/../../.." && pwd)"
tree="$(mktemp -d)/guard"
git -C "$root" worktree add --quiet --detach "$tree" HEAD < /dev/null || exit 2
trap 'git -C "$root" worktree remove --force "$tree"' EXIT
cp "$root/scripts/untouched-by-reading.sh" "$tree/scripts/untouched-by-reading.sh"
cd "$tree" || exit 2
t=src/lib/tab/__tests__
three=("$t/review-damaged-notation-string.test.ts" "$t/review-every-cell-of-a-system.test.ts" "$t/review-redraw-ledger.test.ts")
wrong=0

check() { # name, wanted exit
  bash scripts/untouched-by-reading.sh > /dev/null 2>&1 < /dev/null
  got=$?
  if [ "$got" = "$2" ]; then printf 'ok      exit %s  %s\n' "$got" "$1"; else printf 'WRONG   exit %s, wanted %s  %s\n' "$got" "$2" "$1"; wrong=$((wrong + 1)); fi
  git checkout -q -- src
  git clean -fdq src
}

check "control: the tree as committed" 0
for f in "${three[@]}"; do
  sed -i '0,/\.toBe(/s//.not.toBe(/;0,/\.toEqual(/s//.not.toEqual(/' "$f"
  check "a changed assertion in $(basename "$f")" 1
  sed -i '0,/^  *expect(/{/^  *expect(/d}' "$f"
  check "an assertion deleted from $(basename "$f")" 1
  sed -i 's/testTimeout: 120_000/testTimeout: 1/' "$f"
  check "the timeout changed in $(basename "$f")" 1
done
for f in "$t/round-trip.test.ts" "$t/single-owner.test.ts"; do
  printf '\n// a new line\n' >> "$f"
  check "a new line in $(basename "$f")" 1
done
printf 'export {};\n' > "$t/review-new.test.ts"
check "a new untracked file in the directory" 1
git rm -q --cached "$t/round-trip.test.ts" && rm "$t/round-trip.test.ts"
bash scripts/untouched-by-reading.sh > /dev/null 2>&1 < /dev/null
got=$?
git reset -q -- "$t" && git checkout -q -- "$t"
if [ "$got" = 1 ]; then printf 'ok      exit 1  a file deleted from the directory\n'; else printf 'WRONG   exit %s, wanted 1  a file deleted\n' "$got"; wrong=$((wrong + 1)); fi

# Fence paths the same way, one per entry in plan.md's list that a diff can reach.
for f in src/lib/tab/ascii.ts src/lib/sync/protocol.ts src/lib/server/sync.ts src/lib/model.ts src/lib/local/mutate.ts src/lib/export/__tests__/text.test.ts src/components/ui/index.tsx public/sw.js src/app/layout.tsx; do
  if [ -f "$f" ]; then
    printf '\n// a new line\n' >> "$f"
    check "a new line in $f" 1
  else
    printf 'SKIP    %s is not there\n' "$f"
  fi
done

printf '%s wrong\n' "$wrong"
exit "$wrong"
