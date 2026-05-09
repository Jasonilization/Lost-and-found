#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-python3}"
VENV_DIR="${ROOT_DIR}/.venv"
VENV_PYTHON="${VENV_DIR}/bin/python3"
ENV_FILE="${ROOT_DIR}/.env"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "[deploy] Error: $PYTHON_BIN is not available on PATH."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[deploy] Creating .env from .env.example"
  cp .env.example "$ENV_FILE"
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

export OLLAMA_HOST="${OLLAMA_HOST:-${OLLAMA_URL:-http://localhost:11434}}"
case "$OLLAMA_HOST" in
  http://*|https://*) ;;
  *) export OLLAMA_HOST="http://${OLLAMA_HOST}" ;;
esac
export OLLAMA_HOST="${OLLAMA_HOST%/}"
export OLLAMA_MODEL="${OLLAMA_MODEL:-${OLLAMA_TEXT_MODEL:-llama3:8b}}"
export OLLAMA_TEXT_MODEL="${OLLAMA_TEXT_MODEL:-$OLLAMA_MODEL}"
export AI_CHAT_MODEL="${AI_CHAT_MODEL:-$OLLAMA_MODEL}"

mkdir -p "${UPLOAD_DIR:-./uploads}" "${LOG_DIR:-./logs}" "${DATA_DIR:-./data}"

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "[deploy] Creating virtual environment"
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

echo "[deploy] Installing dependencies"
"$VENV_PYTHON" -m pip install --upgrade pip
"$VENV_PYTHON" -m pip install -r requirements.txt

echo "[deploy] Initializing database"
"$VENV_PYTHON" -c "from backend.database import init_db; init_db()"

HOST_VALUE="${HOST:-0.0.0.0}"
PORT_VALUE="${PORT:-8000}"
WORKERS_VALUE="${WEB_CONCURRENCY:-2}"

echo "[deploy] Starting backend on http://${HOST_VALUE}:${PORT_VALUE}"
exec "$VENV_DIR/bin/gunicorn" backend.backend:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind "${HOST_VALUE}:${PORT_VALUE}" \
  --workers "${WORKERS_VALUE}"
