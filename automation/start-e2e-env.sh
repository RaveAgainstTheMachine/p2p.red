#!/bin/bash
set -e

# P2P.RED E2E Environment Orchestrator
echo "🚀 Starting E2E test environment..."

# 1. Start Metadata API (Background)
echo "📦 Starting Metadata API on port 3001..."
node metadata-server.js &
METADATA_PID=$!

# 2. Start PeerJS Server (Background)
# We use npx peerjs to run a local signaling server for tests
echo "📡 Starting PeerJS Server on port 9000..."
npx peerjs --port 9000 --path /peerjs &
PEERJS_PID=$!

# 3. Start Vite Dev Server (Background)
echo "🌐 Starting Vite Dev Server on port 5180..."
npm run dev -- --host 127.0.0.1 --port 5180 &
VITE_PID=$!

# Wait for all processes to finish (or kill them on exit)
function cleanup {
  echo "🧹 Cleaning up E2E environment..."
  kill $METADATA_PID $PEERJS_PID $VITE_PID 2>/dev/null || true
}

trap cleanup EXIT

# Keep script alive while servers are running
wait
