#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

log() {
  printf '[deploy] %s\n' "$*"
}

die() {
  printf '[deploy] Error: %s\n' "$*" >&2
  exit 1
}

normalize_http_url() {
  local value="$1"
  value="${value%/}"
  case "$value" in
    http://*|https://*) printf '%s\n' "$value" ;;
    *) printf 'http://%s\n' "$value" ;;
  esac
}

url_host_name() {
  local value="$1"
  value="${value#http://}"
  value="${value#https://}"
  value="${value%%/*}"
  value="${value%%:*}"
  printf '%s\n' "$value"
}

image_tag() {
  local image_without_digest="${1%@*}"
  local last_segment="${image_without_digest##*/}"

  [[ "$last_segment" == *:* ]] || return 1
  printf '%s\n' "${last_segment##*:}"
}

load_env_defaults() {
  local file="$1"
  local line
  local key
  local value

  if [[ -f "$file" ]]; then
    log "Loading environment defaults from ${file}"
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
    done < "$file"
  fi
}

validate_ollama_host() {
  local ollama_host_name

  if [[ -z "${OLLAMA_HOST:-}" ]]; then
    cat >&2 <<'EOF'
[deploy] OLLAMA_HOST is required for Swarm deployments.
[deploy] Set SWARM_OLLAMA_HOST=http://<MAC_LAN_IP>:11434 in .env when Pis call Ollama on your Mac.
EOF
    exit 1
  fi

  OLLAMA_HOST="$(normalize_http_url "$OLLAMA_HOST")"
  ollama_host_name="$(url_host_name "$OLLAMA_HOST")"

  case "$ollama_host_name" in
    localhost|127.0.0.1|0.0.0.0|::1)
      cat >&2 <<EOF
[deploy] Refusing OLLAMA_HOST=${OLLAMA_HOST} for Swarm.
[deploy] Inside a web container, loopback points at the container, not your Mac or Pi host.
[deploy] Use SWARM_OLLAMA_HOST=http://<MAC_LAN_IP>:11434 or an overlay-network service name.
EOF
      exit 1
      ;;
  esac

  export OLLAMA_HOST
}

validate_image_name() {
  local tag

  [[ -n "${APP_IMAGE:-}" ]] || die "APP_IMAGE is required. Run ./build.sh on the Mac, then deploy with the emitted APP_IMAGE."
  tag="$(image_tag "$APP_IMAGE")" || die "APP_IMAGE must include an explicit immutable tag: registry/lostfound:<version>."
  [[ "$tag" != "latest" ]] || die "APP_IMAGE must not use :latest. Use the unique version emitted by build.sh."
  [[ "$APP_IMAGE" == */* ]] || die "APP_IMAGE must be a registry-qualified name like registry/lostfound:${tag}."
}

validate_manager_host() {
  local docker_context
  local host_short
  local required_host
  local swarm_state
  local control_available

  command -v docker >/dev/null 2>&1 || die "docker is not available on PATH."
  docker info >/dev/null 2>&1 || die "Docker daemon is not running or is not reachable."

  docker_context="$(docker context show 2>/dev/null || true)"
  [[ "$docker_context" != "desktop-linux" ]] || die "Refusing to deploy from Docker Desktop context desktop-linux."

  host_short="$(hostname -s 2>/dev/null || hostname)"
  required_host="${SWARM_MANAGER_HOSTNAME:-clanker}"
  [[ "$host_short" == "$required_host" ]] || die "deploy.sh must run on ${required_host}; current host is ${host_short}. SSH to ${required_host} and run it there."

  swarm_state="$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || true)"
  control_available="$(docker info --format '{{.Swarm.ControlAvailable}}' 2>/dev/null || true)"
  [[ "$swarm_state" == "active" ]] || die "Docker Swarm is not active on ${host_short}."
  [[ "$control_available" == "true" ]] || die "${host_short} is not a Swarm manager node."
}

validate_swarm_nodes() {
  local node_lines
  local hostname
  local status
  local availability
  local manager_status
  local ready_workers=0

  node_lines="$(docker node ls --format '{{.Hostname}}\t{{.Status}}\t{{.Availability}}\t{{.ManagerStatus}}')"
  [[ -n "$node_lines" ]] || die "docker node ls returned no nodes."

  while IFS=$'\t' read -r hostname status availability manager_status; do
    local node_lc="${hostname,,}"
    local status_lc="${status,,}"
    local availability_lc="${availability,,}"

    if [[ "$node_lc" == *docker-desktop* && "$status_lc" == "ready" && "$availability_lc" == "active" ]]; then
      docker node ls >&2 || true
      die "docker-desktop is an active Swarm node. Remove or drain it before deploying."
    fi

    if [[ "$status_lc" == "ready" && "$availability_lc" == "active" && -z "$manager_status" ]]; then
      ready_workers=$((ready_workers + 1))
    fi
  done <<< "$node_lines"

  if (( ready_workers < 1 )); then
    docker node ls >&2 || true
    die "At least one Ready/Active Swarm worker is required before deployment."
  fi
}

ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"
IMAGE_ENV_FILE="${IMAGE_ENV_FILE:-${ROOT_DIR}/.deploy/lostfound-image.env}"

load_env_defaults "$ENV_FILE"
load_env_defaults "$IMAGE_ENV_FILE"

STACK_NAME="${STACK_NAME:-mystack}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
STACK_DEPLOY_WITH_REGISTRY_AUTH="${STACK_DEPLOY_WITH_REGISTRY_AUTH:-1}"

OLLAMA_HOST="${SWARM_OLLAMA_HOST:-${OLLAMA_HOST:-${OLLAMA_URL:-}}}"
export OLLAMA_MODEL="${OLLAMA_MODEL:-${OLLAMA_TEXT_MODEL:-llama3:8b}}"
export OLLAMA_TEXT_MODEL="${OLLAMA_TEXT_MODEL:-$OLLAMA_MODEL}"
export OLLAMA_IMAGE_MODEL="${OLLAMA_IMAGE_MODEL:-llava}"
export AI_CHAT_MODEL="${AI_CHAT_MODEL:-$OLLAMA_MODEL}"
export LOSTFOUND_NETWORK_DRIVER="overlay"

validate_manager_host
validate_swarm_nodes
validate_ollama_host
validate_image_name

log "Pulling deploy image on manager: ${APP_IMAGE}"
docker pull "$APP_IMAGE"

deploy_args=(-c "$COMPOSE_FILE")
if [[ "$STACK_DEPLOY_WITH_REGISTRY_AUTH" == "1" ]]; then
  deploy_args=(--with-registry-auth "${deploy_args[@]}")
fi

log "Deploying stack ${STACK_NAME} with image ${APP_IMAGE}"
docker stack deploy "${deploy_args[@]}" "$STACK_NAME"

log "Deployment submitted. Current services:"
docker stack services "$STACK_NAME"
