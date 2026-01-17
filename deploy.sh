#!/bin/bash

# Streamlined Build & Deploy Script for P2P File Share
# Prevents service restart issues by proper container management
# Includes cache-busting to ensure latest code is served

set -euo pipefail

DEPLOY_ENV=${DEPLOY_ENV:-prod}
SITE_URL=${SITE_URL:-""}

if [ -z "$SITE_URL" ]; then
    if [ "$DEPLOY_ENV" = "dev" ]; then
        SITE_URL="http://localhost:5173"
    else
        SITE_URL="https://p2p.red"
    fi
fi

APP_DIR="/opt/p2p-file-share"

echo "🚀 Starting streamlined build & deploy..."
echo "🧭 Deploy environment: $DEPLOY_ENV"
echo "🌐 Site URL: $SITE_URL"

# Generate build timestamp for cache busting
BUILD_TIMESTAMP=$(date +%s)
echo "📅 Build timestamp: $BUILD_TIMESTAMP"

# Build application
echo "📦 Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful"

# Extract build hash from generated files for verification
BUILD_HASH=$(ls -1 dist/assets/index-*.js 2>/dev/null | head -1 | grep -oP 'index-\K[0-9]+' || echo "unknown")
echo "🔑 Build hash: $BUILD_HASH"

# Update version.json with build info
if [ -f "public/version.json" ]; then
    cat > public/version.json <<EOF
{
  "version": "1.0.0",
  "build": "$BUILD_HASH",
  "timestamp": $BUILD_TIMESTAMP
}
EOF
    cp public/version.json dist/version.json
    echo "📝 Updated version.json"
fi

# Stop services gracefully
echo "🛑 Stopping services..."
docker-compose down

# Remove old containers and images
echo "🧹 Cleaning up old containers..."
docker-compose rm -f || true

# Rebuild only changed services
echo "🔨 Building Docker images..."
docker-compose build --no-cache nginx app

# Start all services in correct order
echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🔍 Checking service health..."
docker-compose ps

# Verify critical services
echo "✅ Verifying critical services..."

# Check nginx
if ! docker-compose ps | grep -q "nginx.*Up"; then
    echo "❌ Nginx failed to start"
    docker-compose logs --tail=20 nginx
    exit 1
fi

# Check app
if ! docker-compose ps | grep -q "app.*Up"; then
    echo "❌ App failed to start"
    docker-compose logs --tail=20 app
    exit 1
fi

# Check peerjs (check actual container name)
if ! docker ps | grep -q "p2p-peerjs"; then
    echo "❌ PeerJS failed to start"
    docker-compose logs --tail=20 peerjs-server
    exit 1
fi

echo "✅ All critical services running"

# Verify build hash is being served
echo "🔍 Verifying latest build is served..."
sleep 2

# Check if the new build hash appears in the served HTML
SERVED_HASH=$(curl -s "$SITE_URL" | grep -oP 'index-\K[0-9]+(?=\.js)' | head -1 || echo "unknown")
echo "📡 Served hash: $SERVED_HASH"

if [ "$BUILD_HASH" != "unknown" ] && [ "$SERVED_HASH" != "unknown" ]; then
    if [ "$BUILD_HASH" == "$SERVED_HASH" ]; then
        echo "✅ Latest build verified - hash matches: $BUILD_HASH"
    else
        echo "⚠️  Warning: Build hash mismatch!"
        echo "   Built: $BUILD_HASH"
        echo "   Served: $SERVED_HASH"
        echo "   This might indicate caching issues"
    fi
else
    echo "⚠️  Could not verify build hash"
fi

# Force browser cache clear instructions
echo ""
echo "🔄 CACHE CLEARING:"
echo "   - Nginx configured with no-cache headers"
echo "   - Users should hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)"
echo "   - Or clear browser cache for p2p.red"
echo ""
echo "🌐 Site: $SITE_URL"
echo "📊 Status: docker-compose ps"
echo "🔑 Build: $BUILD_HASH @ $BUILD_TIMESTAMP"
