#!/bin/bash

set -euo pipefail

ENVOY_ADMIN_URL=${ENVOY_ADMIN_URL:-http://127.0.0.1:9901}
ENVOY_RUNTIME_DIR=${ENVOY_RUNTIME_DIR:-/opt/p2p-file-share/envoy-runtime}
RUNTIME_DIR=${ENVOY_RUNTIME_DIR}/traffic_split
BLUE_WEIGHT=${1:-}
GREEN_WEIGHT=${2:-}

usage() {
    echo "Usage: $0 <blue_weight> <green_weight>"
    echo "Example: $0 100 0"
}

if [ -z "$BLUE_WEIGHT" ] || [ -z "$GREEN_WEIGHT" ]; then
    usage
    exit 1
fi

if ! [[ "$BLUE_WEIGHT" =~ ^[0-9]+$ ]] || ! [[ "$GREEN_WEIGHT" =~ ^[0-9]+$ ]]; then
    echo "❌ Weights must be integers."
    exit 1
fi

TOTAL=$((BLUE_WEIGHT + GREEN_WEIGHT))
if [ "$TOTAL" -ne 100 ]; then
    echo "❌ Weights must sum to 100 (got $TOTAL)."
    exit 1
fi

echo "🔀 Setting Envoy traffic weights: blue=$BLUE_WEIGHT green=$GREEN_WEIGHT"

if [ -d "$RUNTIME_DIR" ]; then
    echo "$BLUE_WEIGHT" | sudo tee "$RUNTIME_DIR/app_blue" >/dev/null
    echo "$GREEN_WEIGHT" | sudo tee "$RUNTIME_DIR/app_green" >/dev/null
fi

curl -fsS -X POST "${ENVOY_ADMIN_URL}/runtime_modify?traffic_split.app_blue=${BLUE_WEIGHT}&traffic_split.app_green=${GREEN_WEIGHT}" >/dev/null

echo "✅ Envoy weights updated"
