#!/usr/bin/env bash
# Builds, pushes, and rolls out the frontend service, from a tag reachable
# from THIS repo's origin/main - never the local working tree. This stack
# owns only the frontend - the backend/celery-worker/celery-beat
# (../gtfs-realtime) are a fully independent Terraform stack now, sharing
# only the ECS cluster/execution role/EC2 instance by name lookup, not by
# state reference. Deploying here never touches them.
#
# Usage: ./deploy.sh [tag]
#   tag defaults to this repo's latest vX.Y.Z tag reachable from origin/main.
#   Cut one first with ./tag-release.sh if you haven't.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REQUESTED_TAG="${1:-}"

cd "$REPO_ROOT"
echo "==> Fetching origin"
git fetch --tags origin main >/dev/null

TAG="$REQUESTED_TAG"
if [ -z "$TAG" ]; then
  TAG=$(git tag -l 'v[0-9]*.[0-9]*.[0-9]*' --sort=-v:refname | head -1)
  if [ -z "$TAG" ]; then
    echo "Error: no vX.Y.Z tags found - cut one with ./tag-release.sh first." >&2
    exit 1
  fi
fi
if ! git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: tag $TAG does not exist." >&2
  exit 1
fi
if ! git merge-base --is-ancestor "${TAG}^{commit}" origin/main; then
  echo "Error: $TAG is not reachable from origin/main - refusing to deploy an unmerged/unreviewed commit." >&2
  exit 1
fi
echo "==> Checking version.json is unique at $TAG"
"$SCRIPT_DIR/../scripts/check-version-unique.sh" "$TAG"

echo "==> Deploying frontend $TAG"

cd "$SCRIPT_DIR"
REPO_URL=$(terraform output -raw frontend_ecr_repository_url)
REGION=$(terraform output -raw aws_region)

echo "==> Logging in to ECR ($REGION)"
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "${REPO_URL%%/*}"

echo "==> Building frontend $REPO_URL:$TAG (from tag $TAG, not the working tree)"
git -C "$REPO_ROOT" archive "$TAG" | docker build -t "$REPO_URL:$TAG" -

echo "==> Pushing image"
docker push "$REPO_URL:$TAG"

echo "==> Planning infrastructure update"
terraform plan -input=false -var="frontend_image_tag=$TAG" -out=tfplan

read -r -p "Apply this plan and roll out frontend $TAG? [y/N] " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Aborted (image was already pushed to ECR, nothing was deployed)."
  rm -f tfplan
  exit 1
fi

terraform apply -input=false tfplan
rm -f tfplan

echo "==> Dashboard: $(terraform output -raw app_url)"
echo "==> Deployed frontend $TAG"
