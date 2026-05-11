#!/bin/bash
set -e

# p2p.red Self-Host Setup Orchestrator
echo "🚀 p2p.red Self-Host Setup"
echo "=========================="

# 1. Environment Configuration
read -p "Enter your base domain (e.g., p2p.red): " BASE_DOMAIN
BASE_DOMAIN=${BASE_DOMAIN:-p2p.red}

echo ""
echo "--- Optional Components ---"
read -p "Enable Plausible Analytics? (y/N): " ENABLE_PLAUSIBLE
read -p "Enable OpenBao Secrets Management? (y/N): " ENABLE_OPENBAO

# 2. Secret Generation
JWT_SECRET=$(openssl rand -base64 32)
TURN_SECRET=$(openssl rand -base64 32)

# 3. Create .env
cat > .env << EOF
# Core
BASE_DOMAIN=$BASE_DOMAIN
NODE_ENV=production

# Secrets
ADMIN_JWT_SECRET=$JWT_SECRET
TURN_SECRET=$TURN_SECRET

# Optional Features
ENABLE_PLAUSIBLE=$( [[ "$ENABLE_PLAUSIBLE" =~ ^[Yy]$ ]] && echo "true" || echo "false" )
ENABLE_OPENBAO=$( [[ "$ENABLE_OPENBAO" =~ ^[Yy]$ ]] && echo "true" || echo "false" )

# Service URLs (Defaults)
WEB_STATUS_URL=https://$BASE_DOMAIN
SIGNAL_STATUS_URL=https://signal.$BASE_DOMAIN/peerjs/id
EOF

echo ""
echo "✅ .env generated successfully."

# 4. Docker Compose Instructions
PROFILES="--profile core"
[[ "$ENABLE_PLAUSIBLE" =~ ^[Yy]$ ]] && PROFILES="$PROFILES --profile analytics"
[[ "$ENABLE_OPENBAO" =~ ^[Yy]$ ]] && PROFILES="$PROFILES --profile secrets"

echo "🚀 To start your p2p.red instance, run:"
echo "   docker compose $PROFILES up -d"
echo ""
echo "Note: Ensure your DNS (A records) are pointed to this server for:"
echo " - $BASE_DOMAIN"
[[ "$ENABLE_PLAUSIBLE" =~ ^[Yy]$ ]] && echo " - plausible.$BASE_DOMAIN"
[[ "$ENABLE_OPENBAO" =~ ^[Yy]$ ]] && echo " - bao.$BASE_DOMAIN"
echo "=========================="
