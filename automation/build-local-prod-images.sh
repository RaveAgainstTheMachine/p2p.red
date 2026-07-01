#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_P2P_HOST=${LOCAL_P2P_HOST:-<ip>}
LOCAL_HTTPS_PORT=${LOCAL_HTTPS_PORT:-8443}
APP_VERSION="$(node -p "require('$REPO_ROOT/package.json').version")"
BUILD_TIMESTAMP="$(date -u +%Y%m%d%H%M%S)"
BUILD_VERSION="${APP_VERSION}-local-${BUILD_TIMESTAMP}"

build_app_image() {
  local color="$1"

  if [ "$color" != "blue" ] && [ "$color" != "green" ]; then
    echo "❌ Invalid color '$color' (expected blue or green)."
    exit 1
  fi

  echo "🐳 Building local-prod app image for $color..."
  npm run build
  echo "📦 Copying download bridge assets into dist"
  mkdir -p dist/download-bridge
  cp -f public/download-bridge/bridge dist/download-bridge/bridge
  cp -f public/download-bridge/bridge.html dist/download-bridge/bridge.html
  cp -f public/download-bridge/bridge.js dist/download-bridge/bridge.js
  cp -f public/download-bridge/sw.js dist/download-bridge/sw.js

  docker build \
    -f "$REPO_ROOT/Dockerfile" \
    --build-arg "VITE_BUILD_VARIANT=$color" \
    --build-arg "VITE_BUILD_VERSION=$BUILD_VERSION" \
    --build-arg "VITE_API_URL=https://${LOCAL_P2P_HOST}:${LOCAL_HTTPS_PORT}" \
    --build-arg "VITE_ADMIN_API_URL=https://${LOCAL_P2P_HOST}:${LOCAL_HTTPS_PORT}" \
    --build-arg "VITE_PEERJS_HOST=${LOCAL_P2P_HOST}" \
    --build-arg "VITE_PEERJS_PORT=${LOCAL_HTTPS_PORT}" \
    --build-arg "VITE_PEERJS_SECURE=true" \
    --build-arg "VITE_PEERJS_PATH=/" \
    -t "p2p-app-$color:local" \
    "$REPO_ROOT"
}

build_app_image blue
build_app_image green

echo "🐳 Building metadata-api image..."
docker build -f "$REPO_ROOT/metadata-api/Dockerfile" -t p2p-metadata-api:latest "$REPO_ROOT/metadata-api"

echo "🐳 Building peerjs image..."
docker build -f "$REPO_ROOT/Dockerfile.peerjs" -t p2p-peerjs:latest "$REPO_ROOT"

echo "✅ Local prod-parity images ready"
