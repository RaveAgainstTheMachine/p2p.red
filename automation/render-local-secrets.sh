#!/bin/bash

set -euo pipefail

SECRETS_DIR=${SECRETS_DIR:-./local-secrets}
BAO_ADDR=${BAO_ADDR:-}
BAO_TOKEN=${BAO_TOKEN:-}

if [ -z "$BAO_ADDR" ] || [ -z "$BAO_TOKEN" ]; then
  echo "❌ BAO_ADDR and BAO_TOKEN must be set to read OpenBao secrets." >&2
  exit 1
fi

if ! command -v bao >/dev/null 2>&1; then
  echo "❌ bao CLI not found in PATH." >&2
  exit 1
fi

umask 077
mkdir -p "$SECRETS_DIR"

postgres_password=$(bao kv get -address "$BAO_ADDR" -token "$BAO_TOKEN" -field=password kv/p2p/prod/postgres)
turn_secret=$(bao kv get -address "$BAO_ADDR" -token "$BAO_TOKEN" -field=secret kv/p2p/prod/turn)
plausible_db_password=$(bao kv get -address "$BAO_ADDR" -token "$BAO_TOKEN" -field=db_password kv/p2p/prod/plausible)
plausible_secret_key_base=$(bao kv get -address "$BAO_ADDR" -token "$BAO_TOKEN" -field=secret_key_base kv/p2p/prod/plausible)

if [ -z "$postgres_password" ] || [ -z "$turn_secret" ] || [ -z "$plausible_db_password" ] || [ -z "$plausible_secret_key_base" ]; then
  echo "❌ Missing required secrets from OpenBao." >&2
  exit 1
fi

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

echo "✅ Wrote local secrets to $SECRETS_DIR"
