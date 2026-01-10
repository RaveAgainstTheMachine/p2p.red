#!/bin/bash

# P2P File Share - Quick Update Script
# Usage: ./quick-update.sh

set -e

echo "⚡ P2P File Share - Quick Update"
echo "=============================="

# Build the application
echo "📦 Building application..."
npm run build

# Copy files directly to nginx-https container
echo "📋 Copying files to nginx-https container..."
sudo docker exec nginx-https sh -c "rm -rf /usr/share/nginx/html/*" 2>/dev/null || true
sudo docker cp dist/. nginx-https:/usr/share/nginx/html/

# Update nginx-https configuration to serve files directly
echo "🗂️  Updating nginx-https configuration..."
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
    
    # PeerJS proxy - strip /peerjs prefix and forward to PeerJS server
    location /peerjs/ {
        rewrite ^/peerjs/(.*) /\$1 break;
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_read_timeout 86400;
    }
    
    # Handle /peerjs without trailing slash
    location = /peerjs {
        rewrite ^/peerjs\$ /peerjs/ permanent;
    }
}
EOF"

# Reload nginx-https
echo "🔄 Reloading nginx-https..."
sudo docker exec nginx-https nginx -s reload

# Wait for reload
echo "⏳ Waiting for reload..."
sleep 3

# Verify deployment
echo "🔍 Verifying deployment..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://p2p.red)

if [ "$HTTP_STATUS" = "200" ]; then
    # Check if new assets are being served
    NEW_ASSETS=$(curl -s https://p2p.red | grep -o 'index-[A-Za-z0-9]*\.js' | head -1)
    
    if [ -n "$NEW_ASSETS" ]; then
        echo "✅ Update successful!"
        echo "🌐 Visit https://p2p.red"
        echo "📦 New assets: $NEW_ASSETS"
        echo "💡 Use Ctrl+F5 to refresh browser cache"
    else
        echo "⚠️  Update completed but verify assets manually"
        echo "🔄 Please refresh browser with Ctrl+F5"
    fi
else
    echo "❌ Update failed! HTTP status: $HTTP_STATUS"
    echo "🔍 Checking nginx logs..."
    sudo docker exec nginx-https cat /var/log/nginx/error.log | tail -5
    exit 1
fi
