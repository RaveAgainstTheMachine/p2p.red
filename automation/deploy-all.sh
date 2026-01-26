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

echo "🚀 P2P File Share - Full Deploy"
echo "==============================="

if [ "$DEPLOY_ENV" = "dev" ]; then
  echo "🛠️  Dev mode: starting e2e backend stack (no prod build)"
  docker compose -f docker-compose.e2e.yml up -d --build
  echo "✅ Dev backend stack up"
  exit 0
fi

echo "🔍 Checking required files..."
if [ ! -f "metadata-api/.env" ]; then
  echo "❌ metadata-api/.env is missing. Create it from metadata-api/.env.example"
  exit 1
fi

if [ ! -f "turnserver.conf" ]; then
  echo "❌ turnserver.conf is missing. Create it before deploying TURN"
  exit 1
fi

echo "✅ Required files present"
echo "🧭 Deploy environment: $DEPLOY_ENV"
echo "🌐 Site URL: $SITE_URL"
echo "🩺 Metadata health URL: $METADATA_HEALTH_URL"

echo "📦 Deploying metadata stack..."
DEPLOY_ENV="$DEPLOY_ENV" METADATA_HEALTH_URL="$METADATA_HEALTH_URL" ./deploy-metadata-api.sh

echo "📦 Deploying app stack..."
DEPLOY_ENV="$DEPLOY_ENV" SITE_URL="$SITE_URL" ./deploy.sh

echo "✅ Deploy complete"
