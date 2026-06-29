#!/bin/bash

set -euo pipefail

BASE_URL=${1:-http://<ip>:3000}
INSECURE=${INSECURE:-0}

CURL_OPTS=(-fsSL)
if [ "$INSECURE" = "1" ]; then
  CURL_OPTS=(-fsSLk)
fi

fail() {
  echo "❌ $*" >&2
  exit 1
}

status=$(curl "${CURL_OPTS[@]}" -o /dev/null -w "%{http_code}" "$BASE_URL/download-bridge/bridge.html" || true)
if [ "$status" != "200" ]; then
  fail "download bridge endpoint returned HTTP $status"
fi

content_type=$(curl "${CURL_OPTS[@]}" -I "$BASE_URL/download-bridge/bridge.html" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-type"{print $2}' | head -n1)
if [[ "$content_type" != text/html* ]]; then
  fail "download bridge content-type is '$content_type' (expected text/html)"
fi

title=$(curl "${CURL_OPTS[@]}" "$BASE_URL/download-bridge/bridge.html" | tr -d '\r' | awk -F'[<>]' 'tolower($2)=="title"{print $3; exit}')
if [ "$title" != "P2P Download Bridge" ]; then
  fail "download bridge title mismatch ('$title')"
fi

echo "✅ download bridge endpoint OK at $BASE_URL"
