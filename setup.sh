#!/bin/bash
set -e

# p2p.red Self-Host Setup Orchestrator
echo "🚀 P2P File Share Self-Host Setup"
echo "=========================="

# 1. Environment Configuration
read -p "Enter your base domain (e.g., example.com) [example.com]: " BASE_DOMAIN
BASE_DOMAIN=${BASE_DOMAIN:-example.com}

read -p "Enter TLS Cert PKCS12 Password [p2pred]: " TLS_PASSWORD
TLS_PASSWORD=${TLS_PASSWORD:-p2pred}

echo ""
echo "--- Optional Components ---"
read -p "Enable Plausible Analytics? (y/N): " ENABLE_PLAUSIBLE
read -p "Enable OpenBao Secrets Management? (y/N): " ENABLE_OPENBAO

# 2. Secret Generation
JWT_SECRET=$(openssl rand -base64 32)
TURN_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 16)
REDIS_PASSWORD=$(openssl rand -base64 16)

# 3. Create .env
cat <<EOF > .env
# Core
BASE_DOMAIN=$BASE_DOMAIN
BASE_URL=https://$BASE_DOMAIN
ADMIN_JWT_SECRET=$JWT_SECRET

# Database
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD

# Optional Services
ENABLE_PLAUSIBLE=${ENABLE_PLAUSIBLE:-n}
ENABLE_OPENBAO=${ENABLE_OPENBAO:-n}

# Networking
TURN_SECRET=$TURN_SECRET
EOF

echo ""
echo "✅ .env generated successfully."

# 4. Inject into configs
if [ -f "turnserver.conf" ]; then
    sed -i "s/static-auth-secret=.*/static-auth-secret=$TURN_SECRET/" turnserver.conf
    sed -i "s/realm=.*/realm=$BASE_DOMAIN/" turnserver.conf
    echo "✅ turnserver.conf updated."
fi

if [ -f "envoy.yaml" ]; then
    sed -i "s/P2P_DOMAIN_PLACEHOLDER/$BASE_DOMAIN/g" envoy.yaml
    sed -i "s/P2P_TLS_PASSWORD_PLACEHOLDER/$TLS_PASSWORD/g" envoy.yaml
    echo "✅ envoy.yaml updated."
fi

# 5. Docker Compose Instructions
PROFILES="--profile core"
[[ "$ENABLE_PLAUSIBLE" =~ ^[Yy]$ ]] && PROFILES="$PROFILES --profile analytics"
[[ "$ENABLE_OPENBAO" =~ ^[Yy]$ ]] && PROFILES="$PROFILES --profile secrets"

echo "🚀 To start your instance, run:"
echo "   docker compose $PROFILES up -d"
echo ""
echo "Note: Ensure your DNS (A records) are pointed to this server for:"
echo " - $BASE_DOMAIN"
[[ "$ENABLE_PLAUSIBLE" =~ ^[Yy]$ ]] && echo " - plausible.$BASE_DOMAIN"
[[ "$ENABLE_OPENBAO" =~ ^[Yy]$ ]] && echo " - bao.$BASE_DOMAIN"
echo "=========================="
