#!/bin/bash

set -euo pipefail

# Configuration
# KEEP_COUNT is the number of PREVIOUS versions to keep in addition to the current one
# For blue/green, we naturally have 1 of each, so KEEP_COUNT=1 ensures we have current + previous
KEEP_COUNT=${KEEP_COUNT:-1} 
DEPLOY_ENV=${DEPLOY_ENV:-prod}
PROJECT_PREFIX="p2p-"

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ docker not found"
  exit 1
fi

echo "🧹 Starting surgical image cleanup (keeping latest + $KEEP_COUNT previous per repository)"

# Also get images that are currently in use by any p2p container
# We use labels and names to find project containers
IN_USE_IMAGE_IDS=$(docker ps -a --filter "name=p2p" -q | xargs -r docker inspect -f '{{.Image}}' | sort -u || true)

# Function to check if an image is in use
is_in_use() {
  local image_id="$1"
  echo "$IN_USE_IMAGE_IDS" | grep -q "$image_id"
}

# 1. Handle project-prefixed repositories
REPOS=$(docker image ls --format "{{.Repository}}" | grep -E "^$PROJECT_PREFIX" | sort -u || true)

for repo in $REPOS; do
  echo "🔍 Auditing repository: $repo"
  
  # Get all image IDs for this repo, sorted by creation date (newest first)
  # Use --no-trunc to get full IDs for accurate comparison
  mapfile -t repo_images < <(docker image ls --no-trunc "$repo" --format "{{.ID}} {{.CreatedAt}}" | sort -rk2)
  
  if [ ${#repo_images[@]} -le $((KEEP_COUNT + 1)) ]; then
    echo "  ✅ Only ${#repo_images[@]} images found. Keeping all."
    continue
  fi

  # Identify which images to keep (first KEEP_COUNT + 1)
  local kept=0
  for i in "${!repo_images[@]}"; do
    local img_info="${repo_images[$i]}"
    local img_id=$(echo "$img_info" | awk '{print $1}')
    
    if [ $kept -le $KEEP_COUNT ]; then
      echo "  📌 Keeping $repo image: ${img_id:0:12} (Rank $((kept+1)))"
      kept=$((kept + 1))
      continue
    fi

    # Check if image is in use (don't delete if running or stopped but exists)
    if is_in_use "$img_id"; then
      echo "  ⚠️  Skipping in-use image: ${img_id:0:12}"
      continue
    fi

    # Safe to remove
    echo "  🗑️  Removing old image: ${img_id:0:12}"
    docker rmi "$img_id" >/dev/null 2>&1 || true
  done
done

# 2. Cleanup dangling images (layers without tags)
# This is safe as it only removes layers that aren't part of any tagged image
echo "🧹 Pruning dangling images..."
docker image prune -f >/dev/null 2>&1 || true

echo "✅ Surgical cleanup complete"
