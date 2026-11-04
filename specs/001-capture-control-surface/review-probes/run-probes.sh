#!/usr/bin/env bash
# Run every review probe for spec 001 against a fresh production build.
#
#   bash specs/001-capture-control-surface/review-probes/run-probes.sh            # build + all probes
#   bash specs/001-capture-control-surface/review-probes/run-probes.sh --no-build  # reuse .next
#   bash .../run-probes.sh --no-build INV-010                                      # one invariant
#
# Synchronous end to end: the server is started, probed, and stopped inside this
# one command. Never run while a dev server holds the same .next.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
PORT="${PROBE_PORT:-3300}"
cd "$ROOT"

BUILD=1
if [ "${1:-}" = "--no-build" ]; then BUILD=0; shift; fi

echo "== INV-013 (shell) =="
bash "$HERE/INV-013-export-untouched.sh"
INV013=$?

echo "== INV-013 r2 (guard false positive) =="
bash "$HERE/INV-013-r2-guard-false-positive.sh"
INV013R2=$?

echo "== INV-015 (vitest) =="
npx vitest run --config "$HERE/vitest.probes.config.mts" < /dev/null
INV015=$?

if [ "$BUILD" = 1 ]; then
  npm run build < /dev/null || exit 1
fi

npx next start --port "$PORT" < /dev/null > "${TMPDIR:-/tmp}/spec001-probe-server.log" 2>&1 &
SERVER=$!
for _ in $(seq 1 120); do
  curl -sf "http://localhost:$PORT" > /dev/null 2>&1 && break
  sleep 0.5
done

PROBE_PORT="$PORT" npx playwright test --config "$HERE/playwright.probes.config.ts" "$@" < /dev/null
E2E=$?

kill "$SERVER" 2>/dev/null
# next start forks; make sure nothing keeps the port.
if command -v taskkill > /dev/null 2>&1; then
  PID=$(netstat -ano 2>/dev/null | grep ":$PORT " | grep LISTENING | awk '{print $NF}' | head -1)
  [ -n "${PID:-}" ] && taskkill //PID "$PID" //F > /dev/null 2>&1
fi

echo "INV-013=$INV013 INV-013r2=$INV013R2 INV-015=$INV015 playwright=$E2E"
[ "$INV013" = 0 ] && [ "$INV013R2" = 0 ] && [ "$INV015" = 0 ] && [ "$E2E" = 0 ]
