# Self-Hosting Guide

This document outlines the steps required to deploy your own instance of P2P File Share on a VPS or dedicated server.

## System Requirements

- **OS**: Linux (Ubuntu 22.04+ or Debian 11+ recommended)
- **CPU**: 1 vCPU minimum
- **RAM**: 2GB minimum (mostly for PostgreSQL and Redis)
- **Storage**: 10GB (minimal disk I/O required)
- **Network**: Public IP with ports 80 (HTTP), 443 (HTTPS), and 3478 (TURN) accessible.

## Deployment Steps

### 1. External Dependencies

Ensure you have a domain name pointing to your server's IP address.

### 2. Infrastructure Setup

#### Install Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

#### SSL Certificates
We recommend using Certbot to obtain Let's Encrypt certificates:
```bash
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com
```
Update the `envoy.yaml` file to point to your certificate paths.

### 3. Application Configuration

#### Environment Variables
Create a `.env` file in the root directory:
```env
# Metadata API Secrets
POSTGRES_PASSWORD=your_secure_password
API_KEY=your_admin_api_key

# Optional: Override images or ports
# APP_IMAGE=p2p-app:latest
# METADATA_API_IMAGE=p2p-metadata-api:latest
```

#### TURN Server
Update `turnserver.conf` with your domain and a secure secret:
```conf
static-auth-secret=your_secure_auth_secret
realm=your-domain.com
```

### 4. Launch

Deploy the full stack using Docker Compose:
```bash
docker compose up -d
```

### 5. Verification

Check the logs to ensure all services are healthy:
```bash
docker compose logs -f
```

Visit `https://your-domain.com` in your browser. Open the developer console to verify that the signaling connection is established.

## Advanced Configuration

### NAT Traversal
If your server is behind a NAT, ensure you configure `external-ip` in `turnserver.conf` to your public IP address.

### Performance Tuning
For high-traffic instances, consider increasing the `ulimit` for the Envoy and PeerJS containers to handle more concurrent file transfers.
