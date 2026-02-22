#!/bin/bash
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR" || { echo "❌ Could not find project directory."; exit 1; }

echo ""
echo "🎮 ISIT Game — Starting Local Dev Server"
echo "========================================="

PORT_PID=$(lsof -ti :3000)
if [ -n "$PORT_PID" ]; then
  echo "⚠️  Clearing port 3000 (PID $PORT_PID)..."
  kill -9 $PORT_PID
  sleep 1
fi

if [ ! -f ".env.local" ]; then
  echo "❌ ERROR: .env.local not found! Cannot start."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "⚠️  node_modules missing. Running npm install..."
  npm install || { echo "❌ npm install failed."; exit 1; }
fi

echo ""
echo "🚀 Starting server... wait for ✓ Ready before opening browser."
echo "   → http://localhost:3000"
echo "   → http://localhost:3000/admin"
echo ""
echo "   Press Ctrl+C to stop."
echo "========================================="
echo ""
npm run dev
