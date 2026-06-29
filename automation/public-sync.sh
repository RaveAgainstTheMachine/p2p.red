#!/bin/bash

set -euo pipefail

DEV_REPO=${DEV_REPO:-"$(pwd)"}
PUBLIC_REPO=${PUBLIC_REPO:-""}
PUBLIC_SYNC_DRY_RUN=${PUBLIC_SYNC_DRY_RUN:-0}

if [ -z "$PUBLIC_REPO" ]; then
  echo "❌ PUBLIC_REPO is required."
  echo "Usage: PUBLIC_REPO=/path/to/public-repo ./automation/public-sync.sh"
  exit 1
fi

EXCLUDES=(
  ".git"
  "node_modules"
  "dist"
  "build"
  ".env"
  ".env.*"
  "metadata-api/.env"
  "turnserver.conf"
  "p2p.red_ecdsa"
  "p2p.red_ecdsa.pub"
  "p2p_deploy"
  "p2p_dev_key"
  "MONETIZATION_STRATEGIES.md"
  "ADVERTISING_PLAN.md"
  "vacuum-test"
  "git_log.txt"
  "envoy.yaml"
  "envoy.dev.yaml"
  "envoy.local.yaml"
  "envoy-runtime/"
  "docker-compose.yml"
  "docker-compose.blue-green.yml"
  "docker-compose.dev-blue-green.yml"
  "docker-compose.local-prod.yml"
  "docker-compose.metadata.yml"
  "automation/release-prod.sh"
  "automation/preflight.sh"
  "automation/build-prod-images.sh"
  "automation/build-local-prod-images.sh"
  "automation/deploy-runtime.sh"
  "automation/deploy-zero-downtime.sh"
  "automation/deploy-zero-downtime-dev.sh"
  "automation/p2p-stack-start.sh"
  "automation/p2p-stack.service"
  "automation/health-sentinel.sh"
  "automation/p2p-health-sentinel.timer"
  "automation/p2p-health-sentinel.service"
  "automation/renew-certs-hook.sh"
  "automation/local-prod-secrets.sh"
  "automation/local-prod-certs.sh"
  "automation/local-prod-preflight.sh"
  "automation/render-local-secrets.sh"
  "automation/switch-upstream.sh"
  "automation/envoy-shift-traffic.sh"
  "deploy.sh"
  "deploy-metadata-api.sh"
)

RSYNC_EXCLUDES=()
for item in "${EXCLUDES[@]}"; do
  RSYNC_EXCLUDES+=("--exclude=$item")
done

RSYNC_ARGS=("-a" "--delete")
if [ "$PUBLIC_SYNC_DRY_RUN" = "1" ]; then
  RSYNC_ARGS+=("--dry-run" "--itemize-changes")
fi

if [ "$PUBLIC_SYNC_DRY_RUN" = "1" ]; then
  echo "🧪 Dry run enabled (no files will be modified)."
fi

echo "🔄 Syncing dev repo to public repo..."
rsync "${RSYNC_ARGS[@]}" "${RSYNC_EXCLUDES[@]}" "$DEV_REPO/" "$PUBLIC_REPO/"

if [ "$PUBLIC_SYNC_DRY_RUN" = "1" ]; then
  echo "ℹ️  Dry run enabled - skipping redaction."
  echo "✅ Public repo sync dry run complete: $PUBLIC_REPO"
  exit 0
fi

echo "🧹 Redacting public copy (docs/scripts/configs only)..."
REDACT_FILES=$(find "$PUBLIC_REPO" -type f \( \
  -name "*.md" -o \
  -name "*.sh" -o \
  -name "*.yml" -o \
  -name "*.yaml" -o \
  -name "*.conf" -o \
  -name "*.js" -o \
  -name "*.ts" -o \
  -name "*.tsx" \
\))

for file in $REDACT_FILES; do
  perl -pi -e 's/\b\d{1,3}(?:\.\d{1,3}){3}\b/<ip>/g' "$file"
  perl -pi -e 's/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/<email>/g' "$file"
  perl -pi -e 's/\bdev-signal\.p2p\.red\b/<dev-signal-domain>/g' "$file"
  perl -pi -e 's/\bdev-turn\.p2p\.red\b/<dev-turn-domain>/g' "$file"
  perl -pi -e 's/\bdev\.p2p\.red\b/<dev-domain>/g' "$file"
  perl -pi -e 's/\bsignal\.p2p\.red\b/<signal-domain>/g' "$file"
  perl -pi -e 's/\bturn1\.p2p\.red\b/<turn1-domain>/g' "$file"
  perl -pi -e 's/\bturn2\.p2p\.red\b/<turn2-domain>/g' "$file"
  perl -pi -e 's/\bbao\.p2p\.red\b/<bao-domain>/g' "$file"
  
  if [[ "$file" =~ \.(md|sh|yml|yaml|conf)$ ]]; then
    perl -pi -e 's/\bp2p\.red\b/<domain>/g' "$file"
  fi
done

echo "✅ Public repo sync complete: $PUBLIC_REPO"
