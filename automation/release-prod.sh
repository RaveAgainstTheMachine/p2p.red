#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Strict by default
DEPLOY_ENV=${DEPLOY_ENV:-prod}
USE_PREBUILT_IMAGES=${USE_PREBUILT_IMAGES:-1}

APP_IMAGE_BLUE=${APP_IMAGE_BLUE:-p2p-app-blue:latest}
APP_IMAGE_GREEN=${APP_IMAGE_GREEN:-p2p-app-green:latest}

METADATA_API_ENV_FILE=${METADATA_API_ENV_FILE:-/run/secrets/metadata.env}

if [ "$DEPLOY_ENV" != "prod" ]; then
  echo "❌ release-prod.sh must run with DEPLOY_ENV=prod" >&2
  exit 1
fi

# Preflight (host/certs/secrets/envoy admin)
DEPLOY_ENV=prod \
  USE_PREBUILT_IMAGES="$USE_PREBUILT_IMAGES" \
  METADATA_API_ENV_FILE="$METADATA_API_ENV_FILE" \
  APP_IMAGE_BLUE="$APP_IMAGE_BLUE" \
  APP_IMAGE_GREEN="$APP_IMAGE_GREEN" \
  "$REPO_ROOT/automation/preflight.sh" prod

# Sync runtime to snap path if on a snap docker host
if [ -d "/var/snap/docker/common" ] && [ -n "${ENVOY_RUNTIME_DIR:-}" ]; then
  echo "📦 Syncing runtime to snap path: $ENVOY_RUNTIME_DIR"
  sudo mkdir -p "$ENVOY_RUNTIME_DIR"
  sudo cp -r "$REPO_ROOT/envoy-runtime/"* "$ENVOY_RUNTIME_DIR/"
fi

# Ensure runtime services are up (metadata + peerjs + envoy)
METADATA_API_ENV_FILE="$METADATA_API_ENV_FILE" \
ENVOY_RUNTIME_DIR="${ENVOY_RUNTIME_DIR:-./envoy-runtime}" \
docker compose -f docker-compose.yml up -d

# Blue/green switch using prebuilt images
USE_PREBUILT_IMAGES=1 \
  APP_IMAGE_BLUE="$APP_IMAGE_BLUE" \
  APP_IMAGE_GREEN="$APP_IMAGE_GREEN" \
  "$REPO_ROOT/automation/deploy-zero-downtime.sh"
