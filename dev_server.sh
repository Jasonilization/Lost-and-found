#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

log() {
  printf '[dev-server] %s\n' "$*"
}

die() {
  printf '[dev-server] Error: %s\n' "$*" >&2
  exit 1
}

load_env_defaults() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 0

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" == export\ * ]] && line="${line#export }"
    [[ "$line" == *=* ]] || continue

    local key="${line%%=*}"
    local value="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

    if [[ -z "${!key-}" ]]; then
      export "$key=$value"
    fi
  done < "$env_file"
}

find_python() {
  if [[ -n "${PYTHON_BIN:-}" ]]; then
    command -v "$PYTHON_BIN" >/dev/null 2>&1 || [[ -x "$PYTHON_BIN" ]] || die "PYTHON_BIN is not executable: ${PYTHON_BIN}"
    command -v "$PYTHON_BIN" 2>/dev/null || printf '%s\n' "$PYTHON_BIN"
    return 0
  fi

  if [[ -x "${ROOT_DIR}/.venv/bin/python" ]]; then
    printf '%s\n' "${ROOT_DIR}/.venv/bin/python"
    return 0
  fi

  command -v python3 >/dev/null 2>&1 || die "No Python found. Expected .venv/bin/python or python3."
  command -v python3
}

detect_lan_ip() {
  local ip=""

  if command -v ipconfig >/dev/null 2>&1; then
    for iface in en0 en1; do
      ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
      if [[ -n "$ip" ]]; then
        printf '%s\n' "$ip"
        return 0
      fi
    done
  fi

  if command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
    if [[ -n "$ip" ]]; then
      printf '%s\n' "$ip"
      return 0
    fi
  fi

  if command -v ifconfig >/dev/null 2>&1; then
    ip="$(ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" { print $2; exit }' || true)"
    if [[ -n "$ip" ]]; then
      printf '%s\n' "$ip"
      return 0
    fi
  fi
}

ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
load_env_defaults "$ENV_FILE"

HOST="${DEV_HOST:-0.0.0.0}"
PORT="${DEV_PORT:-8001}"
APP_MODULE="${DEV_APP_MODULE:-backend.backend:app}"
RELOAD="${DEV_RELOAD:-0}"
PYTHON="$(find_python)"
LAN_IP="$(detect_lan_ip || true)"

"$PYTHON" -c 'import uvicorn' >/dev/null 2>&1 || die "Uvicorn is not installed for ${PYTHON}."
export WEB_CONCURRENCY="${DEV_WEB_CONCURRENCY:-1}"

if command -v lsof >/dev/null 2>&1; then
  if lsof_output="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null)"; then
    if command -v curl >/dev/null 2>&1 && curl -fsS "http://127.0.0.1:${PORT}/ready" >/dev/null 2>&1; then
      log "A dev server is already answering on port ${PORT}."
      log "Local URL: http://127.0.0.1:${PORT}"
      if [[ -n "$LAN_IP" ]]; then
        log "LAN URL: http://${LAN_IP}:${PORT}"
      fi
      printf '%s\n' "$lsof_output"
      exit 0
    fi

    log "Port ${PORT} is already in use:"
    printf '%s\n' "$lsof_output"
    die "Stop that process or run with DEV_PORT=<port>."
  fi
fi

log "Starting ${APP_MODULE}"
log "Python: ${PYTHON}"
log "Bind: ${HOST}:${PORT}"
log "Workers: ${WEB_CONCURRENCY}"
log "Local URL: http://127.0.0.1:${PORT}"
if [[ -n "$LAN_IP" ]]; then
  log "LAN URL: http://${LAN_IP}:${PORT}"
else
  log "LAN URL: could not detect LAN IP; check your network interface address."
fi
log "Press Ctrl-C to stop."

uvicorn_args=("$PYTHON" -m uvicorn "$APP_MODULE" --host "$HOST" --port "$PORT")
case "$RELOAD" in
  1|true|TRUE|yes|YES|on|ON)
    uvicorn_args+=(--reload)
    ;;
esac

exec "${uvicorn_args[@]}"
