#!/usr/bin/env bash
# Review round 4: is the `click-timing.spec.ts` "INV-022 500 rows landing mid-run, and the whole play view drawn again"
# failure ("Stopped because the click could not keep time.") this branch's, or main's too?
#
# Builds two exports in temp dirs, each with its own `npm ci` and `next build`, so only the code differs:
# - main: `git archive main` (no worktree, nothing written in the repo);
# - branch: a tar of the working tree (tracked and untracked, without node_modules, .next, .git or test-results).
# Then it runs the one test N times in each, at one worker, against its own `next start`.
#
#   bash specs/013-cards-per-row/review-probes/INV-009-click-timing-main-vs-branch.sh <main|branch|both> [N] [grep] [spec]
#
# Run from the repo root. `prepare` steps are skipped when the export already has a finished build. FRESH=1 redoes them.
set -euo pipefail
WHICH=${1:-both}
N=${2:-6}
GREP=${3:-INV-022 500 rows}
SPEC=${4:-e2e/click-timing.spec.ts}
ROOT=$(pwd)
BASE=${TMPDIR:-/tmp}

prepare() {
  local name=$1 dir=$2
  if [ -n "${FRESH:-}" ] || [ ! -f "$dir/.next/BUILD_ID" ] || [ ! -d "$dir/node_modules" ]; then
    rm -rf "$dir" && mkdir -p "$dir"
    if [ "$name" = main ]; then
      git archive main | tar -x -C "$dir"
    else
      tar --exclude=./node_modules --exclude=./.next --exclude=./.git --exclude=./test-results -cf - . | tar -x -C "$dir"
    fi
    cp .env.local "$dir/.env.local"
    # Its own install: Turbopack will not resolve `next` through a junction to the repo's node_modules.
    (cd "$dir" && npm ci --no-audit --no-fund < /dev/null > install.log 2>&1) || { tail -20 "$dir/install.log"; exit 1; }
    (cd "$dir" && npx next build < /dev/null > build.log 2>&1) || { tail -20 "$dir/build.log"; exit 1; }
  fi
  cat > "$dir/main013.config.ts" <<'EOF'
import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
const PORT = Number(process.env.E2E_PORT ?? 3121);
const baseURL = `http://localhost:${PORT}`;
export default defineConfig({
  ...base,
  reporter: "list",
  use: { ...base.use, baseURL },
  webServer: {
    command: `npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 240_000,
    env: { BETTER_AUTH_URL: baseURL, STABLATURE_TRUSTED_ORIGINS: baseURL, STABLATURE_AUTH_RATE_LIMIT: "off" },
  },
});
EOF
}

run() {
  local name=$1 dir=$2 port=$3
  echo "== $name ($dir)"
  (cd "$dir" && E2E_PORT=$port npx playwright test -c main013.config.ts --project=desktop --workers=1 --repeat-each="$N" "$SPEC" -g "$GREP" < /dev/null 2>&1 |
    grep -E "^\s+[0-9]+ (passed|failed)|could not keep time" | sort | uniq -c) || true
}

for name in main branch; do
  [ "$WHICH" = both ] || [ "$WHICH" = "$name" ] || continue
  dir="$BASE/stablature-$name-013"
  [ -n "${PREPARE_ONLY:-}" ] && { prepare "$name" "$dir"; echo "prepared $dir"; continue; }
  prepare "$name" "$dir"
  run "$name" "$dir" $([ "$name" = main ] && echo 3121 || echo 3123)
done
