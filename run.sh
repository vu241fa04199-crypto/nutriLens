#!/usr/bin/env bash
# NutriLens — one-click start (macOS / Linux)
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required (v18 or newer). Install it from https://nodejs.org and run this again."
  exit 1
fi

MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$MAJOR" -lt 18 ]; then
  echo "NutriLens needs Node.js 18+ (you have $(node -v)). Please upgrade Node."
  exit 1
fi

PORT="${PORT:-4000}"

if [ ! -d node_modules ]; then
  echo "→ Installing server dependencies (first run only)…"
  if ! npm install --no-audit --no-fund; then
    echo "→ Native SQLite module could not be built — retrying without it (Node 22.5+ has SQLite built in)."
    npm install --no-audit --no-fund --omit=optional
  fi
fi

if [ ! -f client/dist/index.html ]; then
  echo "→ Building the React client…"
  npm run build
fi

echo ""
echo "  NutriLens is starting → http://localhost:$PORT"
echo "  Demo login: demo@nutrilens.app / demo1234"
echo "  Press Ctrl+C to stop."
echo ""
exec npm start
