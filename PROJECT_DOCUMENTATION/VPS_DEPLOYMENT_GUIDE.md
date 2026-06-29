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
│ • Envoy         │
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
- **Web Server**: Envoy (reverse proxy)
- **SSL**: Let's Encrypt certificates
- **Signaling**: PeerJS server
- **NAT Traversal**: coturn TURN server

## 📁 **Project Structure**

```
p2p-file-share/
├── docker-compose.yml      # Multi-service orchestration
├── Dockerfile             # Application container
├── envoy.yaml              # Envoy configuration
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

# Install Certbot (standalone)
sudo apt install -y certbot

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
sudo certbot certonly --standalone -d <domain> -d <signal-domain> -d plausible.<domain> -d dash.<domain>

# CRITICAL: Link the hardened conversion hook
# This script converts PEM to PKCS12 for Envoy and re-applies traffic splits via Admin API
sudo certbot reconfigure --cert-name <domain> --deploy-hook /opt/p2p-file-share/automation/renew-certs-hook.sh
```

> [!IMPORTANT]
> Since Envoy runs in Snap Docker, it cannot read PEM files directly from `/etc/letsencrypt`. The `renew-certs-hook.sh` MUST run after every renewal to sync `.p12` bundles to `/var/snap/docker/common/p2p-envoy-certs/`.

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

  envoy:
    image: envoyproxy/envoy:v1.30.1
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./envoy.yaml:/etc/envoy/envoy.yaml
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

### **Auto-Restart on Reboot (Production Only)**
All production services already use `restart: unless-stopped` in Compose, but Docker must also start on boot.

```bash
sudo systemctl enable docker
```

To ensure the production stack itself starts after reboot, create a systemd unit for the prod compose file (do **not** enable for dev stacks):

```ini
# /etc/systemd/system/p2p-prod.service
[Unit]
Description=P2P File Share (Production)
After=docker.service
Requires=docker.service

[Service]
WorkingDirectory=/opt/p2p-file-share
ExecStart=/usr/bin/docker compose -f docker-compose.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.yml down
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable p2p-prod
```

**Dev services** should be started only when testing (no systemd unit enabled).

### **envoy.yaml**
```yaml
admin:
  access_log_path: /tmp/admin_access.log
  address:
    socket_address:
      address: <ip>
      port_value: 9901

static_resources:
  listeners:
    - name: listener_http
      address:
        socket_address:
          address: <ip>
          port_value: 80
      filter_chains:
        - filters:
            - name: envoy.filters.network.http_connection_manager
              typed_config:
                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                stat_prefix: ingress_http
                route_config:
                  name: http_redirect
                  virtual_hosts:
                    - name: redirect
                      domains:
                        - <domain>
                        - www.<domain>
                      routes:
                        - match:
                            prefix: "/"
                          redirect:
                            https_redirect: true
                http_filters:
                  - name: envoy.filters.http.router

    - name: listener_https
      address:
        socket_address:
          address: <ip>
          port_value: 443
      filter_chains:
        - filter_chain_match:
            server_names:
              - <domain>
              - www.<domain>
          transport_socket:
            name: envoy.transport_sockets.tls
            typed_config:
              "@type": type.googleapis.com/envoy.extensions.transport_sockets.tls.v3.DownstreamTlsContext
              common_tls_context:
                tls_certificates:
                  - certificate_chain:
                      filename: /etc/letsencrypt/live/<domain>/fullchain.pem
                    private_key:
                      filename: /etc/letsencrypt/live/<domain>/privkey.pem
          filters:
            - name: envoy.filters.network.http_connection_manager
              typed_config:
                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                stat_prefix: ingress_https
                upgrade_configs:
                  - upgrade_type: websocket
                route_config:
                  name: app_routes
                  virtual_hosts:
                    - name: app
                      domains:
                        - <domain>
                        - www.<domain>
                      routes:
                        - match:
                            prefix: "/peerjs/"
                          route:
                            cluster: peerjs
                            timeout: 0s
                        - match:
                            prefix: "/"
                          route:
                            cluster: app
                http_filters:
                  - name: envoy.filters.http.router

  clusters:
    - name: app
      connect_timeout: 2s
      type: strict_dns
      lb_policy: round_robin
      load_assignment:
        cluster_name: app
        endpoints:
          - lb_endpoints:
              - endpoint:
                  address:
                    socket_address:
                      address: app
                      port_value: 3000
    - name: peerjs
      connect_timeout: 2s
      type: strict_dns
      lb_policy: round_robin
      load_assignment:
        cluster_name: peerjs
        endpoints:
          - lb_endpoints:
              - endpoint:
                  address:
                    socket_address:
                      address: peerjs-server
                      port_value: 9000
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
listening-ip=<ip>

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
relay-ip=<ip>
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
    envoy.yaml \
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
- **Rate limiting**: Envoy configuration
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
