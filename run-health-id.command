#!/bin/zsh
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
BUNDLED_NODE="/Users/ivangolcev/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"

if command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
elif [ -x "$BUNDLED_NODE" ]; then
  NODE_BIN="$BUNDLED_NODE"
else
  echo "Node.js не найден."
  echo "Установи Node.js LTS с https://nodejs.org/ или запусти проект из Codex, где есть bundled node."
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3)"
else
  echo "python3 не найден. Он нужен только для раздачи frontend на localhost:3000."
  exit 1
fi

echo "Health ID v5 запускается..."
echo "Backend:  http://localhost:3001"
echo "Frontend: http://localhost:3000/index.html"
echo ""
echo "Чтобы остановить проект, нажми Ctrl+C в этом окне."
echo ""

cd "$BACKEND_DIR"
"$NODE_BIN" src/server.js &
BACKEND_PID=$!

cd "$FRONTEND_DIR"
"$PYTHON_BIN" -m http.server 3000 &
FRONTEND_PID=$!

cleanup() {
  echo ""
  echo "Останавливаю Health ID..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

wait
