#!/bin/bash

# 🛡️ P2P Health Sentinel
# Monitors <domain> health and notifies Discord via Webhook.

set -euo pipefail

# Configuration
SITE_URL="https://<domain>"
HEALTH_URL="${SITE_URL}/api/status"
WEBHOOK_URL="https://discord.com/api/webhooks/1503302114011512833/krlj4zgaRfJMiub601h1Jeaxjer4Pewv6VBVCtU2BCFfIFX0qVMR0SLvrKEbVYJmB_rm"
STATE_FILE="/tmp/p2p_health_state"
PROD_IP="<ip>"
ENVOY_ADMIN_URL="http://<ip>:9901"

# Colors for Discord embeds
COLOR_DOWN=15548997 # Red
COLOR_UP=5763719    # Green

send_discord() {
    local color=$1
    local title=$2
    local description=$3
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    curl -sS -H "Content-Type: application/json" \
        -X POST \
        -d "{
            \"embeds\": [{
                \"title\": \"$title\",
                \"description\": \"$description\",
                \"color\": $color,
                \"timestamp\": \"$timestamp\",
                \"footer\": { \"text\": \"P2P Health Sentinel\" }
            }]
        }" "$WEBHOOK_URL" > /dev/null
}

check_envoy_health() {
    # This part runs on the prober host.
    # If it can reach the prod VPS via SSH, it can get more details.
    # For now, we'll try to reach the status API.
    
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$HEALTH_URL" || echo "000")
    
    echo "$http_code"
}

# Ensure state file exists
if [ ! -f "$STATE_FILE" ]; then
    echo "up" > "$STATE_FILE"
fi

CURRENT_STATE=$(cat "$STATE_FILE")
HTTP_CODE=$(check_envoy_health)

if [ "$HTTP_CODE" != "200" ]; then
    if [ "$CURRENT_STATE" = "up" ]; then
        echo "🚨 Site is DOWN (HTTP $HTTP_CODE)"
        
        # Try to get more info if we are on a host that can reach Envoy
        DETAIL="Site $SITE_URL is unreachable or returned HTTP $HTTP_CODE."
        if [ "$HTTP_CODE" = "503" ]; then
            DETAIL="$DETAIL Likely 'No Healthy Upstream' in Envoy."
        fi
        
        send_discord "$COLOR_DOWN" "🚨 Critical Outage Detected" "$DETAIL"
        echo "down" > "$STATE_FILE"
    fi
else
    if [ "$CURRENT_STATE" = "down" ]; then
        echo "✅ Site is BACK UP"
        send_discord "$COLOR_UP" "✅ Service Restored" "Site $SITE_URL is now responding with HTTP 200."
        echo "up" > "$STATE_FILE"
    fi
fi
