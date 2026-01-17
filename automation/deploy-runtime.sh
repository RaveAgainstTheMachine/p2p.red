#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE_URL=${SITE_URL:-"https://p2p.red"}
RUNTIME_ROOT=${RUNTIME_ROOT:-"$REPO_ROOT/runtime"}
IMAGES_DIR=${IMAGES_DIR:-"$REPO_ROOT/images"}
START_NGINX=${START_NGINX:-1}

APP_IMAGE_BLUE=${APP_IMAGE_BLUE:-"p2p-app-blue:latest"}
APP_IMAGE_GREEN=${APP_IMAGE_GREEN:-"p2p-app-green:latest"}
METADATA_API_IMAGE=${METADATA_API_IMAGE:-"p2p-metadata-api:latest"}
PEERJS_IMAGE=${PEERJS_IMAGE:-"p2p-peerjs:latest"}
NGINX_IMAGE=${NGINX_IMAGE:-"p2p-nginx:latest"}
METADATA_API_ENV_FILE=${METADATA_API_ENV_FILE:-"$RUNTIME_ROOT/metadata-api.env"}

BLUE_TAR=${BLUE_TAR:-"$IMAGES_DIR/app-blue.tar"}
GREEN_TAR=${GREEN_TAR:-"$IMAGES_DIR/app-green.tar"}
METADATA_TAR=${METADATA_TAR:-"$IMAGES_DIR/metadata-api.tar"}
PEERJS_TAR=${PEERJS_TAR:-"$IMAGES_DIR/peerjs.tar"}
NGINX_TAR=${NGINX_TAR:-"$IMAGES_DIR/nginx.tar"}

require_file() {
    local file=$1
    if [ ! -f "$file" ]; then
        echo "❌ Missing required file: $file"
        exit 1
    fi
}

compose_cmd() {
    if docker compose version >/dev/null 2>&1; then
        echo "docker compose"
        return
    fi
    if command -v docker-compose >/dev/null 2>&1; then
        echo "docker-compose"
        return
    fi
    echo "❌ docker compose or docker-compose is required"
    exit 1
}

if [[ "$SITE_URL" != *"p2p.red"* ]]; then
    echo "❌ SITE_URL does not look like prod (p2p.red). Refusing to deploy."
    exit 1
fi

mkdir -p "$IMAGES_DIR" "$RUNTIME_ROOT"

require_file "$BLUE_TAR"
require_file "$GREEN_TAR"
require_file "$METADATA_TAR"
require_file "$PEERJS_TAR"
require_file "$NGINX_TAR"
require_file "$METADATA_API_ENV_FILE"

echo "📦 Loading images..."
docker load -i "$BLUE_TAR"
docker load -i "$GREEN_TAR"
docker load -i "$METADATA_TAR"
docker load -i "$PEERJS_TAR"
docker load -i "$NGINX_TAR"

export APP_IMAGE_BLUE
export APP_IMAGE_GREEN
export METADATA_API_IMAGE
export PEERJS_IMAGE
export NGINX_IMAGE
export METADATA_API_ENV_FILE
export APP_IMAGE=${APP_IMAGE:-$APP_IMAGE_BLUE}

echo "🚀 Starting runtime services..."
COMPOSE_CMD=$(compose_cmd)
$COMPOSE_CMD -f "$REPO_ROOT/docker-compose.yml" up -d postgres redis metadata-api peerjs-server
if [ "$START_NGINX" = "1" ]; then
    $COMPOSE_CMD -f "$REPO_ROOT/docker-compose.yml" up -d --no-deps nginx
fi

echo "✅ Runtime images loaded. Use deploy-zero-downtime.sh with USE_PREBUILT_IMAGES=1 to switch app blue/green."
