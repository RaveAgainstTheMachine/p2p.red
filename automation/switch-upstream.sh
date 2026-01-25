#!/bin/bash

set -euo pipefail

# Switch traffic between blue/green environments via Envoy
UPSTREAM_TARGET=${1:-blue}
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🔄 Switching Envoy traffic to: $UPSTREAM_TARGET"

if [ "$UPSTREAM_TARGET" = "blue" ]; then
    "$REPO_ROOT/automation/envoy-shift-traffic.sh" 100 0
elif [ "$UPSTREAM_TARGET" = "green" ]; then
    "$REPO_ROOT/automation/envoy-shift-traffic.sh" 0 100
else
    echo "❌ Invalid target '$UPSTREAM_TARGET' (expected blue or green)."
    exit 1
fi

echo "✅ Envoy traffic shifted to $UPSTREAM_TARGET"
