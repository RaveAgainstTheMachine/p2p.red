#!/bin/bash

set -euo pipefail

SECRETS_DIR=${SECRETS_DIR:-./local-secrets}

rand_hex() {
  openssl rand -hex "$1"
}

if ! command -v openssl >/dev/null 2>&1; then
  echo "❌ openssl not found in PATH." >&2
  exit 1
fi

umask 077
mkdir -p "$SECRETS_DIR"

postgres_password=$(rand_hex 24)
turn_secret=$(rand_hex 32)
plausible_db_password=$(rand_hex 24)
plausible_secret_key_base=$(rand_hex 32)

cat > "$SECRETS_DIR/metadata.env" <<EOF
POSTGRES_PASSWORD=$postgres_password
TURN_SECRET=$turn_secret
EOF

cat > "$SECRETS_DIR/plausible.env" <<EOF
PLAUSIBLE_DB_PASSWORD=$plausible_db_password
POSTGRES_PASSWORD=$plausible_db_password
SECRET_KEY_BASE=$plausible_secret_key_base
DATABASE_URL=postgres://plausible:$plausible_db_password@plausible-db:5432/plausible
EOF

echo "✅ Wrote local-only secrets to $SECRETS_DIR"
