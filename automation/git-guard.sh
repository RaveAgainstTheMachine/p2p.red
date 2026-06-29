#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

FORBIDDEN_REGEX='^(envoy-runtime/traffic_split/)' 

STAGED=$(git diff --cached --name-only 2>/dev/null || true)
if [ -z "$STAGED" ]; then
  exit 0
fi

if echo "$STAGED" | grep -qE "$FORBIDDEN_REGEX"; then
  echo "❌ Refusing to commit mutable runtime state (envoy-runtime/traffic_split/*)." >&2
  echo "   Revert those changes or unstage them before committing." >&2
  exit 1
fi
