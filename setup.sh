#!/bin/bash
set -e

echo "🚀 p2p.red Self-Host Orchestrator"
echo "--------------------------------"

# Default config
ENABLE_PLAUSIBLE=false
ENABLE_OPENBAO=false

read -p "Enable Plausible Analytics? (y/N): " USE_PLAUSIBLE
[[ "$USE_PLAUSIBLE" =~ ^[Yy]$ ]] && ENABLE_PLAUSIBLE=true

read -p "Enable OpenBao Secret Management? (y/N): " USE_OPENBAO
[[ "$USE_OPENBAO" =~ ^[Yy]$ ]] && ENABLE_OPENBAO=true

# Generate .env
cat > .env << ENV_EOF
# Core
BASE_DOMAIN=p2p.red
NODE_ENV=production

# Feature Flags
ENABLE_PLAUSIBLE=$ENABLE_PLAUSIBLE
ENABLE_OPENBAO=$ENABLE_OPENBAO

# Optional Keys (Only if enabled)
PLAUSIBLE_DOMAIN=${PLAUSIBLE_DOMAIN:-}
VAULT_ADDR=${VAULT_ADDR:-}
ENV_EOF

echo "✅ Configuration generated in .env"
echo "🚀 To start: docker compose up -d"
