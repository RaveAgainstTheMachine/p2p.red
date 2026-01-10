#!/bin/bash

# P2P File Share - Force Cache Clear Script
# Usage: ./force-cache-clear.sh

set -e

echo "🗂️  P2P File Share - Force Cache Clear"
echo "==================================="

# Clear nginx-https cache completely
echo "🗂️  Clearing nginx-https cache..."
sudo docker exec nginx-https sh -c "rm -rf /var/cache/nginx/* /tmp/nginx_*" 2>/dev/null || true

# Restart nginx-https to ensure fresh cache
echo "🔄 Restarting nginx-https..."
sudo docker restart nginx-https

# Wait for restart
echo "⏳ Waiting for restart..."
sleep 5

# Verify cache headers are working
echo "🔍 Verifying cache headers..."
CACHE_HEADERS=$(curl -I https://p2p.red 2>/dev/null | grep -i cache)

if echo "$CACHE_HEADERS" | grep -q "no-cache"; then
    echo "✅ Cache headers working:"
    echo "$CACHE_HEADERS"
else
    echo "⚠️  Cache headers not detected"
fi

echo ""
echo "🌐 Visit https://p2p.red with Ctrl+F5"
