#!/bin/bash
set -e

# P2P.RED E2E Environment Orchestrator
echo "🚀 Starting E2E test environment..."

# 1. Start Metadata API (Background)
# This provides TURN credentials and Metadata API on port 3001
echo "📦 Starting Metadata API on port 3001..."
PORT=3001 CORS_ORIGIN="*" node metadata-api/server.js &
API_PID=$!

# 2. Start SEO Preview Server (Background)
# This provides SEO previews on port 3002
echo "🖼️ Starting SEO Preview Server on port 3002..."
METADATA_PORT=3002 node metadata-server.cjs &
SEO_PID=$!

# 3. Start PeerJS Server (Background)
# We use pnpm dlx peer to run a local signaling server for tests
echo "📡 Starting PeerJS Server on port 9000..."
pnpm dlx peer --port 9000 --path /peerjs &
PEERJS_PID=$!

# Wait for services to be ready
echo "⏳ Waiting for services to stabilize..."
sleep 5

# 4. Start Vite Dev Server (Background)
echo "🌐 Starting Vite Dev Server on port 5180..."
npm run dev -- --host 127.0.0.1 --port 5180 &
VITE_PID=$!

# Wait for all processes to finish (or kill them on exit)
function cleanup {
  echo "🧹 Cleaning up E2E environment..."
  kill $API_PID $SEO_PID $PEERJS_PID $VITE_PID 2>/dev/null || true
}

trap cleanup EXIT

# Keep script alive while servers are running
wait
