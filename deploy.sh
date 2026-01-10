#!/bin/bash

# VPS Deployment Script for P2P File Share

set -e

VPS_HOST="ubuntu@p2p.red"
APP_DIR="/opt/p2p-file-share"

echo "🚀 Deploying P2P File Share to VPS..."

# Build application locally
echo "📦 Building application..."
npm run build

# Create deployment package
echo "📁 Creating deployment package..."
tar -czf deploy.tar.gz \
    dist/ \
    node_modules/ \
    package.json \
    docker-compose.yml \
    Dockerfile \
    Dockerfile.peerjs \
    nginx.conf \
    turnserver.conf

# Copy to VPS
echo "📤 Copying files to VPS..."
scp deploy.tar.gz $VPS_HOST:/tmp/

# Deploy on VPS
echo "🔧 Deploying on VPS..."
ssh $VPS_HOST "
    sudo mkdir -p $APP_DIR
    cd $APP_DIR
    sudo tar -xzf /tmp/deploy.tar.gz
    rm /tmp/deploy.tar.gz
    
    # Stop existing services
    sudo docker-compose down || true
    
    # Start new services
    sudo docker-compose up -d
    
    # Clean up old images
    sudo docker image prune -f
"

# Cleanup local package
rm deploy.tar.gz

echo "✅ Deployment complete!"
echo "🌐 https://p2p.red"
