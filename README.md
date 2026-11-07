# gtfs-dashboard

A web application exploring [GTFS realtime](https://gtfs.org/documentation/realtime/reference/) data using:
- Vite + React + Typescript
- Material UI
- Oxlint

Its companion [gtfs-realtime]() is required to consume realtime events over gRPC and relay them via SSE.

### Local Development
If you haven't set up [gtfs-realtime]() do that first.

Set the following environment variables:
```
npm install
export LOCAL_API_URL=http://127.0.0.1:8000
npm run dev
```
Navigate to [localhost:8080](localhost:8080).

### Local Docker Development
If you haven't set up [gtfs-realtime]() do that first.

```
docker compose up --build --watch
```
Navigate to [localhost:5173](localhost:5173)

Runs the Vite dev server in the container with the repo bind-mounted, so any change under
`gtfs-dashboard/` hot-reloads immediately. The `--watch` flag additionally rebuilds the image
(and reinstalls dependencies) automatically whenever `package.json`/`package-lock.json` change —
without it, `docker compose up --build` alone won't notice a dependency change after the container
is already running.

### Production Deployment (HTTPS behind Cloudflare)
Production runs on ECS (see [gtfs-realtime](../gtfs-realtime)'s `deployment/main.tf`), not
`docker-compose.yml` — that file is for local Docker dev only.

The frontend image itself is deployment-target agnostic: it serves plain HTTP on port 80 unless the
`TLS_CERT`/`TLS_KEY` env vars are present at container startup, in which case
`docker-entrypoint.d/15-enable-tls.sh` writes them to `/etc/nginx/certs/` and enables a `listen 443 ssl`
block (`nginx.ssl.conf.template`) alongside the existing port-80 one. In production, the ECS task
definition injects those two env vars from Secrets Manager (`frontend_secrets` in `main.tf`) — a
Cloudflare Origin Certificate, provisioned once via Cloudflare dashboard → SSL/TLS → Origin Server →
Create Certificate, then stored in Secrets Manager (not committed anywhere). Local Docker dev never
sets those env vars, so it's unaffected and stays HTTP-only on port 80.

This only matters if the domain is proxied through Cloudflare (orange-clouded) with SSL/TLS mode set to
"Full" or "Full (strict)" — that mode requires Cloudflare's edge to reach the origin over HTTPS on 443,
which needs both port 443 open in the EC2 security group and this TLS setup in place, or it 522s.

#### Releasing a new version

Releases are cut from `version.json` and a `vX.Y.Z` git tag, then rolled out by `deployment/deploy.sh`.
There's no CI for any of this — it's all run by hand from a machine with `aws`, `docker`, and
`terraform` set up against this stack's AWS account/region (`us-east-2` by default — see
`deployment/variables.tf`), with `../gtfs-realtime/deployment` already applied (this stack looks up
that stack's ECS cluster/execution role/secrets by name, not by state reference).

1. **Bump `version.json`** to the version you intend to release (e.g. `"0.5.0"` for a minor release,
   `"1.0.0"` for a major one), in the same PR as the change being released (or a small follow-up PR)
   targeting `main`. This is the actual version number that ends up tagged — the bump type you pass in
   step 3 is only a sanity check against it, not what sets the number.
2. **Merge that PR to `main`.** `tag-release.sh` only ever tags `origin/main`'s current tip (never a
   local-only commit or another branch), so the bump has to be merged and pushed first.
3. **Tag the release**, from the repo root:
   ```
   ./deployment/tag-release.sh [patch|minor|major]
   ```
   Defaults to `patch` if you omit the argument. It fetches `origin/main`, computes what the next
   `patch`/`minor`/`major` version would be from the latest `vX.Y.Z` tag, and checks that `version.json`
   at `origin/main`'s tip is at least that version:
   - `patch` — a bug fix or small change, e.g. `0.4.0` → `0.4.1`.
   - `minor` — a new feature or enhancement that doesn't break anything, e.g. `0.4.0` → `0.5.0`.
   - `major` — a breaking change, e.g. `0.4.0` → `1.0.0`.

   If `version.json` wasn't bumped far enough for the type you asked for, it errors out and tells you
   to update `version.json` instead of tagging the wrong thing. Otherwise it prints what it's about to
   do and asks to confirm (`Tag origin/main HEAD as vX.Y.Z and push? [y/N]`) before tagging and pushing.
4. **Deploy the tag**, from the repo root:
   ```
   ./deployment/deploy.sh          # deploys the latest vX.Y.Z tag reachable from origin/main
   ./deployment/deploy.sh v0.5.0   # or deploy a specific tag
   ```
   This refuses to deploy a tag that isn't reachable from `origin/main` (never an unmerged/unreviewed
   commit) or whose `version.json` value has already been shipped before (`scripts/check-version-unique.sh`
   — catches a forgotten bump), then:
   - logs in to ECR,
   - builds the frontend image **from the tag itself** (`git archive $TAG`, never your local working
     tree — so uncommitted/unpushed local changes can't accidentally ship),
   - pushes the image,
   - runs `terraform plan` with that tag as `frontend_image_tag` and shows you the plan,
   - prompts to confirm (`Apply this plan and roll out frontend $TAG? [y/N]`) before applying and
     rolling out the ECS service.
5. Once applied, the script prints the dashboard URL (`terraform output -raw app_url`) — load it and
   confirm the new version is live before considering the release done.

## Appreciation
https://gtfs.org/documentation/overview/ - details on the spec for Realtime and Schedule data, both of which are used here

https://mobilitydatabase.org - info about many available GTFS feeds from around the world

*Powered by coffee, Claude, Google Antigravity, and Jetbrains*