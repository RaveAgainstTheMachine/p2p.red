#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ALLOW_SAME_VERSION=${ALLOW_SAME_VERSION:-0}

APP_VERSION=$(node -p "require('$REPO_ROOT/package.json').version")

if [[ ! "$APP_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "❌ package.json version '$APP_VERSION' is not valid SemVer (MAJOR.MINOR.PATCH)." >&2
  exit 1
fi

if command -v git >/dev/null 2>&1; then
  latest_tag=$(git -C "$REPO_ROOT" tag --list 'v*' --sort=-v:refname | head -n 1 || true)
  if [ -n "$latest_tag" ] && [ "$ALLOW_SAME_VERSION" != "1" ]; then
    latest_version=${latest_tag#v}
    if [ "$latest_version" = "$APP_VERSION" ]; then
      echo "❌ package.json version '$APP_VERSION' matches latest tag '$latest_tag'. Bump SemVer before release or set ALLOW_SAME_VERSION=1." >&2
      exit 1
    fi
  fi
fi

exit 0
