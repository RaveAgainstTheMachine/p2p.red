#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_ENV=${DEPLOY_ENV:-prod}
SITE_URL=${SITE_URL:-""}
METADATA_HEALTH_URL=${METADATA_HEALTH_URL:-"http://localhost:3001/health"}

if [ -z "$SITE_URL" ]; then
  if [ "$DEPLOY_ENV" = "dev" ]; then
    SITE_URL="http://localhost:5173"
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

echo "✅ Deploy finished. Running health checks..."

if ! curl -fsS "$SITE_URL" > /dev/null; then
  echo "❌ Site check failed: $SITE_URL"
  exit 1
fi

if ! curl -fsS "$METADATA_HEALTH_URL" > /dev/null; then
  echo "❌ Metadata API health check failed: $METADATA_HEALTH_URL"
  exit 1
fi

if ! docker compose ps | grep -q "peerjs"; then
  echo "❌ PeerJS container not running"
  docker compose ps
  exit 1
fi

if ! docker compose ps | grep -q "nginx"; then
  echo "❌ Nginx container not running"
  docker compose ps
  exit 1
fi

echo "✅ Health checks passed"
