#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_ENV=${DEPLOY_ENV:-prod}
SITE_URL=${SITE_URL:-""}
METADATA_HEALTH_URL=${METADATA_HEALTH_URL:-"http://localhost:3001/health"}

start_vite_dev() {
  local pid_file="/tmp/p2p-vite-dev.pid"
  if [ -f "$pid_file" ]; then
    local pid
    pid=$(cat "$pid_file")
    if ps -p "$pid" > /dev/null 2>&1; then
      echo "🧹 Stopping existing Vite dev server (pid $pid)"
      kill "$pid" || true
    fi
    rm -f "$pid_file"
  fi

  if lsof -ti :3000 > /dev/null 2>&1; then
    echo "🧹 Freeing port 3000"
    lsof -ti :3000 | xargs -r kill -9
  fi

  echo "🧪 Starting Vite dev server..."
  setsid pnpm dev -- --host 0.0.0.0 --port 3000 --strictPort > /tmp/p2p-vite-dev.log 2>&1 < /dev/null &
  echo $! > "$pid_file"
  sleep 2

  if ! ss -ltn | grep -q ":3000"; then
    echo "❌ Vite dev server failed to bind to 3000. Check /tmp/p2p-vite-dev.log"
    exit 1
  fi
}

if [ -z "$SITE_URL" ]; then
  if [ "$DEPLOY_ENV" = "dev" ]; then
    SITE_URL="http://127.0.0.1:3000"
  else
    SITE_URL="https://p2p.red"
  fi
fi

cd "$REPO_ROOT"

echo "🚀 P2P File Share - Deploy + Health Checks"
echo "========================================="
echo "🧭 Deploy environment: $DEPLOY_ENV"
echo "🌐 Site URL: $SITE_URL"
echo "🩺 Metadata health URL: $METADATA_HEALTH_URL"

echo "📦 Running full deploy..."
DEPLOY_ENV="$DEPLOY_ENV" SITE_URL="$SITE_URL" METADATA_HEALTH_URL="$METADATA_HEALTH_URL" ./automation/deploy-all.sh

if [ "$DEPLOY_ENV" = "dev" ]; then
  start_vite_dev
fi

echo "✅ Deploy finished. Running health checks..."

if ! curl -fsS --max-time 2 "$SITE_URL" > /dev/null; then
  echo "❌ Site check failed: $SITE_URL"
  exit 1
fi

if ! curl -fsS --max-time 2 "$METADATA_HEALTH_URL" > /dev/null; then
  echo "❌ Metadata API health check failed: $METADATA_HEALTH_URL"
  exit 1
fi

if [ "$DEPLOY_ENV" = "dev" ]; then
  if ! docker compose -f docker-compose.e2e.yml ps | grep -q "p2p-e2e-peerjs"; then
    echo "❌ PeerJS container not running (dev)"
    docker compose -f docker-compose.e2e.yml ps
    exit 1
  fi
else
  if ! docker compose ps | grep -q "peerjs"; then
    echo "❌ PeerJS container not running"
    docker compose ps
    exit 1
  fi

  if ! docker compose ps | grep -q "envoy"; then
    echo "❌ Envoy container not running"
    docker compose ps
    exit 1
  fi
fi

echo "✅ Health checks passed"
