#!/bin/bash

# 🔐 P2P File Share - Automated Cert Renewal Hook
# This script reloads Envoy after Let's Encrypt renewal.

set -euo pipefail

REPO_ROOT="/opt/p2p-file-share"

echo "🚀 Starting cert renewal hook..."

# Restart Envoy to pick up new certs
echo "🔄 Restarting Envoy container..."
sudo docker restart p2p-envoy

# 📍 Persistence - Restore traffic split from disk via Admin API
echo "📍 Restoring traffic split from disk..."

BLUE_WEIGHT=$(cat "$REPO_ROOT/envoy-runtime/traffic_split/app_blue" 2>/dev/null || echo "100")
GREEN_WEIGHT=$(cat "$REPO_ROOT/envoy-runtime/traffic_split/app_green" 2>/dev/null || echo "0")

echo "🔗 Applying weights: Blue=$BLUE_WEIGHT, Green=$GREEN_WEIGHT"
sleep 2
curl -fsS -X POST "http://<ip>:9901/runtime_modify?traffic_split.app_blue=$BLUE_WEIGHT&traffic_split.app_green=$GREEN_WEIGHT" > /dev/null 2>&1

# 🛡️ Post-Restart Verification
echo "🛡️ Verifying Envoy health..."
sleep 15
# Use domain in URL for SNI, resolve to localhost
if ! curl -4 -k -I "https://p2p.red/health" --resolve "p2p.red:443:<ip>" --fail --connect-timeout 10 >/dev/null 2>&1; then
    echo "❌ CRITICAL: Envoy HTTPS health check failed after renewal!"
    # Debug
    curl -4 -k -v "https://p2p.red/health" --resolve "p2p.red:443:<ip>" --connect-timeout 10 2>&1 | tail -n 20
    exit 1
fi

echo "✨ Cert renewal hook completed successfully."
