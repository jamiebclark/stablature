#!/usr/bin/env bash
# Run every review probe for spec 002.
#
#   bash specs/002-playing-techniques/review-probes/run-probes.sh             # build + all probes
#   bash specs/002-playing-techniques/review-probes/run-probes.sh --no-build  # reuse .next
#   bash .../run-probes.sh --no-build INV-017                                 # one invariant, browser only
#
# Synchronous end to end: Playwright starts and stops the server itself, on port 3302, over
# the existing .next. Never run while a dev server holds the same .next.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
cd "$ROOT"

BUILD=1
if [ "${1:-}" = "--no-build" ]; then BUILD=0; shift; fi

echo "== INV-001 (shell) =="
bash "$HERE/INV-001-storage-fence.sh"
INV001=$?

echo "== INV-003 (shell) =="
bash "$HERE/INV-003-export-suites-unedited.sh"
INV003=$?

echo "== unit and jsdom probes (vitest) =="
npx vitest run --config "$HERE/vitest.probes.config.mts" < /dev/null
UNIT=$?

if [ "$BUILD" = 1 ]; then
  npm run build < /dev/null || exit 1
fi

echo "== browser probes (playwright) =="
PROBE_MATCH="${1:+$1.*\\.spec\\.ts\$}" npx playwright test --config "$HERE/playwright.probes.config.ts" --reporter=line --workers=6 < /dev/null
E2E=$?

echo "INV-001 shell: $INV001, INV-003 shell: $INV003, vitest: $UNIT, playwright: $E2E"
[ "$INV001" = 0 ] && [ "$INV003" = 0 ] && [ "$UNIT" = 0 ] && [ "$E2E" = 0 ]
