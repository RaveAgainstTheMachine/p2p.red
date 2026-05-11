#!/bin/bash
set -e

echo "🚀 Starting P2P.RED Pure Whitelist Sync..."

git checkout public

# Nuclear wipe (except .git)
find . -maxdepth 1 -not -name ".git" -not -name "." -exec rm -rf {} +

# Whitelist checkout from master
WHITELIST=(
  "packages"
  "metadata-api"
  "src"
  ".github"
  "README.md"
  "LICENSE"
  "package.json"
  "pnpm-lock.yaml"
  "pnpm-workspace.yaml"
  ".gitignore"
  ".gitattributes"
  "docker-compose.yml"
  "Dockerfile*"
  "envoy.yaml"
  "turnserver.conf"
  "setup.sh"
)

for item in "${WHITELIST[@]}"; do
  git checkout master -- "$item" || echo "⚠️ Warning: $item not found on master"
done

# Force-remove any node_modules that might have been checked out
find . -name "node_modules" -type d -exec rm -rf {} +

# Metadata Fix
find . -name "package.json" -not -path "*/node_modules/*" -exec sed -i 's/"author": ".*"/"author": "Steven Frost"/g' {} +
find . -name "package.json" -not -path "*/node_modules/*" -exec sed -i 's/"license": ".*"/"license": "BSL-1.1"/g' {} +

# Commit
git add -A
if ! git diff-index --quiet HEAD; then
    git commit -m "chore: pure whitelist sync (node_modules and root bloat purged)"
else
    echo "✅ No changes to commit (already pure)."
fi

git checkout master
