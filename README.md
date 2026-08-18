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
docker compose up --build
```
Navigate to [localhost:5173](localhost:5173)

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

## Appreciation
https://gtfs.org/documentation/overview/ - details on the spec for Realtime and Schedule data, both of which are used here

https://mobilitydatabase.org - info about many available GTFS feeds from around the world

*Powered by coffee, Claude, Google Antigravity, and Jetbrains*