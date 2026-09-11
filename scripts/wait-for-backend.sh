#!/bin/sh
# Blocks the dev container's startup until BACKEND_URL responds, so Vite's
# /api proxy doesn't come up racing gtfs-realtime's backend container -
# gtfs-network is an external network shared between two separate
# docker-compose projects, so `docker compose up` here has no way to
# depends_on a service defined in the other project's compose file. Without
# this, every request made before the backend container finishes starting
# fails with "getaddrinfo ENOTFOUND backend" (confirmed live: this is
# exactly what happened when the frontend container came up before
# gtfs-realtime-backend-1 registered on gtfs-network - the proxy self-heals
# once the backend appears, but until then every fetch call in the app,
# including ones with no obvious connection to "the backend" like the
# transit-system dropdown, fails and needs a manual refresh).
#
# POSIX sh, not bash: this runs in node:20-alpine's default shell, which
# doesn't have bash installed (unlike scripts/check-version-unique.sh, a
# deploy-time script that runs on the host).
set -eu

BACKEND_URL="${BACKEND_URL:-}"
TIMEOUT_SECONDS=30
INTERVAL_SECONDS=1

if [ -z "$BACKEND_URL" ]; then
    echo "wait-for-backend: BACKEND_URL not set, skipping"
    exit 0
fi

# /info is app metadata only (name/env/debug) - no DB or upstream feed
# access, so it comes up as soon as the backend process itself is
# listening, not gated on Postgres/Redis also being ready.
elapsed=0
until wget -q -O /dev/null "$BACKEND_URL/info" 2>/dev/null; do
    if [ "$elapsed" -ge "$TIMEOUT_SECONDS" ]; then
        echo "wait-for-backend: $BACKEND_URL not reachable after ${TIMEOUT_SECONDS}s, starting anyway"
        exit 0
    fi
    echo "wait-for-backend: waiting for $BACKEND_URL ($elapsed/${TIMEOUT_SECONDS}s)"
    sleep "$INTERVAL_SECONDS"
    elapsed=$((elapsed + INTERVAL_SECONDS))
done

echo "wait-for-backend: $BACKEND_URL is up"
