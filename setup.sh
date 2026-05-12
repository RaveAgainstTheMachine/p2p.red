#!/bin/bash
set -e

cat << "BANNER"
'########:::'#######::'########:::::::'########::'########:'########::
 ##.... ##:'##.... ##: ##.... ##:::::: ##.... ##: ##.....:: ##.... ##:
 ##:::: ##:..::::: ##: ##:::: ##:::::: ##:::: ##: ##::::::: ##:::: ##:
 ########:::'#######:: ########::::::: ########:: ######::: ##:::: ##:
 ##.....:::'##:::::::: ##.....:::::::: ##.. ##::: ##...:::: ##:::: ##:
 ##:::::::: ##:::::::: ##::::::::'###: ##::. ##:: ##::::::: ##:::: ##:
 ##:::::::: #########: ##:::::::: ###: ##:::. ##: ########: ########::
..:::::::::.........::..:::::::::...::..:::::..::........::........:::
BANNER

# p2p.red Self-Host Setup Orchestrator
echo "🚀 P2P File Share Self-Host Setup"
echo "=========================="

# 1. Environment Configuration
echo "📝 Configuration"
echo "----------------"
read -p "Enter your base domain or local IP [example.com]: " BASE_DOMAIN
BASE_DOMAIN=${BASE_DOMAIN:-example.com}

read -p "Enter data storage root path [/opt/p2p-file-share/data]: " DATA_ROOT
DATA_ROOT=${DATA_ROOT:-/opt/p2p-file-share/data}

echo ""
echo "--- Optional Components ---"
read -p "Enable Plausible Analytics? (y/N): " ENABLE_PLAUSIBLE
read -p "Enable OpenBao Secrets Management? (y/N): " ENABLE_OPENBAO

# 2. Secret Generation
JWT_SECRET=$(openssl rand -base64 32)
TURN_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 16)
REDIS_PASSWORD=$(openssl rand -base64 16)

# 3. Create Data Directories
echo "📁 Creating data directories in $DATA_ROOT..."
mkdir -p "$DATA_ROOT/postgres"
mkdir -p "$DATA_ROOT/redis"
mkdir -p "$DATA_ROOT/envoy-runtime"
mkdir -p "$DATA_ROOT/certs"

# 4. Create .env
cat <<EOT > .env
# Core
BASE_DOMAIN=$BASE_DOMAIN
BASE_URL=https://$BASE_DOMAIN
DATA_ROOT=$DATA_ROOT
ADMIN_JWT_SECRET=$JWT_SECRET

# Database
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD

# Optional Services
ENABLE_PLAUSIBLE=$ENABLE_PLAUSIBLE
ENABLE_OPENBAO=$ENABLE_OPENBAO

# Docker Env Files
METADATA_API_ENV_FILE=.env
PLAUSIBLE_ENV_FILE=.env
BAO_ENV_FILE=.env

# Networking
TURN_SECRET=$TURN_SECRET
ENVOY_RUNTIME_DIR=$DATA_ROOT/envoy-runtime
ENVOY_CERTS_DIR=$DATA_ROOT/certs
EOT

# 5. Generate Self-Signed Certificates
echo "🔐 Generating self-signed certificates for $BASE_DOMAIN..."
openssl req -x509 -newkey rsa:4096 -keyout "$DATA_ROOT/certs/key.pem" -out "$DATA_ROOT/certs/cert.pem" -days 365 -nodes -subj "/CN=$BASE_DOMAIN"

echo ""
echo "✅ .env and certificates generated successfully."

# 6. Inject into configs
if [ -f "turnserver.conf" ]; then
    sed -i "s|static-auth-secret=.*|static-auth-secret=$TURN_SECRET|" turnserver.conf
    sed -i "s|realm=.*|realm=$BASE_DOMAIN|" turnserver.conf
    echo "✅ turnserver.conf updated."
fi

if [ -f "envoy.yaml" ]; then
    echo "🛠 Injecting configuration and certificates into envoy.yaml..."
    sed -i "s|P2P_DOMAIN_PLACEHOLDER|$BASE_DOMAIN|g" envoy.yaml
    
    CERT_CONTENT=$(cat "$DATA_ROOT/certs/cert.pem")
    KEY_CONTENT=$(cat "$DATA_ROOT/certs/key.pem")
    
    python3 -c "
import sys
cert = \"\"\"$CERT_CONTENT\"\"\"
key = \"\"\"$KEY_CONTENT\"\"\"
with open(\"envoy.yaml\", \"r\") as f:
    content = f.read()
content = content.replace(\"P2P_CERT_PEM_PLACEHOLDER\", cert.strip())
content = content.replace(\"P2P_KEY_PEM_PLACEHOLDER\", key.strip())
with open(\"envoy.yaml\", \"w\") as f:
    f.write(content)
"
    echo "✅ envoy.yaml updated and certificates injected."
fi

# 7. Docker Compose Instructions
PROFILES="--profile core"
[[ "$ENABLE_PLAUSIBLE" =~ ^[Yy]$ ]] && PROFILES="$PROFILES --profile analytics"
[[ "$ENABLE_OPENBAO" =~ ^[Yy]$ ]] && PROFILES="$PROFILES --profile secrets"

echo "🚀 To start your instance, run:"
echo "   docker compose $PROFILES up -d"
echo "=========================="
