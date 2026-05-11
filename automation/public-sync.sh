#!/bin/bash
set -e

# P2P.RED Ghost Sync Engine
echo "🚀 Starting P2P.RED Ghost Sync (Public Purge)..."

# Ensure we're on public
git checkout public

# Nuclear wipe of the public branch (except .git)
find . -maxdepth 1 -not -name ".git" -not -name "." -exec rm -rf {} +

# Whitelist checkout from master
# ONLY code, root assets, and public CI/CD
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

# Cleanup .github - remove internal sync workflow from public
rm -f .github/workflows/public-sync.yml

# Metadata Injection
echo "🏷️ Re-injecting public metadata..."
find . -name "package.json" -not -path "*/node_modules/*" -exec sed -i 's/"author": ".*"/"author": "Steven Frost"/g' {} +
find . -name "package.json" -not -path "*/node_modules/*" -exec sed -i 's/"license": ".*"/"license": "BSL-1.1"/g' {} +

# Commit
git add -A
if ! git diff-index --quiet HEAD; then
    git commit -m "chore: public release hardening (removed internal tools & docs)"
else
    echo "✅ Public branch already clean."
fi

# Return to master
git checkout master
echo "🏁 Done. public branch is a lean, self-host ready mirror."
