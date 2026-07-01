#!/bin/bash

set -euo pipefail

LOCAL_P2P_HOST=${LOCAL_P2P_HOST:-<ip>}
LOCAL_HTTPS_PORT=${LOCAL_HTTPS_PORT:-8443}
LOCAL_ENVOY_ADMIN_PORT=${LOCAL_ENVOY_ADMIN_PORT:-9901}

BASE_URL="https://${LOCAL_P2P_HOST}:${LOCAL_HTTPS_PORT}"

fail() {
  echo "❌ $*" >&2
  exit 1
}

if ! curl -fsS "http://<ip>:${LOCAL_ENVOY_ADMIN_PORT}/ready" >/dev/null; then
  fail "Envoy admin not ready on <ip>:${LOCAL_ENVOY_ADMIN_PORT}"
fi

echo "✅ Envoy admin ready"

if ! curl -fsSk "${BASE_URL}/" >/dev/null; then
  echo "⚠️ ${BASE_URL} unreachable. If running in Windsurf, ensure port 8443 is forwarded." >&2
  exit 1
fi

echo "✅ HTTPS endpoint reachable"

INSECURE=1 ./automation/check-download-bridge.sh "$BASE_URL"

status=$(curl -fsSk "$BASE_URL/api/status" || true)
if [[ -z "$status" ]]; then
  fail "API status empty"
fi

echo "✅ API status OK"
