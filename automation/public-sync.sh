#!/bin/bash

# P2P.RED Public Sync & Sanitization Orchestrator
# Author: Steven Frost
# Purpose: Mirror master to public while stripping internal documentation and metadata.

set -e

# Configuration
SOURCE_BRANCH="master"
TARGET_BRANCH="public"
NON_PUBLIC_DOCS=(
  ".windsurf"
  "PROJECT_DOCUMENTATION/INCIDENT_REPORTS"
  "PROJECT_DOCUMENTATION/ADMIN_DASHBOARD.md"
  "PROJECT_DOCUMENTATION/TELEMETRY.md"
  "PROJECT_DOCUMENTATION/ANALYTICS.md"
  "PROJECT_DOCUMENTATION/LOAD_BALANCER_MIGRATION.md"
  "PROJECT_DOCUMENTATION/LESSONS_DEP_UPGRADE.md"
  "PROJECT_DOCUMENTATION/UI_IMPLEMENTATION_GUIDE.md"
  "PROJECT_DOCUMENTATION/STYLING_PHILOSOPHY.md"
  "PROJECT_DOCUMENTATION/WEBRTC_P2P_RULES.md"
  "PROJECT_DOCUMENTATION/WEBRTC_P2P_PROMPT.md"
  "GEMINI.md"
  ".cursorrules"
  ".gemini"
  "skills"
  "PROJECT_DOCUMENTATION/INFRASTRUCTURE.md"
  "PROJECT_DOCUMENTATION/WG_SSH_BASTION_SETUP.md"
  "PROJECT_DOCUMENTATION/OPENBAO_SETUP.md"
  "PROJECT_DOCUMENTATION/VPS_DEPLOYMENT_GUIDE.md"
  "PROJECT_DOCUMENTATION/INFRA_SETUP_TEMPLATE.md"
)

echo "🚀 Starting P2P.RED Sanitized Sync..."

# 1. Ensure we are starting from a clean state
if [[ $(git status --short) ]]; then
  echo "❌ Error: Working tree is not clean. Commit or stash changes first."
  exit 1
fi

# 2. Switch to public and merge master
echo "🔄 Merging $SOURCE_BRANCH into $TARGET_BRANCH..."
git checkout $TARGET_BRANCH
git merge $SOURCE_BRANCH -m "chore: auto-sync from master $(date +%F)" --no-edit

# 3. The "No-No Purge"
echo "🧼 Purging internal-only documentation..."
for doc in "${NON_PUBLIC_DOCS[@]}"; do
  if [ -f "$doc" ]; then
    rm "$doc"
    echo "  - Removed $doc"
  fi
done

# 4. Metadata Re-Injection (Author & License)
echo "🏷️ Re-injecting public metadata (Steven Frost / BSL 1.1)..."
find . -name "package.json" -not -path "*/node_modules/*" -exec sed -i 's/"license": ".*"/"license": "Business Source License 1.1"/g' {} +
find . -name "package.json" -not -path "*/node_modules/*" -exec sed -i 's/"author": ".*"/"author": "Steven Frost"/g' {} +

# 5. Security Scan (Final Guard)
echo "🔒 Performing final security leak check..."
if git ls-files | grep -E "github_deploy_key|privkey|\.env$"; then
  echo "⚠️ WARNING: Potential secret leak detected! Aborting commit."
  exit 1
fi

# 6. Commit the sanitized state
echo "📝 Committing sanitized release..."
git add .
if git diff --cached --quiet; then
  echo "✅ No changes to commit (already sanitized)."
else
  git commit -m "chore: public release hardening - $(date +%F)"
  echo "✅ Sanitized sync complete."
fi

# 7. Switch back to master
git checkout $SOURCE_BRANCH
echo "🏁 Done. You are back on $SOURCE_BRANCH."
