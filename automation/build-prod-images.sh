#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGES_DIR="$REPO_ROOT/images"
APP_VERSION="$(node -p "require('$REPO_ROOT/package.json').version")"
GIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
BUILD_TIMESTAMP="$(date -u +%Y%m%d%H%M%S)"
BUILD_VERSION="${APP_VERSION}-${GIT_SHA}-${BUILD_TIMESTAMP}"

"$REPO_ROOT/automation/preflight.sh" build

mkdir -p "$IMAGES_DIR"

build_app_image() {
    local color="$1"

    if [ "$color" != "blue" ] && [ "$color" != "green" ]; then
        echo "❌ Invalid color '$color' (expected blue or green)."
        exit 1
    fi

    echo "🐳 Building app image for $color..."
    docker build \
        -f "$REPO_ROOT/Dockerfile" \
        --build-arg "VITE_BUILD_VARIANT=$color" \
        --build-arg "VITE_BUILD_VERSION=$BUILD_VERSION" \
        --build-arg "VITE_API_URL=https://p2p.red" \
        --build-arg "VITE_PEERJS_HOST=<signal-domain>" \
        --build-arg "VITE_PEERJS_PORT=443" \
        --build-arg "VITE_PEERJS_SECURE=true" \
        --build-arg "VITE_PEERJS_PATH=/peerjs" \
        -t "p2p-app-$color:latest" \
        "$REPO_ROOT"

    local label
    label=$(docker inspect -f '{{ index .Config.Labels "p2p.build_variant" }}' "p2p-app-$color:latest")
    if [ "$label" != "$color" ]; then
        echo "❌ Build variant mismatch for $color image (label: '$label')."
        exit 1
    fi

    local version_label
    version_label=$(docker inspect -f '{{ index .Config.Labels "p2p.build_version" }}' "p2p-app-$color:latest")
    if [ -z "$version_label" ] || [ "$version_label" = "<no value>" ]; then
        echo "❌ Missing build version label for $color image."
        exit 1
    fi

    docker save -o "$IMAGES_DIR/app-$color.tar" "p2p-app-$color:latest"
}

build_app_image blue
build_app_image green

echo "🐳 Building metadata-api image..."
docker build -f "$REPO_ROOT/metadata-api/Dockerfile" -t p2p-metadata-api:latest "$REPO_ROOT/metadata-api"
docker save -o "$IMAGES_DIR/metadata-api.tar" p2p-metadata-api:latest

echo "🐳 Building peerjs image..."
docker build -f "$REPO_ROOT/Dockerfile.peerjs" -t p2p-peerjs:latest "$REPO_ROOT"
docker save -o "$IMAGES_DIR/peerjs.tar" p2p-peerjs:latest

echo "🐳 Building envoy image..."
docker build -f "$REPO_ROOT/Dockerfile.envoy" -t p2p-envoy:latest "$REPO_ROOT"
docker save -o "$IMAGES_DIR/envoy.tar" p2p-envoy:latest

echo "✅ Images saved to $IMAGES_DIR"

# Tag and push to origin so the release is always recoverable from remote
echo "🔖 Tagging release v${APP_VERSION} and pushing to origin..."
git -C "$REPO_ROOT" tag -f "v${APP_VERSION}" -m "Release v${APP_VERSION} (build: ${BUILD_VERSION})"
git -C "$REPO_ROOT" push origin master
git -C "$REPO_ROOT" push origin "v${APP_VERSION}" --force
echo "✅ Pushed master + tag v${APP_VERSION} to origin"
