#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

HOSTNAME_VAL=$(hostname 2>/dev/null || echo unknown)

IPV4_LINES=""
if command -v ip >/dev/null 2>&1; then
  IPV4_LINES=$(ip -br -4 a 2>/dev/null || true)
fi

ENV_MARKER=""
if [ -f /etc/p2pred-env ]; then
  ENV_MARKER=$(tr -d '\r\n' </etc/p2pred-env | tr '[:upper:]' '[:lower:]')
fi

ENV_GUESS="unknown"
if echo "$ENV_MARKER" | grep -qE '^(dev|prod)$'; then
  ENV_GUESS="$ENV_MARKER"
elif echo "$IPV4_LINES" | grep -qE '(^|[[:space:]])10\.10\.10\.77/'; then
  ENV_GUESS="dev"
fi

echo "host=$HOSTNAME_VAL"
if [ -n "$IPV4_LINES" ]; then
  echo "ipv4=\n$IPV4_LINES"
fi
if [ -n "$ENV_MARKER" ]; then
  echo "env_marker=$ENV_MARKER"
else
  echo "env_marker=missing"
fi
echo "env_guess=$ENV_GUESS"

if [ "$ENV_GUESS" = "dev" ]; then
  echo "dev_web=http://127.0.0.1:5173"
  echo "dev_api=http://127.0.0.1:3001/health"
  echo "dev_peerjs=http://127.0.0.1:9000"
fi
