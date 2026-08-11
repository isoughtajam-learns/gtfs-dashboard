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

## Appreciation
https://gtfs.org/documentation/overview/ - details on the spec for Realtime and Schedule data, both of which are used here

https://mobilitydatabase.org - info about many available GTFS feeds from around the world

*Powered by coffee, Claude, Google Antigravity, and Jetbrains*