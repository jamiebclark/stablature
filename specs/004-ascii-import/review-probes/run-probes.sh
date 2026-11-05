#!/usr/bin/env bash
# Re-run every review probe for 004-ascii-import. From the repo root:
#   npm run build && specs/004-ascii-import/review-probes/run-probes.sh
# Run it in the foreground. Each stage exits non-zero on a failed probe, and the script carries on
# so one violated invariant doesn't hide the rest. PROBE_PORT and PROBE_MATCH pass through.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
cd "$root"
status=0
"$here/INV-026-against-main.sh" < /dev/null || status=1
"$here/INV-005-can-the-backbone-fail.sh" < /dev/null || status=1
npx vitest run --config "$here/vitest.probes.config.mts" < /dev/null || status=1
npx playwright test --config "$here/playwright.probes.config.ts" --reporter=line --workers=6 < /dev/null || status=1
exit $status
