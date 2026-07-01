#!/bin/bash
# p2p-stack-start.sh
# Startup script for p2p.red stack — run by systemd on boot.
# Must be idempotent: safe to run multiple times.
set -euo pipefail

REPO=/opt/p2p-file-share
SECRETS_FILE=/run/secrets/metadata.env
LOG_TAG="p2p-stack"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a /var/log/p2p-stack.log; }

log "=== p2p stack startup ==="

# 1. Wait for Docker daemon
log "Waiting for Docker daemon..."
for i in $(seq 1 30); do
  docker info &>/dev/null && break
  sleep 2
done
docker info &>/dev/null || { log "ERROR: Docker daemon not ready after 60s"; exit 1; }
log "Docker daemon ready."

# 2. Ensure /run/secrets exists and secret paths are FILES not directories
log "Pre-creating secret files in /run/secrets..."
mkdir -p /run/secrets
# Remove any bogus directories Docker may have created in a previous failed run
for f in metadata.env plausible.env bao_token commz.env; do
  if [ -d "/run/secrets/$f" ]; then
    log "WARNING: /run/secrets/$f is a directory — removing"
    rm -rf "/run/secrets/$f"
  fi
  # Create as empty file if not already a file
  if [ ! -f "/run/secrets/$f" ]; then
    touch "/run/secrets/$f"
    chown 100:1000 "/run/secrets/$f" || true
    chmod 660 "/run/secrets/$f" || true
  fi
done
log "Secret file placeholders ready."

# 3. Ensure envoy-runtime current/ directory exists with traffic_split files
log "Ensuring envoy-runtime/current/ exists..."
RUNTIME_SRC="$REPO/envoy-runtime"
RUNTIME_CURRENT="$RUNTIME_SRC/current"
mkdir -p "$RUNTIME_CURRENT/traffic_split"

# Copy runtime defaults only if files don't already exist (preserve live weights)
if [ ! -f "$RUNTIME_CURRENT/traffic_split/app_blue" ]; then
  cp "$REPO/envoy-runtime/traffic_split/app_blue" "$RUNTIME_CURRENT/traffic_split/app_blue"
fi
if [ ! -f "$RUNTIME_CURRENT/traffic_split/app_green" ]; then
  cp "$REPO/envoy-runtime/traffic_split/app_green" "$RUNTIME_CURRENT/traffic_split/app_green"
fi
log "envoy-runtime/current/ ready: blue=$(cat $RUNTIME_CURRENT/traffic_split/app_blue) green=$(cat $RUNTIME_CURRENT/traffic_split/app_green)"

# 4. Start blue-green compose first — creates p2p-bluegreen_p2p-network
log "Starting blue-green stack (creates p2p-bluegreen_p2p-network)..."
cd "$REPO"
APP_IMAGE_BLUE="${APP_IMAGE_BLUE:-p2p-app-blue:latest}" \
APP_IMAGE_GREEN="${APP_IMAGE_GREEN:-p2p-app-green:latest}" \
  docker compose -f docker-compose.blue-green.yml up -d app-blue || {
    log "WARNING: blue-green compose had errors (non-fatal)"
  }

# 5. Give the network time to exist
sleep 2

# 6. Start main stack (openbao-agent starts here, begins writing secrets)
log "Starting main stack..."
METADATA_API_ENV_FILE="$SECRETS_FILE" \
DEPLOY_ENV=prod \
  docker compose up -d || {
    log "ERROR: main docker compose up failed"; exit 1
  }

# 7. Wait for OpenBao agent to populate secrets then restart dependent containers
log "Waiting for OpenBao to write secrets (metadata.env)..."
for i in $(seq 1 60); do
  [ -s "$SECRETS_FILE" ] && break
  sleep 2
done
if [ -s "$SECRETS_FILE" ]; then
  log "Secrets populated. Restarting metadata-api, postgres, plausible-db, peerjs..."
  PID=$(docker inspect p2p-metadata-api 2>/dev/null | grep -i '"Pid":' | head -1 | awk -F: '{print $2}' | tr -d ' ,') || true
  [ -n "$PID" ] && [ "$PID" != "0" ] && kill -9 "$PID" 2>/dev/null || true
  docker rm -f p2p-metadata-api p2p-postgres p2p-plausible-db p2p-peerjs 2>/dev/null || true
  METADATA_API_ENV_FILE="$SECRETS_FILE" DEPLOY_ENV=prod \
    docker compose up -d metadata-api postgres plausible-db peerjs-server || true
  log "Dependent containers restarted."

  log "Initializing Plausible database (if needed)..."
  METADATA_API_ENV_FILE="$SECRETS_FILE" DEPLOY_ENV=prod \
    docker compose run --rm plausible bin/plausible eval 'Plausible.Release.createdb()' || true
  METADATA_API_ENV_FILE="$SECRETS_FILE" DEPLOY_ENV=prod \
    docker compose run --rm plausible bin/plausible eval 'Plausible.Release.migrate()' || true
  docker restart p2p-plausible || true
  log "Plausible database checked/initialized."
else
  log "WARNING: secrets still empty after 120s — check OpenBao agent"
fi

log "=== p2p stack startup complete ==="
