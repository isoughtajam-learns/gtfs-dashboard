#!/usr/bin/env bash
# Fails if version.json's "version" value (at the given ref, or HEAD) has
# already appeared in this file's git history before - i.e. someone forgot
# to bump it since the last time this exact value was committed. Called by
# deployment/deploy.sh before building/pushing the frontend image, so a
# forgotten version bump blocks the deploy instead of shipping a build
# indistinguishable from whatever's already live.
#
# Reads version.json AT THE REF, not the working tree: deploy.sh builds from
# `git archive "$TAG"`, so this needs to check what's actually being shipped,
# which can differ from whatever's currently checked out locally.
#
# Deliberately not tag-based (see tag-release.sh for the actual release-tag
# flow, a separate concern): this only checks the value itself, not whether
# it was ever tagged/released. A deploy-time git action can unify the two
# later; for now bumping version.json is a manual step alongside tagging.
#
# Usage: ./scripts/check-version-unique.sh [ref]   (ref defaults to HEAD)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REF="${1:-HEAD}"

cd "$REPO_ROOT"

CURRENT_VERSION=$(git show "$REF:version.json" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf-8')).version")
ESCAPED_VERSION=$(printf '%s' "$CURRENT_VERSION" | sed 's/[.]/\\./g')

# Every value the "version" field has ever been set to, across the file's
# full history: each commit that changed it shows a "+" line with the new
# value in unified diff output, so counting matching "+" lines counts how
# many times this exact value has ever been introduced. Matches "version"
# anywhere on an added line (not anchored to line-start) so this isn't
# fragile to compact vs. pretty-printed JSON formatting.
OCCURRENCES="$(git log --all -p -- version.json \
    | grep -cE '^\+.*"version":[[:space:]]*"'"$ESCAPED_VERSION"'"' \
    ; true)"

if [ "$OCCURRENCES" -gt 1 ]; then
    echo "Deploy blocked: version $CURRENT_VERSION (at $REF) already exists in git history for version.json." >&2
    echo "Bump the version in version.json before deploying." >&2
    exit 1
fi

echo "Version check passed: $CURRENT_VERSION (at $REF) is unique."
