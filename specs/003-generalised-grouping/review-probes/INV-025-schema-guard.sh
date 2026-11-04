#!/usr/bin/env bash
# INV-025 / FR-008: delete the groupKind line in a scratch copy and tsc must fail in
# assert-model.ts; the same copy unmutated must pass, so the failure means what it says. Then the
# migration holds only CREATE TYPE and ADD COLUMN, and nothing under src/lib/server or src/app/api
# moved. The scratch copy is outside the repo and goes away at the end.
set -u
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
BASE="${BASE:-main}"
cd "$ROOT"
FAIL=0
SCRATCH="$(mktemp -d)"
JUNCTION="$(cygpath -w "$SCRATCH/node_modules")"
cleanup() {
  # A junction must go first and on its own, or the delete would walk into node_modules.
  cmd //c rmdir "$JUNCTION" > /dev/null 2>&1
  rm -rf "$SCRATCH"
}
trap cleanup EXIT

cp -r src e2e "$SCRATCH/"
cp tsconfig.json next-env.d.ts package.json playwright.config.ts drizzle.config.ts "$SCRATCH/" 2>/dev/null
cp vitest.config.* vitest.setup.* "$SCRATCH/" 2>/dev/null
[ -d .next/types ] && mkdir -p "$SCRATCH/.next" && cp -r .next/types "$SCRATCH/.next/types"
cmd //c mklink //J "$JUNCTION" "$(cygpath -w "$ROOT/node_modules")" > /dev/null

run_tsc() { (cd "$SCRATCH" && ./node_modules/.bin/tsc --noEmit -p tsconfig.json < /dev/null); }

CLEAN=$(run_tsc 2>&1); RC=$?
if [ $RC -ne 0 ]; then echo "FAIL: unmutated scratch copy does not typecheck:"; echo "$CLEAN" | head; FAIL=1; fi

sed -i '/groupKind: groupKind("group_kind"),/d' "$SCRATCH/src/db/schema/domain.ts"
MUTATED=$(run_tsc 2>&1); RC=$?
if [ $RC -eq 0 ]; then echo "FAIL: mutation passed tsc"; FAIL=1; fi
if ! echo "$MUTATED" | grep -q "src/db/schema/assert-model.ts"; then
  echo "FAIL: did not name assert-model.ts"; echo "$MUTATED" | head; FAIL=1
fi
echo "$MUTATED" | grep "assert-model" | head -3

SQL=$(cat drizzle/0004_*.sql | tr -d '\r' | sed 's/--> statement-breakpoint//')
echo "$SQL"
if echo "$SQL" | grep -v '^$' | grep -qvE '^(CREATE TYPE|ALTER TABLE "events" ADD COLUMN)'; then
  echo "FAIL: other statements"; FAIL=1
fi

if [ -n "$(git diff "$BASE" -- src/lib/server src/app/api)" ]; then
  echo "FAIL: server or api changed"; FAIL=1
fi
[ "$FAIL" = 0 ] && echo "INV-025 held"
exit $FAIL
