#!/bin/bash

# publish-github.sh
# Automate publishing a sanitized version to a public GitHub repository.
# Enforces validation checks to prevent history or secret leakage.

set -euo pipefail

DEV_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_REPO="${PUBLIC_REPO:-""}"

if [ -z "$PUBLIC_REPO" ]; then
  echo "❌ Error: PUBLIC_REPO environment variable is required."
  echo "Usage: PUBLIC_REPO=/path/to/public-repo ./automation/publish-github.sh"
  exit 1
fi

if [ ! -d "$PUBLIC_REPO/.git" ]; then
  echo "❌ Error: Target PUBLIC_REPO '$PUBLIC_REPO' is not a valid Git repository."
  exit 1
fi

# 1. Run the sync and sanitization process
echo "🔄 Step 1: Syncing and sanitizing files..."
DEV_REPO="$DEV_REPO" PUBLIC_REPO="$PUBLIC_REPO" "$DEV_REPO/automation/public-sync.sh"

# 2. Run post-sync security validation checks
echo "🔍 Step 2: Running safety checks on target repository..."

# Helper for scanning pattern match
fail_on_match() {
  local pattern="$1"
  local description="$2"
  local exclude_filter="${3:-""}"
  
  # Use grep -I to ignore binary files, and -e to prevent options parsing issues with hyphens
  local matches
  matches=$(grep -rInH --exclude-dir=".git" -e "$pattern" "$PUBLIC_REPO" || true)
  
  if [ -n "$exclude_filter" ] && [ -n "$matches" ]; then
    matches=$(echo "$matches" | grep -v -E "$exclude_filter" || true)
  fi
  
  if [ -n "$matches" ]; then
    echo "❌ Security Violation: $description found in public repository!"
    echo "$matches"
    exit 1
  fi
}

# A. Scan for unredacted domains
echo "   - Checking for unredacted domains..."
fail_on_match '(dev\.p2p\.red|dev-signal\.p2p\.red|dev-turn\.p2p\.red|bao\.p2p\.red)' "Unredacted internal domain"

# B. Scan for raw private IP addresses (excluding localhost/any)
echo "   - Checking for raw IP addresses..."
# Match standard IPv4 addresses, filtering out loopback and any-interface addresses
fail_on_match '\b(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b' "Raw IP address" '127\.0\.0\.1|0\.0\.0\.0'

# C. Scan for SSH private keys
echo "   - Checking for private keys..."
fail_on_match '-----BEGIN [A-Z ]*PRIVATE KEY-----' "SSH private key"

# D. Scan for unredacted email addresses (excluding public @<domain> addresses and @2x/@3x image suffixes)
echo "   - Checking for unredacted emails..."
fail_on_match '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' "Unredacted email address" '@p2p\.red|@[0-9]+x\.(png|jpg|jpeg)'

# E. Scan for secrets/unseal references
echo "   - Checking for unseal references..."
UNSEAL_PATTERN='WDIat'"[A-Za-z0-9+/]+"'JEEWQS'
fail_on_match "(unseal-key|root-token|$UNSEAL_PATTERN)" "Unseal key or token reference"

# 3. Check Git history isolation
echo "🔍 Step 3: Verifying Git history isolation..."
cd "$PUBLIC_REPO"

# Retrieve all commit hashes from the public repo
PUBLIC_COMMITS=$(git log --format="%H" 2>/dev/null || true)

if [ -n "$PUBLIC_COMMITS" ]; then
  # Retrieve dev repo commit hashes
  cd "$DEV_REPO"
  DEV_COMMITS=$(git log --format="%H" 2>/dev/null || true)
  
  # Find if there is any intersection between dev and public commit hashes
  INTERSECTION=$(comm -12 <(echo "$PUBLIC_COMMITS" | sort) <(echo "$DEV_COMMITS" | sort))
  
  if [ -n "$INTERSECTION" ]; then
    echo "❌ Security Violation: Git histories share commit hashes!"
    echo "Common commits found:"
    echo "$INTERSECTION"
    exit 1
  fi
fi

echo "✅ All checks passed successfully. Git history is isolated, and no secrets were detected."
echo "📝 Ready to commit to the public repository."

# 4. Commit changes in public repository as a single squashed commit
cd "$PUBLIC_REPO"
git checkout --orphan temp_branch
git add -A
git commit -m "release: sync sanitized public codebase"
git branch -M main
echo "✅ History squashed into a single commit on branch 'main'."
