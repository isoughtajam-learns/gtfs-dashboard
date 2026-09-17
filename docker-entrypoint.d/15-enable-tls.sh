#!/bin/sh
# Runs automatically before nginx starts (official nginx image convention:
# every executable script in /docker-entrypoint.d/ runs in lexical order).
# Numbered 15- so it runs before the image's own 20-envsubst-on-templates.sh,
# since promoting ssl.conf.template below needs to happen first for that
# script to pick it up.
#
# The cert is obtained by certbot running on the EC2 host itself, outside
# this container - see ../deployment/main.tf's "letsencrypt" volume and the
# deployment runbook for the one-time SSH/certbot setup. /etc/letsencrypt is
# bind-mounted read-only from the host, so a container boot before certbot's
# first successful `certonly` run just skips the 443 block below and serves
# HTTP-only - the same graceful-skip behavior this script has always had,
# and exactly what local dev (no such mount) gets too.
set -e

CERT_DIR="/etc/letsencrypt/live/irltransit.com"
if [ -f "$CERT_DIR/fullchain.pem" ] && [ -f "$CERT_DIR/privkey.pem" ]; then
    cp /etc/nginx/ssl.conf.template.available /etc/nginx/templates/ssl.conf.template
fi
