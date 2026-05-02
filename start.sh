#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "[start] Project root: $ROOT_DIR"

if [[ ! -d ".venv" ]]; then
  echo "[start] Creating virtual environment in .venv"
  python3 -m venv .venv
fi

echo "[start] Activating virtual environment"
source .venv/bin/activate

echo "[start] Installing requirements"
python3 -m pip install -r requirements.txt

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
