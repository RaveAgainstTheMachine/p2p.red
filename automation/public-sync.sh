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
  "PROJECT_DOCUMENTATION/PRIVATE"
  "PROJECT_DOCUMENTATION/*_PRIVATE.md"
  "PROJECT_DOCUMENTATION/*_SENSITIVE.md"
  "PROJECT_DOCUMENTATION/INTERNAL_*.md"
  "MONETIZATION_STRATEGIES.md"
  "ADVERTISING_PLAN.md"
  "vacuum-test"
  "PROJECT_DOCUMENTATION/ADMIN_DASHBOARD.md"
  "PROJECT_DOCUMENTATION/ANALYTICS.md"
  "PROJECT_DOCUMENTATION/BUILD_DEPLOY.md"
  "PROJECT_DOCUMENTATION/DEV_STABILIZATION.md"
  "PROJECT_DOCUMENTATION/INFRASTRUCTURE.md"
  "PROJECT_DOCUMENTATION/INFRA_SETUP_TEMPLATE.md"
  "PROJECT_DOCUMENTATION/LOAD_BALANCER_MIGRATION.md"
  "PROJECT_DOCUMENTATION/OPENBAO_SETUP.md"
  "PROJECT_DOCUMENTATION/VPS_DEPLOYMENT_GUIDE.md"
  "PROJECT_DOCUMENTATION/WG_SSH_BASTION_SETUP.md"
  "PROJECT_DOCUMENTATION/INCIDENT_REPORTS"
  "PROJECT_DOCUMENTATION/TELEMETRY.md"
  "INCIDENT_REPORT_TLS_503.md"
  "git_log.txt"
  "PROJECT_DOCUMENTATION/DESKTOP_APP_PLAN.md"
  "PROJECT_DOCUMENTATION/DESKTOP_APP_PROJECT_PLAN.md"
  "PROJECT_DOCUMENTATION/MALWARE_SCANNING_PLAN.md"
  "PROJECT_DOCUMENTATION/MEMORY-OPTIMIZATION.md"
  "PROJECT_DOCUMENTATION/PROJECT_OVERVIEW.md"
  "PROJECT_DOCUMENTATION/SECURITY-REVIEW-REPORT.md"
  "PROJECT_DOCUMENTATION/SEO_TRAFFIC_PLAN.md"
  "PROJECT_DOCUMENTATION/STYLING_PHILOSOPHY.md"
  "PROJECT_DOCUMENTATION/TESTING.md"
  "PROJECT_DOCUMENTATION/UI_IMPLEMENTATION_GUIDE.md"
  "PROJECT_DOCUMENTATION/UI_THEME_DOCUMENTATION.md"
  "PROJECT_DOCUMENTATION/WEBRTC_IMPLEMENTATION_PLAN.md"
  "PROJECT_DOCUMENTATION/WEBRTC_P2P_PROMPT.md"
  "PROJECT_DOCUMENTATION/WEBRTC_P2P_RULES.md"
  "PROJECT_DOCUMENTATION/LESSONS_DEP_UPGRADE.md"
  "PROJECT_DOCUMENTATION/LARGE-FILE-TRANSFER.md"
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
done

echo "✅ Public repo sync complete: $PUBLIC_REPO"
