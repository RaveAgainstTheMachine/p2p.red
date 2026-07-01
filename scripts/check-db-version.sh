#!/bin/sh
# Ensures DB_VERSION matches between shardStore.ts and sw.js

SHARD_STORE="src/utils/shardStore.ts"
SW="public/download-bridge/sw.js"

if [ ! -f "$SHARD_STORE" ] || [ ! -f "$SW" ]; then
  echo "Error: Cannot find required files for DB version check"
  exit 1
fi

V1=$(grep -Eo 'const DB_VERSION = [0-9]+;' "$SHARD_STORE" | grep -Eo '[0-9]+')
V2=$(grep -Eo 'const DB_VERSION = [0-9]+;' "$SW" | grep -Eo '[0-9]+')

if [ -z "$V1" ] || [ -z "$V2" ]; then
  echo "Error: Could not extract DB_VERSION from one or both files"
  exit 1
fi

if [ "$V1" != "$V2" ]; then
  echo "Error: DB_VERSION mismatch! $SHARD_STORE is v$V1, but $SW is v$V2"
  echo "You must update both files to the same DB_VERSION."
  exit 1
fi

echo "✅ DB_VERSION check passed (v$V1)"
exit 0
