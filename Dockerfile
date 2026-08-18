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
