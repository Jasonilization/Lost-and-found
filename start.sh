#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-python3}"
VENV_DIR="${ROOT_DIR}/.venv"
VENV_PYTHON="${VENV_DIR}/bin/python3"
VENV_ACTIVATE="${VENV_DIR}/bin/activate"
ENV_FILE="${ROOT_DIR}/.env"

echo "[start] Project root: $ROOT_DIR"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "[start] Error: $PYTHON_BIN is not available on PATH."
  echo "[start] Install Python 3, or run with PYTHON_BIN=/path/to/python3 ./start.sh"
  exit 1
fi

if [[ ! -x "$VENV_PYTHON" || ! -f "$VENV_ACTIVATE" ]]; then
  echo "[start] Creating or repairing virtual environment in .venv"
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[start] Creating .env from .env.example"
  cp .env.example "$ENV_FILE"
fi

if [[ -f "$ENV_FILE" ]]; then
  echo "[start] Loading environment from .env"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

mkdir -p "${UPLOAD_DIR:-./uploads}" "${LOG_DIR:-./logs}" "${DATA_DIR:-./data}"

echo "[start] Activating virtual environment"
# shellcheck disable=SC1091
source "$VENV_ACTIVATE"

echo "[start] Ensuring pip is available"
python3 -m ensurepip --upgrade >/dev/null 2>&1 || true

echo "[start] Installing requirements"
PIP_DISABLE_PIP_VERSION_CHECK=1 python3 -m pip install -r requirements.txt

export OLLAMA_HOST="${OLLAMA_HOST:-${OLLAMA_URL:-http://localhost:11434}}"
case "$OLLAMA_HOST" in
  http://*|https://*) ;;
  *) export OLLAMA_HOST="http://${OLLAMA_HOST}" ;;
esac
export OLLAMA_HOST="${OLLAMA_HOST%/}"
export OLLAMA_MODEL="${OLLAMA_MODEL:-${OLLAMA_TEXT_MODEL:-llama3:8b}}"
export OLLAMA_TEXT_MODEL="${OLLAMA_TEXT_MODEL:-$OLLAMA_MODEL}"
export AI_CHAT_MODEL="${AI_CHAT_MODEL:-$OLLAMA_MODEL}"
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-8000}"
echo "[start] AI model: $AI_CHAT_MODEL"

if curl -sS -m 2 "$OLLAMA_HOST/api/tags" >/dev/null 2>&1; then
  echo "[start] Ollama is reachable at $OLLAMA_HOST"
else
  echo "[start] Warning: Ollama is not reachable at $OLLAMA_HOST"
  echo "[start]          AI tagging will fall back to local keyword tags."
  echo "[start]          Set OLLAMA_HOST for LAN/external Ollama, or run: ollama serve"
fi

echo "[start] Backend URL: http://${HOST}:${PORT}"
echo "[start] Frontend URL: http://shr-lost-and-found.local:${PORT}"
echo "[start] Starting FastAPI with python3 -m uvicorn"

exec python3 -m uvicorn backend.backend:app --host "$HOST" --port "$PORT"
