#!/bin/bash

# P2P File Share - Server Startup Script
# Usage: ./start-servers.sh

set -e

echo "🚀 P2P File Share - Start All Servers"
echo "===================================="

# Stop existing services
echo "🛑 Stopping existing services..."
sudo docker compose down 2>/dev/null || true
sudo docker system prune -f 2>/dev/null || true

# Start core services
echo "🔧 Starting core services..."
sudo docker compose up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Deploy app with direct copy method
echo "📦 Building and deploying app..."
npm run build
rm -rf /tmp/dist/*
cp -r dist/* /tmp/dist/

# Stop and remove existing app container (if any)
echo "🔄 Stopping existing app container..."
sudo docker rm -f p2p-file-share-app 2>/dev/null || true

# Copy files directly to nginx-https container
echo "📋 Copying files to nginx-https container..."
sudo docker exec nginx-https sh -c "rm -rf /usr/share/nginx/html/*" 2>/dev/null || true
sudo docker cp /tmp/dist/. nginx-https:/usr/share/nginx/html/

# Configure nginx-https to serve files directly
echo "🗂️  Configuring nginx-https..."
sudo docker exec nginx-https sh -c "cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name p2p.red;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name p2p.red;
    
    ssl_certificate /etc/letsencrypt/live/p2p.red/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/p2p.red/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # Disable browser caching
    add_header Cache-Control \"no-cache, no-store, must-revalidate\";
    add_header Pragma \"no-cache\";
    add_header Expires \"0\";
    
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
    
    location /peerjs {
        proxy_pass http://localhost:9000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
    }
}
EOF"

# Reload nginx-https
sudo docker exec nginx-https nginx -s reload

# Wait for services to be ready
echo "⏳ Waiting for all services to be ready..."
sleep 5

# Verify all services
echo "🔍 Verifying all services..."
echo "📊 Service Status:"
sudo docker compose ps

echo ""
echo "🌐 Testing endpoints:"
echo "- PeerJS: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:9000)"
echo "- HTTPS: $(curl -s -o /dev/null -w "%{http_code}" https://p2p.red)"

# Check if new assets are being served
NEW_ASSETS=$(curl -s https://p2p.red | grep -o 'index-[A-Za-z0-9]*\.js' | head -1)
echo ""
if [ -n "$NEW_ASSETS" ]; then
    echo "✅ All services started successfully!"
    echo "🌐 Visit https://p2p.red"
    echo "📦 New assets: $NEW_ASSETS"
else
    echo "⚠️  Services started but verify assets manually"
    echo "🔄 Please refresh browser with Ctrl+F5"
fi
