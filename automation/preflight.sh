#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PHASE=${1:-}

require_env_marker_for_prod() {
  if [ "${DEPLOY_ENV:-}" != "prod" ]; then
    return 0
  fi
  if [ "${ALLOW_MISSING_ENV_MARKER:-0}" = "1" ]; then
    return 0
  fi
  if [ ! -f /etc/p2pred-env ]; then
    fail "Missing /etc/p2pred-env marker. Set to 'prod' on prod hosts or override with ALLOW_MISSING_ENV_MARKER=1."
  fi
  local marker
  marker=$(tr -d '\r\n' </etc/p2pred-env | tr '[:upper:]' '[:lower:]')
  if [ "$marker" != "prod" ]; then
    fail "/etc/p2pred-env is '$marker' (expected 'prod')."
  fi
}

DEPLOY_ENV=${DEPLOY_ENV:-}
ALLOW_PROD_ON_DEV=${ALLOW_PROD_ON_DEV:-0}
ALLOW_DIRTY_GIT=${ALLOW_DIRTY_GIT:-0}
ALLOW_MISSING_ENV_MARKER=${ALLOW_MISSING_ENV_MARKER:-0}

ENVOY_ADMIN_URL=${ENVOY_ADMIN_URL:-http://<ip>:9901}
ENVOY_CERTS_DIR=${ENVOY_CERTS_DIR:-/etc/letsencrypt/live}
METADATA_API_ENV_FILE=${METADATA_API_ENV_FILE:-/run/secrets/metadata.env}
METADATA_HEALTH_URL=${METADATA_HEALTH_URL:-http://<ip>:3001/health}

fail() {
  echo "❌ $*" >&2
  exit 1
}

warn() {
  echo "⚠️  $*" >&2
}

is_dev_host() {
  if command -v ip >/dev/null 2>&1; then
    ip -br -4 a 2>/dev/null | grep -qE '(^|[[:space:]])10\.10\.10\.77/'
    return $?
  fi
  return 1
}

require_prod_not_on_dev() {
  if [ "${DEPLOY_ENV:-}" = "prod" ] && [ "${ALLOW_PROD_ON_DEV:-0}" != "1" ]; then
    if is_dev_host; then
      fail "Refusing prod deploy on dev host (<ip>). Set ALLOW_PROD_ON_DEV=1 to override."
    fi
  fi
}

require_git_clean() {
  if [ "${ALLOW_DIRTY_GIT:-0}" = "1" ]; then
    return 0
  fi
  if command -v git >/dev/null 2>&1; then
    if [ -n "$(git status --porcelain=v1 2>/dev/null || true)" ]; then
      fail "Git working tree is dirty. Commit/stash changes or set ALLOW_DIRTY_GIT=1."
    fi
  fi
}

require_metadata_secrets() {
  if [ ! -f "$METADATA_API_ENV_FILE" ]; then
    fail "Missing secrets env file: $METADATA_API_ENV_FILE"
  fi
}

require_metadata_health() {
  local max_attempts=10
  local attempt=1
  local delay=2
  
  while [ $attempt -le $max_attempts ]; do
    if curl -fsS "$METADATA_HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    warn "Metadata API not reachable at $METADATA_HEALTH_URL (attempt $attempt/$max_attempts). Waiting ${delay}s..."
    sleep $delay
    attempt=$((attempt + 1))
  done
  
  fail "Metadata API not healthy at $METADATA_HEALTH_URL after $max_attempts attempts"
}

require_semver() {
  if [ -x "$REPO_ROOT/automation/semver-check.sh" ]; then
    "$REPO_ROOT/automation/semver-check.sh"
  fi
}

require_envoy_admin() {
  local max_attempts=5
  local attempt=1
  local delay=2
  
  while [ $attempt -le $max_attempts ]; do
    if curl -fsS "$ENVOY_ADMIN_URL/server_info" >/dev/null 2>&1; then
      return 0
    fi
    warn "Envoy admin API not reachable at $ENVOY_ADMIN_URL (attempt $attempt/$max_attempts). Waiting ${delay}s..."
    sleep $delay
    attempt=$((attempt + 1))
  done
  
  fail "Envoy admin API not reachable at $ENVOY_ADMIN_URL after $max_attempts attempts"
}

require_envoy_certs() {
  local required=(
    "$ENVOY_CERTS_DIR/p2p.red/fullchain.pem"
    "$ENVOY_CERTS_DIR/<signal-domain>/fullchain.pem"
    "$ENVOY_CERTS_DIR/plausible.p2p.red/fullchain.pem"
    "$ENVOY_CERTS_DIR/dash.p2p.red/fullchain.pem"
  )
  local missing=0
  for f in "${required[@]}"; do
    if [ ! -s "$f" ]; then
      echo "❌ Missing Envoy TLS bundle: $f" >&2
      missing=1
    fi
  done
  if [ "$missing" -ne 0 ]; then
    fail "Envoy TLS cert bundles missing/empty. Ensure certbot has obtained certs in $ENVOY_CERTS_DIR."
  fi
}

case "$PHASE" in
  dev)
    # Dev: just ensure metadata is reachable; do not assume Envoy/certs.
    require_metadata_health
    ;;
  prod)
    require_env_marker_for_prod
    require_prod_not_on_dev
    require_metadata_secrets
    require_metadata_health
    require_envoy_admin
    require_envoy_certs
    ;;
  build)
    require_git_clean
    require_semver
    ;;
  "")
    warn "No phase provided. Use: preflight.sh {dev|prod|build}"
    ;;
  *)
    fail "Unknown preflight phase: $PHASE"
    ;;
esac
