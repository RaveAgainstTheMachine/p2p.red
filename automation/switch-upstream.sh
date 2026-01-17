#!/bin/bash

set -euo pipefail

# Switch traffic between blue/green environments
UPSTREAM_TARGET=${1:-blue}

echo "🔄 Switching Nginx upstream to: $UPSTREAM_TARGET"

# Update nginx configuration
sed -i "s/server p2p-app-.*:3000;/server p2p-app-$UPSTREAM_TARGET:3000;/g" nginx.blue-green.conf

# Copy to production location
cp nginx.blue-green.conf nginx.conf

echo "✅ Upstream switched to $UPSTREAM_TARGET"
echo "🔄 Reloading Nginx..."

# Reload nginx (if running in container)
if docker ps | grep -q "p2p-nginx"; then
    docker exec p2p-nginx nginx -s reload
    echo "✅ Nginx reloaded"
else
    echo "⚠️  Nginx container not running - manual reload required"
fi
