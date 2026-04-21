#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_ENV=${DEPLOY_ENV:-prod}
SITE_URL=${SITE_URL:-"https://p2p.red"}
USE_PREBUILT_IMAGES=${USE_PREBUILT_IMAGES:-0}
SWITCH_GRACE_SECONDS=${SWITCH_GRACE_SECONDS:-5}
POST_SWITCH_VERIFY_DELAY=${POST_SWITCH_VERIFY_DELAY:-5}
OLD_ENV_STOP_DELAY=${OLD_ENV_STOP_DELAY:-15}
BLUEGREEN_PROJECT_NAME=${BLUEGREEN_PROJECT_NAME:-p2p-bluegreen}
ENVOY_ADMIN_URL=${ENVOY_ADMIN_URL:-http://127.0.0.1:9901}
ENVOY_CERTS_DIR=${ENVOY_CERTS_DIR:-/var/snap/docker/common/p2p-envoy-certs}
ALLOW_PROD_ON_DEV=${ALLOW_PROD_ON_DEV:-0}

cd "$REPO_ROOT"

echo "🚀 Zero-Downtime Deployment"
echo "==========================="
echo "🌐 Site URL: $SITE_URL"

export DEPLOY_ENV ENVOY_ADMIN_URL ENVOY_CERTS_DIR ALLOW_PROD_ON_DEV ENVOY_RUNTIME_DIR
"$REPO_ROOT/automation/preflight.sh" "$DEPLOY_ENV"

require_port_free() {
    local port=$1
    if command -v ss >/dev/null 2>&1; then
        if ss -ltn "sport = :$port" | grep -q ":$port"; then
            echo "❌ Port $port is already in use."
            exit 1
        fi
    elif command -v lsof >/dev/null 2>&1; then
        if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
            echo "❌ Port $port is already in use."
            exit 1
        fi
    else
        echo "⚠️  Unable to check port $port (ss/lsof not found)."
    fi
}

if [[ "$SITE_URL" != *"p2p.red"* ]]; then
    echo "❌ SITE_URL does not look like prod (p2p.red). Refusing to deploy."
    exit 1
fi

if [ -z "${METADATA_API_ENV_FILE:-}" ] && [ -f /run/secrets/metadata.env ]; then
    export METADATA_API_ENV_FILE=/run/secrets/metadata.env
fi

if [ "$DEPLOY_ENV" = "prod" ] && [ "$USE_PREBUILT_IMAGES" != "1" ]; then
    echo "❌ Prod deploys must use prebuilt images (USE_PREBUILT_IMAGES=1)."
    echo "   Build locally with explicit VITE_BUILD_VARIANT and ship tars to prod."
    exit 1
fi

# preflight.sh handles Envoy admin + cert checks for prod

CURRENT_ENV=""
ENV_BLUE_WEIGHT=$(curl -fsS "$ENVOY_ADMIN_URL/runtime?format=json" | sed -n 's/.*"traffic_split.app_blue"[[:space:]]*:[[:space:]]*"\([0-9]*\)".*/\1/p' | head -1)
ENV_GREEN_WEIGHT=$(curl -fsS "$ENVOY_ADMIN_URL/runtime?format=json" | sed -n 's/.*"traffic_split.app_green"[[:space:]]*:[[:space:]]*"\([0-9]*\)".*/\1/p' | head -1)

if [ -n "$ENV_BLUE_WEIGHT" ] && [ -n "$ENV_GREEN_WEIGHT" ]; then
    if [ "$ENV_BLUE_WEIGHT" -ge "$ENV_GREEN_WEIGHT" ]; then
        CURRENT_ENV="blue"
    else
        CURRENT_ENV="green"
    fi
fi

if [[ -z "$CURRENT_ENV" ]]; then
    if docker ps --format '{{.Names}}' | grep -q '^p2p-app-blue$' && ! docker ps --format '{{.Names}}' | grep -q '^p2p-app-green$'; then
        CURRENT_ENV="blue"
    elif docker ps --format '{{.Names}}' | grep -q '^p2p-app-green$' && ! docker ps --format '{{.Names}}' | grep -q '^p2p-app-blue$'; then
        CURRENT_ENV="green"
    else
        CURRENT_ENV="blue"
    fi
fi
NEXT_ENV="green"
if [ "$CURRENT_ENV" = "green" ]; then
    NEXT_ENV="blue"
fi

echo "🔄 Current: $CURRENT_ENV → Next: $NEXT_ENV"

require_port_free 3000

# Build or use prebuilt images
if [ "$USE_PREBUILT_IMAGES" = "1" ]; then
    if [ -z "${APP_IMAGE_BLUE:-}" ] || [ -z "${APP_IMAGE_GREEN:-}" ]; then
        echo "❌ APP_IMAGE_BLUE and APP_IMAGE_GREEN must be set when USE_PREBUILT_IMAGES=1"
        exit 1
    fi
    echo "📦 Using prebuilt images for $NEXT_ENV deployment"
else
    echo "📦 Building $NEXT_ENV environment..."
    npm run build

    echo "🐳 Building container for $NEXT_ENV..."
    COMPOSE_PROJECT_NAME=$BLUEGREEN_PROJECT_NAME docker compose -f docker-compose.blue-green.yml build app-$NEXT_ENV
fi

# Start new environment alongside current
echo "🚀 Starting $NEXT_ENV environment..."
echo "🧹 Removing stale $NEXT_ENV containers (if any)..."
docker rm -f "p2p-app-$NEXT_ENV" >/dev/null 2>&1 || true
docker ps -a --format '{{.Names}}' | grep -E "(^|_)p2p-app-$NEXT_ENV$" | xargs -r docker rm -f || true
COMPOSE_PROJECT_NAME=$BLUEGREEN_PROJECT_NAME docker compose -f docker-compose.blue-green.yml up -d app-$NEXT_ENV

# Wait for health check
echo "⏳ Waiting for $NEXT_ENV to be healthy..."
sleep 10

# Health check new environment (inside container)
echo "🔍 Health checking $NEXT_ENV..."
if ! COMPOSE_PROJECT_NAME=$BLUEGREEN_PROJECT_NAME docker compose -f docker-compose.blue-green.yml exec -T app-$NEXT_ENV node -e "require('http').get('http://localhost:3000',res=>process.exit(res.statusCode===200?0:1)).on('error',()=>process.exit(1))"; then
    echo "❌ Health check failed for $NEXT_ENV"
    COMPOSE_PROJECT_NAME=$BLUEGREEN_PROJECT_NAME docker compose -f docker-compose.blue-green.yml stop app-$NEXT_ENV
    exit 1
fi

# Verify build variant label matches target color
BUILD_VARIANT_LABEL=$(docker inspect -f '{{ index .Config.Labels "p2p.build_variant" }}' "p2p-app-$NEXT_ENV" 2>/dev/null || true)
if [ -z "$BUILD_VARIANT_LABEL" ]; then
    echo "❌ Missing p2p.build_variant label on image for $NEXT_ENV."
    echo "   Rebuild with VITE_BUILD_VARIANT and the Dockerfile label." 
    docker compose -f docker-compose.blue-green.yml stop app-$NEXT_ENV
    exit 1
fi

BUILD_VERSION_LABEL=$(docker inspect -f '{{ index .Config.Labels "p2p.build_version" }}' "p2p-app-$NEXT_ENV" 2>/dev/null || true)
if [ -z "$BUILD_VERSION_LABEL" ] || [ "$BUILD_VERSION_LABEL" = "<no value>" ]; then
    echo "❌ Missing p2p.build_version label on image for $NEXT_ENV."
    echo "   Rebuild with VITE_BUILD_VERSION and the Dockerfile label."
    docker compose -f docker-compose.blue-green.yml stop app-$NEXT_ENV
    exit 1
fi

if [ "$BUILD_VARIANT_LABEL" != "$NEXT_ENV" ]; then
    echo "❌ Build variant mismatch: expected '$NEXT_ENV', got '$BUILD_VARIANT_LABEL'."
    docker compose -f docker-compose.blue-green.yml stop app-$NEXT_ENV
    exit 1
fi

# Switch traffic (Envoy weight shift)
echo "🔄 Switching traffic to $NEXT_ENV via Envoy..."
if ! docker ps --format '{{.Names}}' | grep -q "^p2p-app-$NEXT_ENV$"; then
    echo "❌ Target container p2p-app-$NEXT_ENV is not running. Aborting switch."
    COMPOSE_PROJECT_NAME=$BLUEGREEN_PROJECT_NAME docker compose -f docker-compose.blue-green.yml stop app-$NEXT_ENV
    exit 1
fi

if ! COMPOSE_PROJECT_NAME=$BLUEGREEN_PROJECT_NAME docker compose -f docker-compose.blue-green.yml exec -T app-$NEXT_ENV node -e "require('http').get('http://localhost:3000',res=>process.exit(res.statusCode===200?0:1)).on('error',()=>process.exit(1))"; then
    echo "❌ Target container p2p-app-$NEXT_ENV is not reachable. Aborting switch."
    COMPOSE_PROJECT_NAME=$BLUEGREEN_PROJECT_NAME docker compose -f docker-compose.blue-green.yml stop app-$NEXT_ENV
    exit 1
fi

if [ "$NEXT_ENV" = "blue" ]; then
    "$REPO_ROOT/automation/envoy-shift-traffic.sh" 100 0
else
    "$REPO_ROOT/automation/envoy-shift-traffic.sh" 0 100
fi

echo "⏳ Grace period after switch (${SWITCH_GRACE_SECONDS}s)..."
sleep "$SWITCH_GRACE_SECONDS"

echo "✅ Traffic switched to $NEXT_ENV"

DEPLOY_LOG_PATH=${DEPLOY_LOG_PATH:-"$REPO_ROOT/automation/deploy.log"}
DEPLOY_IMAGE_ID=$(docker inspect -f '{{.Image}}' "p2p-app-$NEXT_ENV" 2>/dev/null || echo "unknown")
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) env=$NEXT_ENV image=$DEPLOY_IMAGE_ID version=$BUILD_VERSION_LABEL site=$SITE_URL" >> "$DEPLOY_LOG_PATH"

# Wait and verify
echo "⏳ Verifying live traffic..."
sleep "$POST_SWITCH_VERIFY_DELAY"

if ! curl -fs "$SITE_URL" > /dev/null; then
    echo "❌ Site verification failed - rolling back"
    if [ "$CURRENT_ENV" = "blue" ]; then
        "$REPO_ROOT/automation/envoy-shift-traffic.sh" 100 0
    else
        "$REPO_ROOT/automation/envoy-shift-traffic.sh" 0 100
    fi
    COMPOSE_PROJECT_NAME=$BLUEGREEN_PROJECT_NAME docker compose -f docker-compose.blue-green.yml stop app-$NEXT_ENV
    exit 1
fi

echo "⏳ Allowing old environment to drain (${OLD_ENV_STOP_DELAY}s)..."
sleep "$OLD_ENV_STOP_DELAY"

echo "✅ Deployment successful - stopping old environment"
COMPOSE_PROJECT_NAME=$BLUEGREEN_PROJECT_NAME docker compose -f docker-compose.blue-green.yml stop app-$CURRENT_ENV

if [ -f "$REPO_ROOT/automation/cleanup-images.sh" ]; then
    KEEP_COUNT=${KEEP_IMAGE_COUNT:-}
    DEPLOY_ENV="$DEPLOY_ENV" KEEP_COUNT="$KEEP_COUNT" "$REPO_ROOT/automation/cleanup-images.sh" || true
fi

echo "🎉 Zero-downtime deployment complete!"
echo "📊 Active environment: $NEXT_ENV"
