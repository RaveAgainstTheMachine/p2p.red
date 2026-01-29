#!/bin/bash

set -euo pipefail

LOCAL_P2P_HOST=${LOCAL_P2P_HOST:-127.0.0.1}
CERT_DIR=${CERT_DIR:-./local-certs}

mkdir -p "$CERT_DIR"

if command -v mkcert >/dev/null 2>&1; then
  mkcert -install >/dev/null 2>&1 || true
  mkcert -cert-file "$CERT_DIR/local.crt" -key-file "$CERT_DIR/local.key" "$LOCAL_P2P_HOST" localhost
  echo "✅ Local TLS certs written to $CERT_DIR/local.crt and $CERT_DIR/local.key (mkcert)"
  exit 0
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "❌ mkcert not found and openssl missing. Install one to generate certs." >&2
  exit 1
fi

openssl genrsa -out "$CERT_DIR/local.key" 2048 >/dev/null 2>&1
openssl req -x509 -new -nodes \
  -key "$CERT_DIR/local.key" \
  -out "$CERT_DIR/local.crt" \
  -days 365 \
  -subj "/CN=${LOCAL_P2P_HOST}" \
  -addext "subjectAltName=IP:${LOCAL_P2P_HOST},DNS:localhost" >/dev/null 2>&1

chmod 644 "$CERT_DIR/local.key" "$CERT_DIR/local.crt"
echo "✅ Local TLS certs written to $CERT_DIR/local.crt and $CERT_DIR/local.key (openssl self-signed)"
