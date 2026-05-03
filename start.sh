#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PYTHON_BIN="${PYTHON_BIN:-python3}"
VENV_DIR="${ROOT_DIR}/.venv"
VENV_PYTHON="${VENV_DIR}/bin/python3"
VENV_ACTIVATE="${VENV_DIR}/bin/activate"

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

echo "[start] Activating virtual environment"
# shellcheck disable=SC1091
source "$VENV_ACTIVATE"

echo "[start] Ensuring pip is available"
python3 -m ensurepip --upgrade >/dev/null 2>&1 || true

echo "[start] Installing requirements"
PIP_DISABLE_PIP_VERSION_CHECK=1 python3 -m pip install -r requirements.txt

export OLLAMA_TEXT_MODEL="${OLLAMA_TEXT_MODEL:-llama3:8b}"
export AI_CHAT_MODEL="${AI_CHAT_MODEL:-llama3:8b}"
echo "[start] AI model: $AI_CHAT_MODEL"

if curl -sS -m 2 http://localhost:11434 >/dev/null 2>&1; then
  echo "[start] Ollama is reachable at http://localhost:11434"
else
  echo "[start] Warning: Ollama is not reachable at http://localhost:11434"
  echo "[start]          AI tagging will fall back to local keyword tags."
  echo "[start]          To enable Ollama later, run: ollama serve"
fi

echo "[start] Backend URL: http://0.0.0.0:8000"
echo "[start] Frontend URL: http://shr-lost-and-found.local:8000"
echo "[start] Starting FastAPI with python3 -m uvicorn"

exec python3 -m uvicorn backend.backend:app --host 0.0.0.0 --port 8000
