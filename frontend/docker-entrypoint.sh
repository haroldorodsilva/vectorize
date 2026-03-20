#!/bin/sh
# Substitui o placeholder pela URL real do backend
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
sed -i "s|BACKEND_PLACEHOLDER|${BACKEND_URL}|g" /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
