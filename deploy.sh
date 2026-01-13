#!/bin/bash

# Streamlined Build & Deploy Script for P2P File Share
# Prevents service restart issues by proper container management

set -e

APP_DIR="/opt/p2p-file-share"

echo "🚀 Starting streamlined build & deploy..."

# Build application
echo "📦 Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed!"
    exit 1
fi

echo "✅ Build successful"

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
echo "🌐 Site: https://p2p.red"
echo "📊 Status: docker-compose ps"
