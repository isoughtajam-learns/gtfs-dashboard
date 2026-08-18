#!/bin/sh
# Runs automatically before nginx starts (official nginx image convention:
# every executable script in /docker-entrypoint.d/ runs in lexical order).
# Numbered 15- so it runs before the image's own 20-envsubst-on-templates.sh,
# since promoting ssl.conf.template below needs to happen first for that
# script to pick it up.
#
# TLS_CERT/TLS_KEY only exist as env vars in the production ECS task (see
# ../gtfs-realtime's deployment/main.tf, frontend_secrets) - local dev and
# any other environment without them get exactly the pre-TLS behavior, since
# the 443 server block never gets promoted into /etc/nginx/templates/ at all.
set -e

if [ -n "$TLS_CERT" ] && [ -n "$TLS_KEY" ]; then
    mkdir -p /etc/nginx/certs
    printf '%s' "$TLS_CERT" > /etc/nginx/certs/origin.pem
    printf '%s' "$TLS_KEY" > /etc/nginx/certs/origin.key
    cp /etc/nginx/ssl.conf.template.available /etc/nginx/templates/ssl.conf.template
fi
