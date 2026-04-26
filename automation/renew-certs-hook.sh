#!/bin/bash

# 🔐 P2P File Share - Automated Cert Renewal Hook
# This script converts Let's Encrypt PEM certs to PKCS12 (.p12) for Envoy
# and moves them to the Snap Docker accessible path.

set -euo pipefail

DOMAINS=("p2p.red" "signal.p2p.red" "plausible.p2p.red" "dash.p2p.red")
PASSWORD="p2pred"
TARGET_DIR="/var/snap/docker/common/p2p-envoy-certs"
LE_DIR="/etc/letsencrypt/live"

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
            
        sudo chmod 644 "$TARGET_DIR/$DOMAIN.p12"
        echo "✅ $DOMAIN.p12 updated in $TARGET_DIR"
    else
        echo "⚠️  Certs for $DOMAIN not found in $LE_DIR, skipping."
    fi
done

# Restart Envoy to pick up new certs
# In Snap Docker, 'docker restart' is reliable for reloading volumes
echo "🔄 Restarting Envoy container..."
sudo docker restart p2p-envoy

echo "✨ Cert renewal hook completed successfully."
