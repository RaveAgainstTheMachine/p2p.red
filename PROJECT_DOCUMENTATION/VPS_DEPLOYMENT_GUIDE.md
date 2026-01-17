# 🚀 OVH VPS Deployment Guide

## 📋 **Overview**

This guide covers deploying the P2P File Share application on an OVH VPS with direct SSH access and full control over the infrastructure.

## 🏗️ **Infrastructure Overview**

```
┌─────────────────┐
│   OVH VPS       │
│   <domain>      │
│                 │
│ • Ubuntu Server │
│ • Docker        │
│ • Nginx         │
│ • Node.js       │
│ • PeerJS Server │
│ • TURN Server   │
└─────────────────┘
         │
    ┌────────┐
    │ Domain │
    │ <domain> │
    └────────┘
```

## 🛠️ **VPS Configuration**

### **Server Specs**
- **Provider**: OVH
- **Domain**: <domain>
- **OS**: Ubuntu Server
- **Access**: SSH (<user>@<host>)
- **Security**: UFW firewall (port 22 only initially)

### **Software Stack**
- **Runtime**: Node.js 20+
- **Container**: Docker & Docker Compose
- **Web Server**: Nginx (reverse proxy)
- **SSL**: Let's Encrypt certificates
- **Signaling**: PeerJS server
- **NAT Traversal**: coturn TURN server

## 📁 **Project Structure**

```
p2p-file-share/
├── docker-compose.yml      # Multi-service orchestration
├── Dockerfile             # Application container
├── nginx.conf              # Nginx configuration
├── peerjs-server.js       # PeerJS signaling server
├── turnserver.conf        # TURN server config
├── deploy.sh              # Deployment script
├── src/
│   ├── config/
│   │   └── environments.ts # Environment config
│   └── ...
└── PROJECT_DOCUMENTATION/
    └── VPS_DEPLOYMENT_GUIDE.md
```

## 🔧 **VPS Setup**

### **1. Initial Server Setup**

```bash
# Connect to VPS
ssh <user>@<host>

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx and Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Install coturn (TURN server)
sudo apt install -y coturn
```

### **2. Firewall Configuration**

```bash
# Open necessary ports
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 3478/udp    # TURN server
sudo ufw allow 49152-65535/udp  # TURN relay ports

# Enable firewall
sudo ufw enable
```

### **3. SSL Certificate Setup**

```bash
# Obtain SSL certificate
sudo certbot --nginx -d <domain> -d www.<domain>

# Setup auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📦 **Deployment Configuration**

### **docker-compose.yml**
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PEERJS_HOST=<domain>
      - PEERJS_PORT=443
      - PEERJS_PATH=/peerjs
    restart: unless-stopped
    depends_on:
      - peerjs-server
      - turnserver

  peerjs-server:
    build:
      context: .
      dockerfile: Dockerfile.peerjs
    ports:
      - "9000:9000"
    environment:
      - PEERJS_PORT=9000
      - PEERJS_HOST=<domain>
    restart: unless-stopped

  turnserver:
    image: coturn/coturn:latest
    ports:
      - "3478:3478/udp"
      - "3478:3478/tcp"
    volumes:
      - ./turnserver.conf:/etc/coturn/turnserver.conf
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - app
    restart: unless-stopped
```

### **Dockerfile**
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
```

### **nginx.conf**
```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/<domain>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<domain>/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

    upstream app {
        server app:3000;
    }

    upstream peerjs {
        server peerjs-server:9000;
    }

    server {
        listen 80;
        server_name <domain> www.<domain>;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name <domain> www.<domain>;

        # Security headers
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss://<domain>; font-src 'self'; object-src 'none';" always;

        # Main application
        location / {
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # PeerJS signaling
        location /peerjs {
            proxy_pass http://peerjs;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static files
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            proxy_pass http://app;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

### **peerjs-server.js**
```javascript
const { PeerServer } = require('peer');

const peerServer = PeerServer({
    port: 9000,
    path: '/peerjs',
    allow_discovery: true,
    proxied: true
});

peerServer.on('connection', (client) => {
    console.log('Client connected:', client.id);
});

peerServer.on('disconnect', (client) => {
    console.log('Client disconnected:', client.id);
});

console.log('PeerJS server running on port 9000');
```

### **turnserver.conf**
```conf
# TURN server configuration
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0

# Authentication
use-auth-secret
static-auth-secret=your-secret-key-here
realm=<domain>

# SSL certificates
cert=/etc/letsencrypt/live/<domain>/fullchain.pem
pkey=/etc/letsencrypt/live/<domain>/privkey.pem

# Logging
log-file=/var/log/turnserver.log
verbose

# Relay configuration
relay-ip=127.0.0.1
total-quota=100
user-quota=12
max-bps=64000
```

## 🚀 **Deployment Script**

### **deploy.sh**
```bash
#!/bin/bash

# VPS Deployment Script for P2P File Share

set -e

VPS_HOST="<user>@<host>"
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
    nginx.conf \
    peerjs-server.js \
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
echo "🌐 https://<domain>"
```

## 🔐 **Security Configuration**

### **SSH Key Setup**
```bash
# Generate SSH key (if not exists)
ssh-keygen -t ed25519 -C "p2p-deploy"

# Copy key to VPS
ssh-copy-id <user>@<host>

# Test connection
ssh <user>@<host>
```

### **Application Security**
- **Environment variables**: Store secrets in .env file
- **Rate limiting**: Nginx configuration
- **Firewall**: UFW with minimal open ports
- **SSL**: Let's Encrypt with auto-renewal
- **User separation**: Non-root containers

## 📊 **Monitoring & Logging**

### **Application Monitoring**
```bash
# View logs
ssh <user>@<host> "sudo docker-compose logs -f"

# Check service status
ssh <user>@<host> "sudo docker-compose ps"

# System monitoring
ssh <user>@<host> "htop"
ssh <user>@<host> "df -h"
ssh <user>@<host> "free -h"
```

### **Log Rotation**
```bash
# Setup log rotation
ssh <user>@<host> "
sudo tee /etc/logrotate.d/p2p-file-share << EOF
/opt/p2p-file-share/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
}
EOF
"
```

## 💰 **Cost Analysis**

### **VPS Costs**
- **OVH VPS**: $5-15/month (depending on specs)
- **Domain**: $10-15/year
- **SSL**: Free (Let's Encrypt)
- **Total**: $70-180/year

### **Benefits**
- **Full control**: Complete server administration
- **Cost effective**: Single server vs multiple cloud services
- **Performance**: Dedicated resources
- **Privacy**: No third-party data sharing

## 🔄 **Maintenance**

### **Regular Tasks**
```bash
# Update system packages
ssh <user>@<host> "sudo apt update && sudo apt upgrade -y"

# Update Docker containers
./deploy.sh

# Renew SSL certificate
sudo certbot renew

# Backup data
ssh <user>@<host> "sudo tar -czf /backup/p2p-$(date +%Y%m%d).tar.gz /opt/p2p-file-share"
```

### **Backup Strategy**
```bash
# Setup automated backups
ssh <user>@<host> "
sudo crontab -e
# Add: 0 2 * * * tar -czf /backup/p2p-$(date +\%Y\%m\%d).tar.gz /opt/p2p-file-share
"
```

## 🚀 **Deployment Commands**

### **Initial Deployment**
```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

### **Update Deployment**
```bash
# Update application
git pull origin main
./deploy.sh
```

### **Manual Deployment**
```bash
# Connect to VPS
ssh <user>@<host>

# Navigate to app directory
cd /opt/p2p-file-share

# Restart services
sudo docker-compose restart

# View logs
sudo docker-compose logs -f
```

## 📋 **Checklist**

### **Pre-deployment**
- [ ] SSH key configured
- [ ] Domain pointing to VPS
- [ ] SSL certificate obtained
- [ ] Firewall configured
- [ ] Docker installed

### **Post-deployment**
- [ ] Services running correctly
- [ ] SSL certificate valid
- [ ] Domain accessible
- [ ] PeerJS server working
- [ ] TURN server functional
- [ ] Monitoring setup

---

**This guide provides complete VPS deployment with full control over infrastructure and cost optimization.**
