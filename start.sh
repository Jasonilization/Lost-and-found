#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

log() {
  printf '[start] %s\n' "$*"
}

die() {
  printf '[start] Error: %s\n' "$*" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || die "docker is not available on PATH."

ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
if [[ -f "$ENV_FILE" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" == export\ * ]] && line="${line#export }"
    [[ "$line" == *=* ]] || continue

    key="${line%%=*}"
    value="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

    if [[ -z "${!key-}" ]]; then
      export "$key=$value"
    fi
  done < "$ENV_FILE"
fi

DOCKER_CONTEXT="$(docker context show 2>/dev/null || true)"
HOST_SHORT="$(hostname -s 2>/dev/null || hostname)"
SWARM_MANAGER_HOSTNAME="${SWARM_MANAGER_HOSTNAME:-clanker}"

if [[ "$HOST_SHORT" == "$SWARM_MANAGER_HOSTNAME" || -n "${SSH_CONNECTION:-}${SSH_CLIENT:-}${SSH_TTY:-}" ]]; then
  log "Detected Swarm-side execution on ${HOST_SHORT}; running deploy only."
  exec "${ROOT_DIR}/deploy.sh" "$@"
fi

if [[ "$DOCKER_CONTEXT" == "desktop-linux" ]]; then
  log "Detected Docker Desktop context (${DOCKER_CONTEXT}); running build only."
  exec "${ROOT_DIR}/build.sh" "$@"
fi

die "Could not choose a role. Use Docker context desktop-linux on the Mac to build, or SSH to ${SWARM_MANAGER_HOSTNAME} to deploy."
