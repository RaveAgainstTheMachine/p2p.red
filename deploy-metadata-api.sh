#!/bin/bash

# P2P File Share - Metadata API Deployment Script
# Deploys PostgreSQL, Redis, and Metadata API server

set -euo pipefail

DEPLOY_ENV=${DEPLOY_ENV:-prod}
METADATA_HEALTH_URL=${METADATA_HEALTH_URL:-"http://localhost:3001/health"}
SECRETS_ENV_FILE=${SECRETS_ENV_FILE:-"/run/secrets/metadata.env"}
METADATA_TAR=${METADATA_TAR:-""}
SKIP_BUILD=${SKIP_BUILD:-0}

echo "🚀 P2P Metadata API Deployment"
echo "🧭 Deploy environment: $DEPLOY_ENV"
echo "🩺 Metadata health URL: $METADATA_HEALTH_URL"
echo "================================"

# Ensure metadata-api/.env exists (non-secret defaults)
if [ ! -f metadata-api/.env ]; then
    echo "⚠️  metadata-api/.env missing; creating non-secret defaults..."
    mkdir -p metadata-api
    cat > metadata-api/.env <<'EOF'
# Metadata API Configuration - Non-secret defaults
NODE_ENV=production
PORT=3001
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=p2p_metadata
POSTGRES_USER=p2p_api_user
POSTGRES_PASSWORD=
POSTGRES_MAX_CONNECTIONS=20
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
LINK_EXPIRY_HOURS=24
CLEANUP_INTERVAL_MINUTES=60
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=https://p2p.red
TURN_SECRET=
TURN_TTL_SECONDS=3600
EOF
fi

if [ ! -s "$SECRETS_ENV_FILE" ]; then
    echo "❌ Secrets env file missing: $SECRETS_ENV_FILE"
    echo "   Ensure OpenBao Agent is running and writing metadata.env"
    exit 1
fi

export METADATA_API_ENV_FILE="$SECRETS_ENV_FILE"

# Build and start services
if [ -n "$METADATA_TAR" ]; then
    if [ ! -f "$METADATA_TAR" ]; then
        echo "❌ Metadata image tar missing: $METADATA_TAR"
        exit 1
    fi
    echo "📦 Loading metadata API image from tar..."
    docker load -i "$METADATA_TAR"
    SKIP_BUILD=1
fi

if [ "$SKIP_BUILD" != "1" ]; then
    echo "📦 Building Docker images..."
    docker compose --env-file "$SECRETS_ENV_FILE" -f docker-compose.metadata.yml build
else
    echo "⏭️  Skipping build (prebuilt image loaded)."
fi

echo "🧹 Recreating metadata-api to avoid compose cache issues..."
docker compose --env-file "$SECRETS_ENV_FILE" -f docker-compose.metadata.yml rm -f -s metadata-api || true

echo "🚀 Starting services..."
docker compose --env-file "$SECRETS_ENV_FILE" -f docker-compose.metadata.yml up -d --no-build postgres redis metadata-api

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check PostgreSQL
echo "🔍 Checking PostgreSQL..."
docker compose --env-file "$SECRETS_ENV_FILE" -f docker-compose.metadata.yml exec -T postgres pg_isready -U p2p_api_user -d p2p_metadata || {
    echo "❌ PostgreSQL is not ready"
    exit 1
}
echo "✅ PostgreSQL is healthy"

# Check Redis
echo "🔍 Checking Redis..."
docker compose --env-file "$SECRETS_ENV_FILE" -f docker-compose.metadata.yml exec -T redis redis-cli ping || {
    echo "❌ Redis is not ready"
    exit 1
}
echo "✅ Redis is healthy"

# Check API server
echo "🔍 Checking Metadata API..."
sleep 5
curl -f "$METADATA_HEALTH_URL" || {
    echo "❌ Metadata API is not responding"
    docker compose --env-file "$SECRETS_ENV_FILE" -f docker-compose.metadata.yml logs metadata-api
    exit 1
}
echo "✅ Metadata API is healthy"

echo ""
echo "✅ Deployment successful!"
echo ""
echo "📊 Service URLs:"
echo "   - Metadata API: http://localhost:3001"
echo "   - PostgreSQL:   localhost:5432"
echo "   - Redis:        localhost:6379"
echo ""
echo "📝 Useful commands:"
echo "   - View logs:    docker compose -f docker-compose.metadata.yml logs -f"
echo "   - Stop services: docker compose -f docker-compose.metadata.yml down"
echo "   - Restart:      docker compose -f docker-compose.metadata.yml restart"
echo ""
echo "🔍 Test the API:"
echo "   curl $METADATA_HEALTH_URL"
echo ""
