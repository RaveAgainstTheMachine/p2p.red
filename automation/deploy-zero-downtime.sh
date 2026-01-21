#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_ENV=${DEPLOY_ENV:-prod}
SITE_URL=${SITE_URL:-"https://p2p.red"}
USE_PREBUILT_IMAGES=${USE_PREBUILT_IMAGES:-0}
export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-p2p-bluegreen}

cd "$REPO_ROOT"

echo "🚀 Zero-Downtime Deployment"
echo "==========================="
echo "🌐 Site URL: $SITE_URL"

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

ensure_nginx_running() {
    if ! docker compose ps --services --filter "status=running" | grep -q "^nginx$"; then
        echo "🧩 Nginx not running, starting..."
        docker compose up -d --no-deps nginx
    fi
}

# Determine current active environment (prefer nginx.conf upstream)
CURRENT_ENV=""
if [[ -f nginx.conf ]]; then
    if grep -q "p2p-app-green:3000" nginx.conf; then
        CURRENT_ENV="green"
    elif grep -q "p2p-app-blue:3000" nginx.conf; then
        CURRENT_ENV="blue"
    fi
fi

if [[ -z "$CURRENT_ENV" ]]; then
    CURRENT_ENV=$(docker ps --filter "label=version" --format "table {{.Labels}}" | grep -E "(blue|green)" | head -1 | cut -d'=' -f2 || echo "blue")
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
    docker compose -f docker-compose.blue-green.yml build app-$NEXT_ENV
fi

# Start new environment alongside current
echo "🚀 Starting $NEXT_ENV environment..."
echo "🧹 Removing stale $NEXT_ENV containers (if any)..."
docker rm -f "p2p-app-$NEXT_ENV" >/dev/null 2>&1 || true
docker ps -a --format '{{.Names}}' | grep -E "(^|_)p2p-app-$NEXT_ENV$" | xargs -r docker rm -f || true
docker compose -f docker-compose.blue-green.yml up -d app-$NEXT_ENV

# Wait for health check
echo "⏳ Waiting for $NEXT_ENV to be healthy..."
sleep 10

# Health check new environment (inside container)
echo "🔍 Health checking $NEXT_ENV..."
if ! docker compose -f docker-compose.blue-green.yml exec -T app-$NEXT_ENV node -e "require('http').get('http://localhost:3000',res=>process.exit(res.statusCode===200?0:1)).on('error',()=>process.exit(1))"; then
    echo "❌ Health check failed for $NEXT_ENV"
    docker compose -f docker-compose.blue-green.yml stop app-$NEXT_ENV
    exit 1
fi

# Switch traffic (update Nginx upstream)
echo "🔄 Switching traffic to $NEXT_ENV..."
sed -i "s/server p2p-app:3000;/server p2p-app-$NEXT_ENV:3000;/g" nginx.conf

# Reload Nginx
ensure_nginx_running
docker compose exec nginx nginx -s reload

echo "✅ Traffic switched to $NEXT_ENV"

# Wait and verify
echo "⏳ Verifying live traffic..."
sleep 5

if ! curl -fs "$SITE_URL" > /dev/null; then
    echo "❌ Site verification failed - rolling back"
    sed -i "s/server p2p-app-$NEXT_ENV:3000;/server p2p-app-$CURRENT_ENV:3000;/g" nginx.conf
    ensure_nginx_running
    docker compose exec nginx nginx -s reload
    docker compose -f docker-compose.blue-green.yml stop app-$NEXT_ENV
    exit 1
fi

echo "✅ Deployment successful - stopping old environment"
docker compose -f docker-compose.blue-green.yml stop app-$CURRENT_ENV

echo "🎉 Zero-downtime deployment complete!"
echo "📊 Active environment: $NEXT_ENV"
