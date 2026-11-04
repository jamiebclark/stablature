#!/usr/bin/env bash
# Re-run every review probe for 003-generalised-grouping. From the repo root:
#   npm run build && specs/003-generalised-grouping/review-probes/run-probes.sh
# Run it in the foreground. Each stage exits non-zero on a failed probe, and the script carries on
# so one violated invariant doesn't hide the rest. PROBE_PORT, PROBE_ROOT and PROBE_MATCH pass through.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
cd "$root"
status=0
"$here/INV-020-exact-suites.sh" < /dev/null || status=1
"$here/INV-025-schema-guard.sh" < /dev/null || status=1
"$here/FR-036-suite-survives-commit.sh" < /dev/null || status=1
npx vitest run --config "$here/vitest.probes.config.mts" < /dev/null || status=1
npx playwright test --config "$here/playwright.probes.config.ts" --reporter=line --workers=6 < /dev/null || status=1
exit $status
