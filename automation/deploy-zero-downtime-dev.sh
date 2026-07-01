#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_ENV=${DEPLOY_ENV:-dev}
SITE_URL=${SITE_URL:-"http://localhost:5173"}

cd "$REPO_ROOT"

echo "🚀 Zero-Downtime Deployment (Development)"
echo "======================================="
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

# Determine current active environment
CURRENT_ENV=$(docker ps --filter "label=version" --format "table {{.Labels}}" | grep -E "(blue|green)" | head -1 | cut -d'=' -f2 || echo "blue")
NEXT_ENV="green"
if [ "$CURRENT_ENV" = "green" ]; then
    NEXT_ENV="blue"
fi

echo "🔄 Current: $CURRENT_ENV → Next: $NEXT_ENV"

# Ensure dev ports are available for next environment
if [ "$NEXT_ENV" = "green" ]; then
    require_port_free 5178
else
    require_port_free 5173
fi

# Build new version
echo "📦 Building $NEXT_ENV environment..."
cd packages/web
npm run build
cd ../..

# Build new container
docker compose -f docker-compose.dev-blue-green.yml build app-$NEXT_ENV

# Start new environment alongside current
echo "🚀 Starting $NEXT_ENV environment..."
docker compose -f docker-compose.dev-blue-green.yml up -d app-$NEXT_ENV

# Wait for health check
echo "⏳ Waiting for $NEXT_ENV to be healthy..."
sleep 10

# Determine port for health check
HEALTH_PORT="5173"
if [ "$NEXT_ENV" = "green" ]; then
    HEALTH_PORT="5178"
fi

# Health check new environment
echo "🔍 Health checking $NEXT_ENV on port $HEALTH_PORT..."
if ! curl -fs "http://localhost:$HEALTH_PORT" > /dev/null 2>&1; then
    echo "❌ Health check failed for $NEXT_ENV"
    docker compose -f docker-compose.dev-blue-green.yml stop app-$NEXT_ENV
    exit 1
fi

echo "✅ Health check passed for $NEXT_ENV"

# Simulate traffic switch (update local development proxy)
echo "🔄 Switching traffic to $NEXT_ENV (port $HEALTH_PORT)..."

# Wait and verify
echo "⏳ Verifying $NEXT_ENV is serving correctly..."
sleep 2

if ! curl -fs "http://localhost:$HEALTH_PORT" > /dev/null; then
    echo "❌ Verification failed for $NEXT_ENV"
    docker compose -f docker-compose.dev-blue-green.yml stop app-$NEXT_ENV
    exit 1
fi

echo "✅ Deployment successful!"
echo "📊 Active environment: $NEXT_ENV"
echo "🌐 Available at: http://localhost:$HEALTH_PORT"

# Ask if we should stop the old environment
echo ""
read -p "Stop old environment ($CURRENT_ENV)? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🛑 Stopping old environment..."
    docker compose -f docker-compose.dev-blue-green.yml stop app-$CURRENT_ENV
    echo "✅ Old environment stopped"
else
    echo "ℹ️  Keeping both environments running"
fi

echo "🎉 Zero-downtime deployment complete!"
