#!/bin/bash

# 🔐 P2P File Share - Automated Cert Renewal Hook
# This script converts Let's Encrypt PEM certs to PKCS12 (.p12) for Envoy
# and moves them to the Snap Docker accessible path.

set -euo pipefail

DOMAINS=("p2p.red" "signal.p2p.red" "plausible.p2p.red" "dash.p2p.red")
PASSWORD="p2pred"
TARGET_DIR="/var/snap/docker/common/p2p-envoy-certs"
LE_DIR="/etc/letsencrypt/live"
REPO_ROOT="/opt/p2p-file-share"

echo "🚀 Starting cert conversion and sync..."

# Ensure target directory exists
sudo mkdir -p "$TARGET_DIR"

for DOMAIN in "${DOMAINS[@]}"; do
    if [ -d "$LE_DIR/$DOMAIN" ]; then
        echo "📦 Processing $DOMAIN..."
        
        # Convert to PKCS12
        # Note: Envoy requires .p12 for the PKCS12 provider used in our config
        sudo openssl pkcs12 -export \
            -in "$LE_DIR/$DOMAIN/fullchain.pem" \
            -inkey "$LE_DIR/$DOMAIN/privkey.pem" \
            -out "$TARGET_DIR/$DOMAIN.p12" \
            -name "$DOMAIN" \
            -passout "pass:$PASSWORD"
            
        sudo chmod 600 "$TARGET_DIR/$DOMAIN.p12"
        echo "✅ $DOMAIN.p12 updated in $TARGET_DIR"
    else
        echo "⚠️  Certs for $DOMAIN not found in $LE_DIR, skipping."
    fi
done

# Restart Envoy to pick up new certs
# In Snap Docker, 'docker restart' is reliable for reloading volumes
echo "🔄 Restarting Envoy container..."
sudo docker restart p2p-envoy

# 📍 Persistence - Restore traffic split from disk via Admin API
echo "📍 Restoring traffic split from disk..."
BLUE_WEIGHT=$(cat "$REPO_ROOT/envoy-runtime/traffic_split/app_blue" 2>/dev/null || echo "100")
GREEN_WEIGHT=$(cat "$REPO_ROOT/envoy-runtime/traffic_split/app_green" 2>/dev/null || echo "0")

echo "🔗 Applying weights: Blue=$BLUE_WEIGHT, Green=$GREEN_WEIGHT"
sleep 2
curl -X POST "http://127.0.0.1:9901/runtime_modify?traffic_split.app_blue=$BLUE_WEIGHT&traffic_split.app_green=$GREEN_WEIGHT" > /dev/null 2>&1

# 🛡️ Post-Restart Verification
echo "🛡️ Verifying Envoy health..."
sleep 15
# Use domain in URL for SNI, resolve to localhost
if ! curl -4 -k -I "https://p2p.red/health" --resolve "p2p.red:443:127.0.0.1" --fail --connect-timeout 10 >/dev/null 2>&1; then
    echo "❌ CRITICAL: Envoy HTTPS health check failed after renewal!"
    # Debug
    curl -4 -k -v "https://p2p.red/health" --resolve "p2p.red:443:127.0.0.1" --connect-timeout 10 2>&1 | tail -n 20
    exit 1
fi

echo "✨ Cert renewal hook completed successfully."
