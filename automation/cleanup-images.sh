#!/bin/bash

set -euo pipefail

KEEP_COUNT=${KEEP_COUNT:-}
DEPLOY_ENV=${DEPLOY_ENV:-prod}

if [ -z "$KEEP_COUNT" ]; then
  if [ "$DEPLOY_ENV" = "dev" ]; then
    KEEP_COUNT=10
  else
    KEEP_COUNT=1
  fi
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ docker not found"
  exit 1
fi

echo "🧹 Cleaning old app images (keep $KEEP_COUNT previous per variant)"

IN_USE_IMAGE_IDS=$(docker ps -q | xargs -r docker inspect -f '{{.Image}}' | sort -u || true)

is_in_use() {
  local image_id="$1"
  echo "$IN_USE_IMAGE_IDS" | grep -q "$image_id"
}

cleanup_variant() {
  local variant="$1"
  local ids
  ids=$(docker image ls --filter "label=p2p.build_variant=$variant" -q | sort -u || true)
  if [ -z "$ids" ]; then
    return
  fi

  mapfile -t sorted < <(docker image inspect --format '{{.Id}} {{.Created}}' $ids | sort -rk2)

  local keep=0
  for entry in "${sorted[@]}"; do
    local image_id
    image_id=$(echo "$entry" | awk '{print $1}')

    if [ $keep -lt $KEEP_COUNT ]; then
      keep=$((keep + 1))
      continue
    fi

    if is_in_use "$image_id"; then
      echo "⚠️  Skipping in-use image $image_id"
      continue
    fi

    echo "🗑️  Removing old $variant image $image_id"
    docker rmi -f "$image_id" >/dev/null 2>&1 || true
  done
}

cleanup_variant blue
cleanup_variant green

if [ "$DEPLOY_ENV" = "dev" ]; then
  echo "🧹 Removing dangling images (dev)"
  docker image prune -f >/dev/null 2>&1 || true
fi

echo "✅ Image cleanup complete"
