#!/bin/bash
set -e

echo "🚀 Starting P2P.RED Nuclear Staging Sync..."

# 1. Sync from master
git checkout public
git merge master --no-edit -X ours

# 2. Whitelist-Based Recovery
TEMP_DIR=$(mktemp -d)
echo "📁 Staging whitelisted files to $TEMP_DIR..."

# Whitelisted Folders (Entirely)
cp -r packages/ metadata-api/ src/ .github/ "$TEMP_DIR/"

# Whitelisted Root Files
ROOT_WHITELIST=("README.md" "LICENSE" "package.json" "package-lock.json" "pnpm-workspace.yaml" ".gitignore" ".gitattributes" "docker-compose.yml" "Dockerfile" "Dockerfile.envoy" "Dockerfile.metadata-api" "Dockerfile.peerjs" "Dockerfile.nginx" "envoy.yaml" "turnserver.conf" "pnpm-lock.yaml")
for f in "${ROOT_WHITELIST[@]}"; do
    [ -f "$f" ] && cp "$f" "$TEMP_DIR/"
done

# Whitelisted Documentation
mkdir -p "$TEMP_DIR/PROJECT_DOCUMENTATION"
ALLOWED_DOCS=("README.md" "ARCHITECTURE.md" "INFRASTRUCTURE.md" "SELF_HOSTING.md" "WEBRTC_ARCHITECTURE_GUIDE.md" "LARGE-FILE-TRANSFER.md" "MEMORY-OPTIMIZATION.md")
for doc in "${ALLOWED_DOCS[@]}"; do
    [ -f "PROJECT_DOCUMENTATION/$doc" ] && cp "PROJECT_DOCUMENTATION/$doc" "$TEMP_DIR/PROJECT_DOCUMENTATION/"
done

# Whitelisted Automation
mkdir -p "$TEMP_DIR/automation"
cp automation/public-sync.sh automation/README.md "$TEMP_DIR/automation/"

# 3. Nuclear Swap
echo "🧹 Wiping public branch working tree..."
find . -maxdepth 1 -not -name ".git" -not -name "." -exec rm -rf {} +

echo "🚚 Restoring whitelisted content..."
cp -r "$TEMP_DIR"/* .
rm -rf "$TEMP_DIR"

# 4. Metadata Injection
echo "🏷️ Re-injecting public metadata..."
find . -name "package.json" -not -path "*/node_modules/*" -exec sed -i 's/"author": ".*"/"author": "Steven Frost"/g' {} +
find . -name "package.json" -not -path "*/node_modules/*" -exec sed -i 's/"license": ".*"/"license": "BSL-1.1"/g' {} +

# 5. Commit and Finish
git add -A
if ! git diff-index --quiet HEAD; then
    git commit -m "chore: nuclear whitelist sync (100% bone-dry guaranteed)"
else
    echo "✅ No changes to commit (already bone-dry)."
fi

git checkout master
echo "🏁 Done. Public is now 100% Sanitized."
