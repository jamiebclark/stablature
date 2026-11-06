#!/usr/bin/env bash
# The e2e suite on Linux Chrome, which is what CI runs and what no local run here can show: Windows positions glyphs at
# subpixel precision and Linux rounds them (T183). Everything happens in Docker, over a copy, so the working tree is
# only read. Postgres is a throwaway built the way ci.yml builds it.
#
#   bash specs/007-usability-pass/review-probes/INV-016-linux-chrome.sh setup
#   bash specs/007-usability-pass/review-probes/INV-016-linux-chrome.sh suite 'e2e[\/]usability-sta[^\/]*\.spec\.ts$' 6
#   bash specs/007-usability-pass/review-probes/INV-016-linux-chrome.sh probes 'INV-016[^\/]*\.spec\.ts$' 6
#   bash specs/007-usability-pass/review-probes/INV-016-linux-chrome.sh teardown
#
# `suite` and `probes` take any further Playwright arguments after the worker count. Stdin is closed, so nothing can wait.
set -u
export MSYS_NO_PATHCONV=1

IMAGE=mcr.microsoft.com/playwright:v1.64.1-noble
NET=spec007-linux
PG=spec007-linux-pg
VOL=spec007-linux-work
ROOT=$(cd "$(dirname "$0")/../../.." && { pwd -W 2>/dev/null || pwd; })

# ci.yml's env, with the database's host swapped for the throwaway's name.
ENVS=(
  -e STABLATURE_DATABASE_URL=postgres://stablature:stablature@$PG:5432/stablature
  -e BETTER_AUTH_SECRET=ci-secret-not-used-anywhere-real
  -e BETTER_AUTH_URL=http://localhost:3100
  -e NEXT_TELEMETRY_DISABLED=1
)

in_box() {
  docker run --rm --init --ipc=host --network "$NET" "${ENVS[@]}" "${EXTRA[@]}" -v "$VOL:/work" -w /work "$IMAGE" bash -c "$1" < /dev/null
}

case "${1:-}" in
  setup)
    docker network create "$NET" > /dev/null
    docker volume create "$VOL" > /dev/null
    docker run -d --name "$PG" --network "$NET" --tmpfs /var/lib/postgresql/data \
      -e POSTGRES_USER=stablature -e POSTGRES_PASSWORD=stablature -e POSTGRES_DB=stablature \
      -e POSTGRES_INITDB_ARGS="--locale=C --encoding=UTF8" postgres:17-alpine < /dev/null > /dev/null
    until docker exec "$PG" pg_isready -U stablature -d stablature > /dev/null 2>&1; do :; done
    EXTRA=(-v "$ROOT:/src:ro")
    # .env* stay behind: both Playwright configs load .env.local over the environment.
    in_box 'set -e
      tar -C /src --exclude=./node_modules --exclude=./.next --exclude=./test-results --exclude=./.git \
        --exclude=./.env --exclude=./.env.local --exclude=./tsconfig.tsbuildinfo --exclude=./dev.log -cf - . | tar -C /work -xf -
      node --version; npm ci --no-audit --no-fund 2>&1 | tail -2
      npm run db:migrate 2>&1 | tail -1
      npm run build 2>&1 | tail -4
      grep -oh -r -e "--chord-ch:[^;}]*" .next/static | sort | uniq -c'
    ;;
  suite | probes)
    EXTRA=(-e "SUITE_MATCH=$2" -e "PROBE_MATCH=$2" -v "$ROOT:/src:ro")
    workers=${3:-6}
    extra_args="${*:4}"
    [ "$1" = suite ] && cfg=playwright.suite.config.ts || cfg=playwright.probes.config.ts
    # The probes are copied each run, so one written after `setup` is here too.
    in_box "cp -r /src/specs/007-usability-pass/review-probes/. specs/007-usability-pass/review-probes/ && npx playwright test -c specs/007-usability-pass/review-probes/$cfg --workers=$workers --reporter=line $extra_args"
    ;;
  control)
    # The replica proves nothing unless the old value fails here as it failed in CI: swap it into the built CSS, run, swap back.
    EXTRA=(-e "SUITE_MATCH=e2e[\\/]usability-sta[^\\/]*\\.spec\\.ts\$")
    in_box 'css=$(grep -l -r -e "--chord-ch:" .next/static --include=*.css)
      sed -i "s/--chord-ch:\.4375rem/--chord-ch:.42rem/" $css
      grep -oh -e "--chord-ch:[^;}]*" $css
      npx playwright test -c specs/007-usability-pass/review-probes/playwright.suite.config.ts --workers=6 --reporter=line
      sed -i "s/--chord-ch:\.42rem/--chord-ch:.4375rem/" $css
      grep -oh -e "--chord-ch:[^;}]*" $css'
    ;;
  teardown)
    docker rm -f "$PG" > /dev/null 2>&1
    docker volume rm "$VOL" > /dev/null 2>&1
    docker network rm "$NET" > /dev/null 2>&1
    ;;
  *)
    echo "usage: $0 setup | suite <match> [workers] [playwright args] | probes <match> [workers] [playwright args] | teardown" >&2
    exit 2
    ;;
esac
