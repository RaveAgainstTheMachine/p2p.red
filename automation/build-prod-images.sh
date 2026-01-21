#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGES_DIR="$REPO_ROOT/images"
APP_VERSION="$(node -p "require('$REPO_ROOT/package.json').version")"
GIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
BUILD_TIMESTAMP="$(date -u +%Y%m%d%H%M%S)"
BUILD_VERSION="${APP_VERSION}-${GIT_SHA}-${BUILD_TIMESTAMP}"

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

echo "🐳 Building nginx image..."
docker build -f "$REPO_ROOT/Dockerfile.nginx" -t p2p-nginx:latest "$REPO_ROOT"
docker save -o "$IMAGES_DIR/nginx.tar" p2p-nginx:latest

echo "✅ Images saved to $IMAGES_DIR"
