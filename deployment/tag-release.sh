#!/usr/bin/env bash
# Tags origin/main's current tip with the next semantic version and pushes
# the tag. Only ever tags origin/main - never a local-only commit or another
# branch - since deploy.sh only trusts tags reachable from origin/main.
#
# Usage: ./tag-release.sh [patch|minor|major]
#   Defaults to a patch bump. Existing tags must look like vX.Y.Z (the
#   pre-existing "v.0.1.0" tag, with its stray dot, predates this convention
#   and is ignored by the version lookup below).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUMP="${1:-patch}"

case "$BUMP" in
  patch|minor|major) ;;
  *) echo "Usage: $0 [patch|minor|major]" >&2; exit 1 ;;
esac

cd "$REPO_ROOT"

echo "==> Fetching origin"
git fetch --tags origin main >/dev/null

MAIN_SHA=$(git rev-parse origin/main)
MAIN_SUBJECT=$(git log -1 --format=%s "$MAIN_SHA")

LATEST_TAG=$(git tag -l 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | head -1)
if [ -z "$LATEST_TAG" ]; then
  LATEST_TAG="v0.0.0"
fi

IFS='.' read -r MAJOR MINOR PATCH <<< "${LATEST_TAG#v}"
case "$BUMP" in
  patch) PATCH=$((PATCH + 1)) ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
esac
GENERATED_VERSION="${MAJOR}.${MINOR}.${PATCH}"

# version.json at origin/main HEAD (the same ref being tagged) must already
# reflect at least this bump - otherwise check-version-unique.sh would just
# block the deploy of whatever this tag builds anyway, so catch it here
# instead of at deploy time.
JSON_VERSION="$(git show "$MAIN_SHA:version.json" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf-8')).version")"
JSON_VERSION="${JSON_VERSION#v}"

# True if $1 >= $2, both "MAJOR.MINOR.PATCH" - plain string/lexicographic
# comparison breaks on e.g. "0.3.10" vs "0.3.9", so compare numerically.
version_ge() {
  local a_major a_minor a_patch b_major b_minor b_patch
  IFS='.' read -r a_major a_minor a_patch <<< "$1"
  IFS='.' read -r b_major b_minor b_patch <<< "$2"
  [ "$a_major" -gt "$b_major" ] && return 0
  [ "$a_major" -lt "$b_major" ] && return 1
  [ "$a_minor" -gt "$b_minor" ] && return 0
  [ "$a_minor" -lt "$b_minor" ] && return 1
  [ "$a_patch" -ge "$b_patch" ]
}

if version_ge "$JSON_VERSION" "$GENERATED_VERSION"; then
  NEW_TAG="v${JSON_VERSION}"
else
  echo "Update version.json" >&2
  echo "version.json is at $JSON_VERSION (at origin/main), but the next $BUMP release is $GENERATED_VERSION." >&2
  exit 1
fi

if git rev-parse "$NEW_TAG" >/dev/null 2>&1; then
  echo "Error: tag $NEW_TAG already exists." >&2
  exit 1
fi

echo "Latest tag:      $LATEST_TAG"
echo "origin/main HEAD: $MAIN_SHA ($MAIN_SUBJECT)"
echo "version.json:     $JSON_VERSION"
echo "Bump:             $BUMP"
echo "New tag:          $NEW_TAG"
echo

read -r -p "Tag origin/main HEAD as $NEW_TAG and push? [y/N] " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Aborted."
  exit 1
fi

git tag -a "$NEW_TAG" "$MAIN_SHA" -m "$NEW_TAG"
git push origin "$NEW_TAG"
echo "==> Tagged and pushed $NEW_TAG"
