# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Vite application
RUN npm run build

# Dev stage: hot-reloading Vite dev server for local Docker development
# (docker-compose.yml's `frontend` service targets this, not the default
# final stage below - `docker build .` / deploy.sh are unaffected).
# node_modules is a named volume in compose (not the bind-mounted source),
# since the host's node_modules (e.g. built for macOS) isn't binary-compatible
# with this Alpine/Linux image - `npm install` at container start reconciles
# that volume against whatever package.json currently says, every start.
# (`npm install`, not `ci`: this package-lock.json has platform-specific
# optional deps that differ between macOS and Linux, and each platform's own
# `npm install` self-heals its side - `ci`'s strict exact-match check just
# fights that back and forth. This can touch the bind-mounted lockfile on
# container start, which is why docker-compose.yml's watch config only
# triggers a rebuild on package.json, not package-lock.json - otherwise that
# write would trigger another rebuild, forever.)
FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
EXPOSE 5173
CMD ["sh", "-c", "npm install && npm run dev -- --host 0.0.0.0"]

# Production stage
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy the custom nginx configuration template
# The nginx image automatically runs envsubst on files in /etc/nginx/templates/
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Staged outside /etc/nginx/templates/ so it's not auto-processed; promoted
# there at container startup only when TLS_CERT/TLS_KEY are actually present
# (see docker-entrypoint.d/15-enable-tls.sh), so an image without those env
# vars set behaves exactly as it did before TLS support existed.
COPY nginx.ssl.conf.template /etc/nginx/ssl.conf.template.available
COPY docker-entrypoint.d/15-enable-tls.sh /docker-entrypoint.d/15-enable-tls.sh
RUN chmod +x /docker-entrypoint.d/15-enable-tls.sh

# Copy the build output from the build stage to nginx's web root
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80 and 443; the 443 listener only comes up if the TLS
# env vars are present at startup (see docker-entrypoint.d/15-enable-tls.sh)
EXPOSE 80 443

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
