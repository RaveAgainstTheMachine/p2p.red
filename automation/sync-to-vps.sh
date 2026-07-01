#!/bin/bash
# Syncs the current local repository codebase to the VPS.
# This ensures that deployment scripts, docker-compose.yml, and init.sql
# are up to date on the VPS before a deployment runs.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

VPS_HOST="${VPS_HOST:-ubuntu@<ip>}"
SSH_OPTS="-i ~/.ssh/p2p_deploy -o ProxyCommand=\"ssh -i ~/.ssh/p2p_dev_key -W %h:%p debian@<ip>\""

echo "🔄 Syncing repository to VPS ($VPS_HOST)..."

rsync -avz --delete \
    --rsync-path="sudo rsync" \
    -e "ssh $SSH_OPTS" \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude 'images' \
    --exclude '.env' \
    --exclude 'envoy-runtime/current' \
    "$REPO_ROOT/" "$VPS_HOST:/opt/p2p-file-share/"

echo "✅ Sync complete!"
